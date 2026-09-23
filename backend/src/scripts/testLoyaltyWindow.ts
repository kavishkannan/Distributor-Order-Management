import "reflect-metadata";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum } from "../models/OrderEventEntity";
import { PointsLedgerEntity } from "../models/PointsLedgerEntity";
import { ProductEntity } from "../models/ProductEntity";
import { getLoyaltyById } from "../services/distributor.service";
import { calculateTier } from "../services/loyalty.service";
import {
  approveOrder,
  cancelOrder,
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

const SalesManagerId = "44444444-4444-4444-4444-444444444444";

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const DistributorRepo = AppDataSource.getRepository(DistributorEntity);
  const ProductRepo = AppDataSource.getRepository(ProductEntity);
  const OrderRepo = AppDataSource.getRepository(OrderEntity);
  const PointsLedgerRepo = AppDataSource.getRepository(PointsLedgerEntity);

  const Distributor = await DistributorRepo.save({
    Name: "Test Loyalty Window Distributor",
    CreditLimit: 1000000,
  });
  const ZeroCredit = await DistributorRepo.save({
    Name: "Test Loyalty Window Zero Credit",
    CreditLimit: 0,
  });
  const Product = await ProductRepo.save({
    Sku: "LOYALTY-WINDOW-SKU",
    Name: "Loyalty Window Widget",
    UnitPrice: 1000,
    StockQuantity: 500,
  });
  const CreatedOrderIds: string[] = [];

  async function historicalPoints(
    Target: DistributorEntity,
    Points: number,
    DaysAgo: number,
  ): Promise<void> {
    const Order = await OrderRepo.save({
      Distributor: Target,
      Status: OrderStatus.Delivered,
      DiscountPercent: 0,
      Subtotal: Points * 100,
      Total: Points * 100,
      IdempotencyKey: null,
    });
    CreatedOrderIds.push(Order.Id);
    const Entry = await PointsLedgerRepo.save({
      Distributor: Target,
      Order: Order,
      Points: Points,
    });
    await PointsLedgerRepo.createQueryBuilder()
      .update(PointsLedgerEntity)
      .set({
        CreatedAt: () => `DATE_SUB(NOW(), INTERVAL ${Number(DaysAgo)} DAY)`,
      })
      .where("id = :id", { id: Entry.Id })
      .execute();
  }

  try {
    console.log("Tier boundaries (B2):");
    for (const [Points, Expected] of [
      [0, "Bronze"],
      [999, "Bronze"],
      [1000, "Silver"],
      [4999, "Silver"],
      [5000, "Gold"],
    ] as const) {
      check(
        calculateTier(Points) === Expected,
        `${Points} points -> ${Expected}`,
      );
    }

    console.log("\nOnly activity inside the trailing 90 days counts:");
    await historicalPoints(Distributor, 3000, 100);
    await historicalPoints(Distributor, 2000, 91);
    await historicalPoints(Distributor, 400, 89);
    await historicalPoints(Distributor, 100, 10);
    const L0 = await getLoyaltyById(Distributor.Id);
    check(
      L0.pointsBalance === 500,
      `balance counts only the 89- and 10-day-old entries (500; lifetime would be 5,500) - got ${L0.pointsBalance}`,
    );
    check(
      L0.tier === "Bronze" && L0.currentDiscount === 0,
      `tier from the window (Bronze), not lifetime (Gold) - got ${L0.tier}`,
    );

    console.log("\nA recent Confirmed order contributes immediately:");
    const Confirmed = await placeOrder({
      distributorId: Distributor.Id,
      lineItems: [{ productId: Product.Id, quantity: 50 }],
    });
    CreatedOrderIds.push(Confirmed.Id);
    check(
      Confirmed.Status === "Confirmed" && Number(Confirmed.Total) === 50000,
      "50,000 order at 0% is Confirmed",
    );
    const L1 = await getLoyaltyById(Distributor.Id);
    check(
      L1.pointsBalance === 1000,
      `+500 points (floor(50,000/100)) -> 1,000 - got ${L1.pointsBalance}`,
    );
    check(
      L1.tier === "Silver" && L1.currentDiscount === 3,
      `tier recalculated to Silver / 3% - got ${L1.tier}`,
    );

    const Next = await placeOrder({
      distributorId: Distributor.Id,
      lineItems: [{ productId: Product.Id, quantity: 1 }],
    });
    CreatedOrderIds.push(Next.Id);
    check(
      Number(Next.DiscountPercent) === 3,
      "the next order is priced with the new tier's 3% discount",
    );

    console.log(
      "\nCancelling a Confirmed order reverses its points and recalculates the tier:",
    );
    await cancelOrder(Confirmed.Id, ActorTypeEnum.Distributor, Distributor.Id);
    const Net = (
      await PointsLedgerRepo.find({ where: { Order: { Id: Confirmed.Id } } })
    ).reduce((Sum, E) => Sum + E.Points, 0);
    check(
      Net === 0,
      `the order's net ledger points are 0 after cancellation (got ${Net})`,
    );
    const L2 = await getLoyaltyById(Distributor.Id);
    check(
      L2.pointsBalance === 509,
      `balance drops back to 509 - got ${L2.pointsBalance}`,
    );
    check(
      L2.tier === "Bronze" && L2.currentDiscount === 0,
      `tier recalculated back to Bronze / 0% - got ${L2.tier}`,
    );

    console.log("\nPendingApproval orders earn nothing until approved:");
    const Pending = await placeOrder({
      distributorId: ZeroCredit.Id,
      lineItems: [{ productId: Product.Id, quantity: 20 }],
    });
    CreatedOrderIds.push(Pending.Id);
    check(
      Pending.Status === "PendingApproval",
      "zero-credit order is PendingApproval",
    );
    check(
      (await getLoyaltyById(ZeroCredit.Id)).pointsBalance === 0,
      "no points while PendingApproval",
    );
    await approveOrder(Pending.Id, SalesManagerId);
    const L3 = await getLoyaltyById(ZeroCredit.Id);
    check(
      L3.pointsBalance === 200 && L3.tier === "Bronze",
      `approval awards floor(20,000/100) = 200 - got ${L3.pointsBalance}`,
    );
  } finally {
    if (CreatedOrderIds.length > 0)
      await OrderRepo.delete({ Id: In(CreatedOrderIds) });
    await ProductRepo.delete({ Id: Product.Id });
    await DistributorRepo.delete({ Id: In([Distributor.Id, ZeroCredit.Id]) });
    await AppDataSource.destroy();
  }

  console.log(`\n${Passed} passed, ${Failed} failed`);
  if (Failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((Err) => {
  console.error("Loyalty window test script crashed", Err);
  process.exitCode = 1;
});
