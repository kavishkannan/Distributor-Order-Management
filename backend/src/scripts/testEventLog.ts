import "reflect-metadata";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum, OrderEventEntity } from "../models/OrderEventEntity";
import { OutboundEventEntity } from "../models/OutboundEventEntity";
import { ProductEntity } from "../models/ProductEntity";
import {
  cancelOrder,
  deliverOrder,
  dispatchOrder,
  getOrderById,
  InvalidTransitionError,
  placeOrder,
} from "../services/order.service";

let Passed = 0;
let Failed = 0;

function check(Condition: boolean, Description: string): void {
  if (Condition) {
    Passed += 1;
    console.log(`  PASS: ${Description}`);
  } else {
    Failed += 1;
    console.error(`  FAIL: ${Description}`);
  }
}

async function rejectsWith(
  Work: Promise<unknown>,
  Pattern: RegExp,
): Promise<boolean> {
  try {
    await Work;
    return false;
  } catch (Err) {
    return Pattern.test(Err instanceof Error ? Err.message : String(Err));
  }
}

const SalesManagerId = "44444444-4444-4444-4444-444444444444";

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const DistributorRepo = AppDataSource.getRepository(DistributorEntity);
  const ProductRepo = AppDataSource.getRepository(ProductEntity);
  const OrderRepo = AppDataSource.getRepository(OrderEntity);
  const OrderEventRepo = AppDataSource.getRepository(OrderEventEntity);
  const OutboundEventRepo = AppDataSource.getRepository(OutboundEventEntity);

  const Distributor = await DistributorRepo.save({
    Name: "Test Event Log Distributor",
    CreditLimit: 1000000,
  });
  const Product = await ProductRepo.save({
    Sku: "EVENTLOG-TEST-SKU",
    Name: "Event Log Test Widget",
    UnitPrice: 10,
    StockQuantity: 50,
  });
  const CreatedOrderIds: string[] = [];

  try {
    console.log("Full lifecycle - one complete event per status change:");
    const Placed = await placeOrder({
      distributorId: Distributor.Id,
      lineItems: [{ productId: Product.Id, quantity: 1 }],
    });
    CreatedOrderIds.push(Placed.Id);
    await dispatchOrder(Placed.Id, SalesManagerId);
    await deliverOrder(Placed.Id, SalesManagerId);

    const Order = (await getOrderById(Placed.Id))!;
    const Events = Order.Events;
    const Path = Events.map(
      (Event) => `${Event.FromStatus ?? "null"}>${Event.ToStatus}`,
    ).join(" ");
    check(
      Path ===
        "null>Placed Placed>Confirmed Confirmed>Dispatched Dispatched>Delivered",
      `history is complete and in chronological order (${Path})`,
    );
    check(
      Events.every(
        (Event, Index) =>
          Index === 0 || Event.FromStatus === Events[Index - 1].ToStatus,
      ),
      "each event's previous status is the prior event's new status (unbroken chain)",
    );
    check(
      Events.every(
        (Event) =>
          Event.ActorType &&
          Event.CreatedAt instanceof Date &&
          !isNaN(Event.CreatedAt.getTime()),
      ),
      "every event has an actor type and a timestamp",
    );
    check(
      Events[0].ActorType === ActorTypeEnum.Distributor &&
        Events[0].ActorId === Distributor.Id,
      "placement attributed to the distributor",
    );
    check(
      Events[1].ActorType === ActorTypeEnum.System,
      "credit-check outcome attributed to System",
    );
    check(
      Events.slice(2).every(
        (Event) =>
          Event.ActorType === ActorTypeEnum.SalesManager &&
          Event.ActorId === SalesManagerId,
      ),
      "dispatch/deliver attributed to the sales manager",
    );
    check(
      Events.every(
        (Event, Index) =>
          Index === 0 ||
          Event.CreatedAt.getTime() >= Events[Index - 1].CreatedAt.getTime(),
      ),
      "timestamps never go backwards",
    );
    check(
      Events.every(
        (Event, Index) =>
          Index === 0 ||
          BigInt(Event.Sequence) > BigInt(Events[Index - 1].Sequence),
      ),
      "DB-assigned sequence strictly increases",
    );
    const OutboundCount = await OutboundEventRepo.count({
      where: { Order: { Id: Placed.Id } },
    });
    check(
      OutboundCount === Events.length,
      `one ERP outbound event per status change (${OutboundCount}/${Events.length})`,
    );

    console.log("\nInvalid transitions record nothing:");
    const BeforeCount = await OrderEventRepo.count({
      where: { Order: { Id: Placed.Id } },
    });
    let Threw = false;
    try {
      await cancelOrder(Placed.Id, ActorTypeEnum.SalesManager, SalesManagerId);
    } catch (Err) {
      Threw = Err instanceof InvalidTransitionError;
    }
    check(Threw, "Delivered -> Cancelled is rejected");
    check(
      (await OrderEventRepo.count({ where: { Order: { Id: Placed.Id } } })) ===
        BeforeCount,
      "no event row added",
    );

    console.log("\nThe database rejects edits and deletions (append-only):");
    const Target = Events[1];
    check(
      await rejectsWith(
        AppDataSource.query(
          "UPDATE order_events SET toStatus = 'Cancelled' WHERE id = ?",
          [Target.Id],
        ),
        /append-only/,
      ),
      "raw SQL UPDATE is rejected",
    );
    check(
      await rejectsWith(
        AppDataSource.query("DELETE FROM order_events WHERE id = ?", [
          Target.Id,
        ]),
        /append-only/,
      ),
      "raw SQL DELETE is rejected",
    );
    const Tampered = await OrderEventRepo.findOneByOrFail({ Id: Target.Id });
    Tampered.ActorId = "tampered";
    check(
      await rejectsWith(OrderEventRepo.save(Tampered), /append-only/),
      "ORM save of a modified event is rejected",
    );
    const Reloaded = await OrderEventRepo.findOneByOrFail({ Id: Target.Id });
    check(
      Reloaded.ToStatus === Target.ToStatus &&
        Reloaded.ActorId === Target.ActorId,
      "the event row is unchanged after the attempts",
    );
    check(
      (await OrderEventRepo.count({ where: { Order: { Id: Placed.Id } } })) ===
        Events.length,
      "no event row was removed",
    );

    console.log(
      "\nTimestamp ties are ordered deterministically by insert sequence:",
    );
    {
      const Raw = await OrderRepo.save({
        Distributor: Distributor,
        Status: OrderStatus.Cancelled,
        DiscountPercent: 0,
        Subtotal: 10,
        Total: 10,
        IdempotencyKey: null,
      });
      CreatedOrderIds.push(Raw.Id);
      const Chain: [string | null, string][] = [
        [null, "Placed"],
        ["Placed", "PendingApproval"],
        ["PendingApproval", "Cancelled"],
      ];
      for (const [From, To] of Chain) {
        await AppDataSource.query(
          "INSERT INTO order_events (id, order_id, fromStatus, toStatus, actorType, actorId, Created_At) VALUES (UUID(), ?, ?, ?, 'System', NULL, '2026-01-01 00:00:00.000')",
          [Raw.Id, From, To],
        );
      }
      const Reordered = (await getOrderById(Raw.Id))!.Events.map(
        (Event) => Event.ToStatus,
      ).join(">");
      check(
        Reordered === "Placed>PendingApproval>Cancelled",
        `identical timestamps still return insert order (${Reordered})`,
      );
    }
  } finally {
    if (CreatedOrderIds.length > 0)
      await OrderRepo.delete({ Id: In(CreatedOrderIds) });
    await ProductRepo.delete({ Id: Product.Id });
    await DistributorRepo.delete({ Id: Distributor.Id });
    await AppDataSource.destroy();
  }

  console.log(`\n${Passed} passed, ${Failed} failed`);
  if (Failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((Err) => {
  console.error("Event log test script crashed", Err);
  process.exitCode = 1;
});
