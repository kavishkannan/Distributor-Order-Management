import "reflect-metadata";
import { AppDataSource } from "../config/data-source";
import { DistributorEntity } from "../models/DistributorEntity";
import { In } from "typeorm";
import { OrderEntity } from "../models/OrderEntity";
import { ActorTypeEnum, OrderEventEntity } from "../models/OrderEventEntity";
import { OrderLineItemEntity } from "../models/OrderLineItemEntity";
import { OutboundEventEntity } from "../models/OutboundEventEntity";
import { PointsLedgerEntity } from "../models/PointsLedgerEntity";
import { ProductEntity } from "../models/ProductEntity";
import {
  approveOrder,
  cancelOrder,
  IdempotencyKeyConflictError,
  InvalidTransitionError,
  placeOrder,
  rejectOrder,
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

async function rejects(
  Promise_: Promise<unknown>,
  ErrorClass: new (...Args: never[]) => Error,
): Promise<boolean> {
  try {
    await Promise_;
    return false;
  } catch (Err) {
    return Err instanceof ErrorClass;
  }
}

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const DistributorRepo = AppDataSource.getRepository(DistributorEntity);
  const ProductRepo = AppDataSource.getRepository(ProductEntity);
  const OrderRepo = AppDataSource.getRepository(OrderEntity);
  const OrderLineItemRepo = AppDataSource.getRepository(OrderLineItemEntity);
  const OrderEventRepo = AppDataSource.getRepository(OrderEventEntity);

  const Distributor = await DistributorRepo.save({
    Name: "Test Idempotency Distributor",
    CreditLimit: 1000000,
  });

  const Product = await ProductRepo.save({
    Sku: "IDEMPOTENCY-TEST-SKU",
    Name: "Idempotency Test Widget",
    UnitPrice: 10,
    StockQuantity: 100,
  });

  const CreatedOrderIds: string[] = [];
  const ExtraOrderIds: string[] = [];
  let OtherDistributor: DistributorEntity | null = null;
  const OutboundEventRepo = AppDataSource.getRepository(OutboundEventEntity);
  const PointsLedgerRepo = AppDataSource.getRepository(PointsLedgerEntity);
  const SalesManagerId = "44444444-4444-4444-4444-444444444444";

  try {
    console.log("Sequential repeat with the same idempotency key:");
    const KeyA = "idempotency-test-key-sequential";
    const FirstCall = await placeOrder({
      distributorId: Distributor.Id,
      lineItems: [{ productId: Product.Id, quantity: 1 }],
      idempotencyKey: KeyA,
    });
    CreatedOrderIds.push(FirstCall.Id);
    const SecondCall = await placeOrder({
      distributorId: Distributor.Id,
      lineItems: [{ productId: Product.Id, quantity: 1 }],
      idempotencyKey: KeyA,
    });

    check(
      SecondCall.Id === FirstCall.Id,
      "Repeated request returned the original order, not a new one",
    );
    const CountA = await OrderRepo.count({ where: { IdempotencyKey: KeyA } });
    check(
      CountA === 1,
      `Exactly one order row exists for the key (found ${CountA})`,
    );

    console.log("\nTwo simultaneous requests with the same idempotency key:");
    const KeyB = "idempotency-test-key-concurrent";
    const [ResultA, ResultB] = await Promise.all([
      placeOrder({
        distributorId: Distributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 1 }],
        idempotencyKey: KeyB,
      }),
      placeOrder({
        distributorId: Distributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 1 }],
        idempotencyKey: KeyB,
      }),
    ]);
    CreatedOrderIds.push(ResultA.Id);

    check(
      ResultA.Id === ResultB.Id,
      "Both concurrent requests resolved to the same order id",
    );
    const CountB = await OrderRepo.count({ where: { IdempotencyKey: KeyB } });
    check(
      CountB === 1,
      `Exactly one order row exists for the key despite the race (found ${CountB})`,
    );

    console.log("\nA placement key is only replayed for the same request:");
    OtherDistributor = await DistributorRepo.save({
      Name: "Test Idempotency Other Distributor",
      CreditLimit: 0,
    });
    check(
      await rejects(
        placeOrder({
          distributorId: OtherDistributor.Id,
          lineItems: [{ productId: Product.Id, quantity: 1 }],
          idempotencyKey: KeyA,
        }),
        IdempotencyKeyConflictError,
      ),
      "Another distributor reusing the key gets IdempotencyKeyConflictError, not the first distributor's order",
    );
    check(
      await rejects(
        placeOrder({
          distributorId: Distributor.Id,
          lineItems: [{ productId: Product.Id, quantity: 2 }],
          idempotencyKey: KeyA,
        }),
        IdempotencyKeyConflictError,
      ),
      "Same key with different line items gets IdempotencyKeyConflictError",
    );
    check(
      (await OrderRepo.count({ where: { IdempotencyKey: KeyA } })) === 1,
      "Still exactly one order for the key after the rejected reuses",
    );

    const stockOf = async () =>
      (await ProductRepo.findOneByOrFail({ Id: Product.Id })).StockQuantity;
    const counts = async (OrderId: string) => ({
      Events: await OrderEventRepo.count({ where: { Order: { Id: OrderId } } }),
      Outbound: await OutboundEventRepo.count({
        where: { Order: { Id: OrderId } },
      }),
      Ledger: await PointsLedgerRepo.count({
        where: { Order: { Id: OrderId } },
      }),
    });
    const netPoints = async (OrderId: string) =>
      (
        await PointsLedgerRepo.find({ where: { Order: { Id: OrderId } } })
      ).reduce((Sum, Entry) => Sum + Entry.Points, 0);
    const Unique = () =>
      `idem-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    console.log(
      "\nRetried cancel of a Confirmed order (same Idempotency-Key) replays, never re-applies:",
    );
    {
      const Placed = await placeOrder({
        distributorId: Distributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 20 }],
      });
      ExtraOrderIds.push(Placed.Id);
      const StockBefore = await stockOf();
      const Key = Unique();
      const First = await cancelOrder(
        Placed.Id,
        ActorTypeEnum.Distributor,
        Distributor.Id,
        Key,
      );
      const AfterFirst = {
        Stock: await stockOf(),
        ...(await counts(Placed.Id)),
        Net: await netPoints(Placed.Id),
      };
      const Second = await cancelOrder(
        Placed.Id,
        ActorTypeEnum.Distributor,
        Distributor.Id,
        Key,
      );
      const AfterSecond = {
        Stock: await stockOf(),
        ...(await counts(Placed.Id)),
        Net: await netPoints(Placed.Id),
      };

      check(
        First.Status === "Cancelled" && Second.Status === "Cancelled",
        "Both calls succeed and report Cancelled",
      );
      check(
        AfterFirst.Stock === StockBefore + 20,
        "First call released the 20 reserved units",
      );
      check(
        AfterFirst.Net === 0 && AfterFirst.Ledger === 2,
        "First call reversed the points it was awarded (award + reversal rows, net 0)",
      );
      check(
        JSON.stringify(AfterSecond) === JSON.stringify(AfterFirst),
        `Retry changed nothing: stock, events, ERP events, ledger identical (${JSON.stringify(AfterSecond)})`,
      );
      check(
        await rejects(
          cancelOrder(Placed.Id, ActorTypeEnum.Distributor, Distributor.Id),
          InvalidTransitionError,
        ),
        "Without the key, a repeat cancel is still rejected as an invalid transition",
      );
      check(
        await rejects(
          cancelOrder(
            Placed.Id,
            ActorTypeEnum.SalesManager,
            SalesManagerId,
            Key,
          ),
          IdempotencyKeyConflictError,
        ),
        "Same key presented by a different actor -> IdempotencyKeyConflictError",
      );
    }

    console.log(
      "\nTwo simultaneous identical cancels (same key) - applied exactly once:",
    );
    {
      const Placed = await placeOrder({
        distributorId: Distributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 20 }],
      });
      ExtraOrderIds.push(Placed.Id);
      const StockBefore = await stockOf();
      const Key = Unique();
      const Results = await Promise.allSettled([
        cancelOrder(Placed.Id, ActorTypeEnum.Distributor, Distributor.Id, Key),
        cancelOrder(Placed.Id, ActorTypeEnum.Distributor, Distributor.Id, Key),
      ]);
      const After = await counts(Placed.Id);
      check(
        Results.every((R) => R.status === "fulfilled"),
        "Both concurrent requests succeed",
      );
      check(
        (await stockOf()) === StockBefore + 20,
        "Stock released exactly once",
      );
      check(
        After.Ledger === 2 && (await netPoints(Placed.Id)) === 0,
        "Points reversed exactly once",
      );
      check(
        After.Events === 3 && After.Outbound === 3,
        `One Cancelled event and one ERP event (events ${After.Events}, outbound ${After.Outbound}; placement accounts for 2)`,
      );
    }

    console.log(
      "\nRetried approve / reject replay without re-awarding points or re-releasing stock:",
    );
    {
      const Pending = await placeOrder({
        distributorId: OtherDistributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 30 }],
      });
      ExtraOrderIds.push(Pending.Id);
      check(
        Pending.Status === "PendingApproval",
        "Zero-credit order is PendingApproval",
      );
      const Key = Unique();
      await approveOrder(Pending.Id, SalesManagerId, Key);
      const Again = await approveOrder(Pending.Id, SalesManagerId, Key);
      check(
        Again.Status === "Confirmed",
        "Retried approve returns the Confirmed order",
      );
      check(
        (await PointsLedgerRepo.count({
          where: { Order: { Id: Pending.Id } },
        })) === 1,
        "Points awarded exactly once",
      );
      check(
        await rejects(
          rejectOrder(Pending.Id, SalesManagerId, Key),
          IdempotencyKeyConflictError,
        ),
        "Same key reused for a different action (reject) -> IdempotencyKeyConflictError",
      );

      const ToReject = await placeOrder({
        distributorId: OtherDistributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 7 }],
      });
      ExtraOrderIds.push(ToReject.Id);
      const StockBefore = await stockOf();
      const RejectKey = Unique();
      await rejectOrder(ToReject.Id, SalesManagerId, RejectKey);
      await rejectOrder(ToReject.Id, SalesManagerId, RejectKey);
      check(
        (await stockOf()) === StockBefore + 7,
        "Retried reject released stock exactly once",
      );
      check(
        (await counts(ToReject.Id)).Outbound === 3,
        "Retried reject produced no extra ERP event",
      );
    }
  } finally {
    if (ExtraOrderIds.length > 0)
      await OrderRepo.delete({ Id: In(ExtraOrderIds) });
    if (CreatedOrderIds.length > 0) {
      await OrderLineItemRepo.delete({ Order: { Id: CreatedOrderIds[0] } });
      await OrderRepo.delete({ Id: CreatedOrderIds[0] });
      if (CreatedOrderIds[1]) {
        await OrderLineItemRepo.delete({ Order: { Id: CreatedOrderIds[1] } });
        await OrderRepo.delete({ Id: CreatedOrderIds[1] });
      }
    }
    await ProductRepo.delete({ Id: Product.Id });
    await DistributorRepo.delete({ Id: Distributor.Id });
    if (OtherDistributor)
      await DistributorRepo.delete({ Id: OtherDistributor.Id });
    await AppDataSource.destroy();
  }

  console.log(`\n${Passed} passed, ${Failed} failed`);
  if (Failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((Err) => {
  console.error("Idempotency test script crashed", Err);
  process.exitCode = 1;
});
