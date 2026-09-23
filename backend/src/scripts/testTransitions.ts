import "reflect-metadata";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum, OrderEventEntity } from "../models/OrderEventEntity";
import {
  InvalidTransitionError,
  transitionOrder,
} from "../services/order.service";

interface TransitionCase {
  description: string;
  from: OrderStatus;
  to: OrderStatus;
}

const InvalidCases: TransitionCase[] = [
  {
    description: "Placed -> Dispatched",
    from: OrderStatus.Placed,
    to: OrderStatus.Dispatched,
  },
  {
    description: "Delivered -> Cancelled",
    from: OrderStatus.Delivered,
    to: OrderStatus.Cancelled,
  },
  {
    description: "Rejected -> Confirmed",
    from: OrderStatus.Rejected,
    to: OrderStatus.Confirmed,
  },
  {
    description: "Cancelled -> Placed",
    from: OrderStatus.Cancelled,
    to: OrderStatus.Placed,
  },
  {
    description: "Confirmed -> PendingApproval",
    from: OrderStatus.Confirmed,
    to: OrderStatus.PendingApproval,
  },
  {
    description: "PendingApproval -> Dispatched",
    from: OrderStatus.PendingApproval,
    to: OrderStatus.Dispatched,
  },
];

const ValidCase: TransitionCase = {
  description: "Placed -> Confirmed",
  from: OrderStatus.Placed,
  to: OrderStatus.Confirmed,
};

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
  const OrderRepo = AppDataSource.getRepository(OrderEntity);
  const OrderEventRepo = AppDataSource.getRepository(OrderEventEntity);

  const Distributor = await DistributorRepo.save({
    Name: "Test Transition Distributor",
    CreditLimit: 100000,
  });

  const CreatedOrderIds: string[] = [];

  try {
    console.log(
      "Invalid transitions - must be rejected, order left unchanged:",
    );
    for (const TestCase of InvalidCases) {
      const Order = await OrderRepo.save({
        Distributor: Distributor,
        Status: TestCase.from,
        DiscountPercent: 0,
        Subtotal: 100,
        Total: 100,
        IdempotencyKey: null,
      });
      CreatedOrderIds.push(Order.Id);

      let Threw = false;
      let ThrewInvalidTransitionError = false;
      try {
        await transitionOrder(
          Order.Id,
          TestCase.to,
          ActorTypeEnum.System,
          null,
        );
      } catch (Err) {
        Threw = true;
        ThrewInvalidTransitionError = Err instanceof InvalidTransitionError;
      }

      const Reloaded = await OrderRepo.findOneByOrFail({ Id: Order.Id });
      const EventCount = await OrderEventRepo.count({
        where: { Order: { Id: Order.Id } },
      });

      check(Threw, `${TestCase.description}: threw an error`);
      check(
        ThrewInvalidTransitionError,
        `${TestCase.description}: threw InvalidTransitionError`,
      );
      check(
        Reloaded.Status === TestCase.from,
        `${TestCase.description}: order status unchanged (still ${Reloaded.Status})`,
      );
      check(
        EventCount === 0,
        `${TestCase.description}: no OrderEvent row was inserted`,
      );
    }

    console.log("\nValid transition - must succeed and record the event:");
    {
      const Order = await OrderRepo.save({
        Distributor: Distributor,
        Status: ValidCase.from,
        DiscountPercent: 0,
        Subtotal: 100,
        Total: 100,
        IdempotencyKey: null,
      });
      CreatedOrderIds.push(Order.Id);

      const Updated = await transitionOrder(
        Order.Id,
        ValidCase.to,
        ActorTypeEnum.SalesManager,
        Distributor.Id,
      );
      const Events = await OrderEventRepo.find({
        where: { Order: { Id: Order.Id } },
      });

      check(
        Updated.Status === ValidCase.to,
        `${ValidCase.description}: order status updated to ${ValidCase.to}`,
      );
      check(
        Events.length === 1,
        `${ValidCase.description}: exactly one OrderEvent row inserted`,
      );
      check(
        Events[0]?.FromStatus === ValidCase.from &&
          Events[0]?.ToStatus === ValidCase.to,
        `${ValidCase.description}: event records fromStatus/toStatus correctly`,
      );
    }
  } finally {
    if (CreatedOrderIds.length > 0) {
      await OrderRepo.delete({ Id: In(CreatedOrderIds) });
    }
    await DistributorRepo.delete({ Id: Distributor.Id });
    await AppDataSource.destroy();
  }

  console.log(`\n${Passed} passed, ${Failed} failed`);
  if (Failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((Err) => {
  console.error("Test script crashed", Err);
  process.exitCode = 1;
});
