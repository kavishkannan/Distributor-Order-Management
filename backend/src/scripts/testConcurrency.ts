import "reflect-metadata";
import { AppDataSource } from "../config/data-source";
import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity } from "../models/OrderEntity";
import { OrderEventEntity } from "../models/OrderEventEntity";
import { OrderLineItemEntity } from "../models/OrderLineItemEntity";
import { PointsLedgerEntity } from "../models/PointsLedgerEntity";
import { ProductEntity } from "../models/ProductEntity";
import { InsufficientStockError, placeOrder } from "../services/order.service";

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

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const DistributorRepo = AppDataSource.getRepository(DistributorEntity);
  const ProductRepo = AppDataSource.getRepository(ProductEntity);
  const OrderRepo = AppDataSource.getRepository(OrderEntity);
  const OrderLineItemRepo = AppDataSource.getRepository(OrderLineItemEntity);
  const OrderEventRepo = AppDataSource.getRepository(OrderEventEntity);
  const PointsLedgerRepo = AppDataSource.getRepository(PointsLedgerEntity);

  const Distributor = await DistributorRepo.save({
    Name: "Test Concurrency Distributor",
    CreditLimit: 1000000,
  });

  const Product = await ProductRepo.save({
    Sku: "CONCURRENCY-TEST-SKU",
    Name: "Concurrency Test Widget",
    UnitPrice: 10,
    StockQuantity: 1,
  });

  try {
    console.log("Firing two simultaneous orders for the last unit of stock:");

    const [ResultA, ResultB] = await Promise.allSettled([
      placeOrder({
        distributorId: Distributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 1 }],
      }),
      placeOrder({
        distributorId: Distributor.Id,
        lineItems: [{ productId: Product.Id, quantity: 1 }],
      }),
    ]);

    const SuccessCount = [ResultA, ResultB].filter(
      (R) => R.status === "fulfilled",
    ).length;
    const FailureCount = [ResultA, ResultB].filter(
      (R) => R.status === "rejected",
    ).length;

    check(
      SuccessCount === 1,
      "Exactly one of the two concurrent orders succeeded",
    );
    check(
      FailureCount === 1,
      "Exactly one of the two concurrent orders failed",
    );

    const FailedResult =
      ResultA.status === "rejected"
        ? ResultA
        : ResultB.status === "rejected"
          ? ResultB
          : null;
    check(
      FailedResult !== null &&
        FailedResult.reason instanceof InsufficientStockError,
      "The failed order was rejected with InsufficientStockError (not some other error)",
    );

    const ReloadedProduct = await ProductRepo.findOneByOrFail({
      Id: Product.Id,
    });
    check(
      ReloadedProduct.StockQuantity === 0,
      `Final stock is 0, not negative or still 1 (was ${ReloadedProduct.StockQuantity})`,
    );

    const SucceededResult =
      ResultA.status === "fulfilled"
        ? ResultA
        : ResultB.status === "fulfilled"
          ? ResultB
          : null;
    if (SucceededResult) {
      const CreatedOrder = SucceededResult.value;
      await PointsLedgerRepo.delete({ Order: { Id: CreatedOrder.Id } });
      await OrderLineItemRepo.delete({ Order: { Id: CreatedOrder.Id } });
      await OrderRepo.delete({ Id: CreatedOrder.Id });
    }
  } finally {
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
  console.error("Concurrency test script crashed", Err);
  process.exitCode = 1;
});
