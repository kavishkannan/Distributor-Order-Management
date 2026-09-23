import "reflect-metadata";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum, OrderEventEntity } from "../models/OrderEventEntity";
import { OutboundEventEntity } from "../models/OutboundEventEntity";
import { PointsLedgerEntity } from "../models/PointsLedgerEntity";
import { ProductEntity } from "../models/ProductEntity";
import { getTrailingNinetyDayPoints } from "../services/loyalty.service";
import {
  InvalidTransitionError,
  placeOrder,
  rejectOrder,
  transitionOrder,
} from "../services/order.service";
import {
  cancelOwnOrder,
  getDistributorDashboard,
  getDistributorOrders,
  getDistributorProfile,
  getLoyaltyById,
  getOwnOrderById,
  NotFoundError,
} from "../services/distributor.service";
import {
  buildPaginationMeta,
  OrderSortFieldMap,
  parsePagination,
  parseSortDirection,
  parseSortField,
} from "../utils/validators";

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
  const OrderEventRepo = AppDataSource.getRepository(OrderEventEntity);
  const PointsLedgerRepo = AppDataSource.getRepository(PointsLedgerEntity);
  const OutboundEventRepo = AppDataSource.getRepository(OutboundEventEntity);

  const RunTag = Date.now();

  const DistributorA = await DistributorRepo.save({
    Name: `Test Distributor A ${RunTag}`,
    CreditLimit: 1000,
  });
  const DistributorB = await DistributorRepo.save({
    Name: `Test Distributor B ${RunTag}`,
    CreditLimit: 1000,
  });
  const DistributorC = await DistributorRepo.save({
    Name: `Test Distributor C (loyalty window) ${RunTag}`,
    CreditLimit: 1000,
  });

  const Product = await ProductRepo.save({
    Sku: `TEST-DIST-${RunTag}`,
    Name: "Distributor Test Product",
    UnitPrice: 100,
    StockQuantity: 100,
  });

  const CreatedOrderIds: string[] = [];
  const CreatedDistributorIds = [
    DistributorA.Id,
    DistributorB.Id,
    DistributorC.Id,
  ];

  try {
    console.log("Section 1: valid vs invalid distributor id");
    {
      const Profile = await getDistributorProfile(DistributorA.Id);
      check(
        Profile.id === DistributorA.Id,
        "getDistributorProfile: returns the requested distributor",
      );
      check(
        Profile.creditLimit === 1000,
        "getDistributorProfile: creditLimit matches seed value",
      );
      check(
        Profile.tier === "Bronze",
        "getDistributorProfile: fresh distributor starts at Bronze",
      );

      const FakeId = "00000000-0000-0000-0000-000000000000";
      let Threw = false;
      try {
        await getDistributorProfile(FakeId);
      } catch (Err) {
        Threw = Err instanceof NotFoundError;
      }
      check(
        Threw,
        "getDistributorProfile: unknown distributor id throws NotFoundError",
      );
    }

    console.log("\nSection 2: empty order list");
    {
      const Empty = await getDistributorOrders(DistributorA.Id, {
        page: 1,
        limit: 10,
        status: undefined,
        sortField: "CreatedAt",
        sortDirection: "DESC",
      });
      check(
        Empty.items.length === 0,
        "getDistributorOrders: empty list for a distributor with no orders",
      );
      check(
        Empty.total === 0 &&
          buildPaginationMeta(1, 10, Empty.total).totalPages === 1,
        "getDistributorOrders: total=0, totalPages=1 when empty",
      );
    }

    console.log("\nSection 3: place orders (credit-driven status)");
    const OrderA1 = await placeOrder({
      distributorId: DistributorA.Id,
      lineItems: [{ productId: Product.Id, quantity: 5 }],
    });
    const OrderA2 = await placeOrder({
      distributorId: DistributorA.Id,
      lineItems: [{ productId: Product.Id, quantity: 5 }],
    });
    const OrderA3 = await placeOrder({
      distributorId: DistributorA.Id,
      lineItems: [{ productId: Product.Id, quantity: 5 }],
    });
    [OrderA1, OrderA2, OrderA3].forEach((O) => CreatedOrderIds.push(O.Id));
    const OrderB1 = await placeOrder({
      distributorId: DistributorB.Id,
      lineItems: [{ productId: Product.Id, quantity: 1 }],
    });
    CreatedOrderIds.push(OrderB1.Id);

    check(
      OrderA1.Status === OrderStatus.Confirmed,
      "placeOrder: order 1 (500 <= 1000 credit) is Confirmed",
    );
    check(
      OrderA2.Status === OrderStatus.Confirmed,
      "placeOrder: order 2 (500 <= remaining 500 credit) is Confirmed",
    );
    check(
      OrderA3.Status === OrderStatus.PendingApproval,
      "placeOrder: order 3 (exceeds remaining credit) is PendingApproval",
    );

    console.log("\nSection 4: available credit calculation");
    {
      const Profile = await getDistributorProfile(DistributorA.Id);
      const ExpectedAvailableCredit =
        1000 -
        (Number(OrderA1.Total) + Number(OrderA2.Total) + Number(OrderA3.Total));
      check(
        Profile.availableCredit === ExpectedAvailableCredit,
        `getDistributorProfile: availableCredit reflects open orders (expected ${ExpectedAvailableCredit}, got ${Profile.availableCredit})`,
      );
    }

    console.log("\nSection 5: dashboard");
    {
      const Dashboard = await getDistributorDashboard(DistributorA.Id);
      check(
        Dashboard.distributor.id === DistributorA.Id,
        "getDistributorDashboard: distributor profile included",
      );
      check(
        Dashboard.recentOrders.length === 3,
        "getDistributorDashboard: recentOrders includes all 3 placed orders",
      );

      let Threw = false;
      try {
        await getDistributorDashboard("00000000-0000-0000-0000-000000000000");
      } catch (Err) {
        Threw = Err instanceof NotFoundError;
      }
      check(
        Threw,
        "getDistributorDashboard: unknown distributor id throws NotFoundError",
      );
    }

    console.log("\nSection 6: pagination");
    {
      const Page1 = await getDistributorOrders(DistributorA.Id, {
        page: 1,
        limit: 2,
        status: undefined,
        sortField: "CreatedAt",
        sortDirection: "ASC",
      });
      const Page2 = await getDistributorOrders(DistributorA.Id, {
        page: 2,
        limit: 2,
        status: undefined,
        sortField: "CreatedAt",
        sortDirection: "ASC",
      });
      check(
        Page1.items.length === 2,
        "getDistributorOrders: page 1 (limit 2) returns 2 items",
      );
      check(
        Page2.items.length === 1,
        "getDistributorOrders: page 2 (limit 2) returns the remaining 1 item",
      );
      check(
        Page1.total === 3 &&
          buildPaginationMeta(1, 2, Page1.total).totalPages === 2,
        "getDistributorOrders: total=3, totalPages=2 across both pages",
      );

      const PagedIds = new Set(
        [...Page1.items, ...Page2.items].map((O) => O.Id),
      );
      check(
        PagedIds.size === 3 &&
          [OrderA1.Id, OrderA2.Id, OrderA3.Id].every((Id) => PagedIds.has(Id)),
        "getDistributorOrders: paging through all pages covers every order exactly once (no gaps/duplicates)",
      );
    }

    console.log("\nSection 7: pagination + sort input validation");
    {
      check(
        parsePagination(undefined, undefined).value.Page === 1,
        "parsePagination: defaults page to 1",
      );
      check(
        parsePagination(undefined, undefined).value.Limit === 10,
        "parsePagination: defaults limit to 10",
      );
      check(
        parsePagination("2", "5").value.Page === 2,
        "parsePagination: parses numeric-string page",
      );
      check(
        parsePagination("0", "10").issues.length > 0,
        "parsePagination: rejects page 0",
      );
      check(
        parsePagination("-1", "10").issues.length > 0,
        "parsePagination: rejects negative page",
      );
      check(
        parsePagination("1", "101").issues.length > 0,
        "parsePagination: rejects limit above max (100)",
      );
      check(
        parsePagination("1", "0").issues.length > 0,
        "parsePagination: rejects limit 0",
      );
      check(
        parsePagination("abc", "10").issues.length > 0,
        "parsePagination: rejects non-numeric page",
      );
      check(
        parseSortField("total", OrderSortFieldMap, "CreatedAt").value ===
          "Total",
        "parseSortField: whitelists 'total' -> 'Total'",
      );
      check(
        parseSortField("createdat", OrderSortFieldMap, "CreatedAt").value ===
          "CreatedAt",
        "parseSortField: whitelists 'createdat' -> 'CreatedAt'",
      );
      check(
        parseSortField(
          "status; DROP TABLE orders;",
          OrderSortFieldMap,
          "CreatedAt",
        ).issue !== undefined,
        "parseSortField: rejects a non-whitelisted value",
      );
      check(
        parseSortDirection("asc").value === "ASC",
        "parseSortDirection: normalizes lowercase 'asc'",
      );
      check(
        parseSortDirection("sideways").issue !== undefined,
        "parseSortDirection: rejects an invalid direction",
      );
    }

    console.log("\nSection 8: status filtering");
    {
      const ConfirmedOnly = await getDistributorOrders(DistributorA.Id, {
        page: 1,
        limit: 10,
        status: OrderStatus.Confirmed,
        sortField: "CreatedAt",
        sortDirection: "ASC",
      });
      const PendingOnly = await getDistributorOrders(DistributorA.Id, {
        page: 1,
        limit: 10,
        status: OrderStatus.PendingApproval,
        sortField: "CreatedAt",
        sortDirection: "ASC",
      });
      check(
        ConfirmedOnly.items.length === 2,
        "getDistributorOrders: status=Confirmed returns exactly 2 orders",
      );
      check(
        PendingOnly.items.length === 1,
        "getDistributorOrders: status=PendingApproval returns exactly 1 order",
      );
      check(
        ConfirmedOnly.items.every((O) => O.Status === OrderStatus.Confirmed),
        "getDistributorOrders: status filter never leaks a non-matching order",
      );
    }

    console.log("\nSection 9: cross-distributor ownership enforcement");
    {
      const OwnView = await getOwnOrderById(DistributorA.Id, OrderA1.Id);
      check(
        OwnView !== null && OwnView.Id === OrderA1.Id,
        "getOwnOrderById: distributor can view its own order",
      );

      const CrossView = await getOwnOrderById(DistributorB.Id, OrderA1.Id);
      check(
        CrossView === null,
        "getOwnOrderById: a different distributor gets null (not the order) for someone else's order",
      );

      const NonexistentView = await getOwnOrderById(
        DistributorB.Id,
        "00000000-0000-0000-0000-000000000000",
      );
      check(
        NonexistentView === null,
        "getOwnOrderById: a nonexistent order also returns null (indistinguishable from 'not owned')",
      );

      let CrossCancelThrew = false;
      let CrossCancelIsNotFound = false;
      try {
        await cancelOwnOrder(DistributorB.Id, OrderA1.Id);
      } catch (Err) {
        CrossCancelThrew = true;
        CrossCancelIsNotFound = Err instanceof NotFoundError;
      }
      check(
        CrossCancelThrew,
        "cancelOwnOrder: cancelling another distributor's order throws",
      );
      check(
        CrossCancelIsNotFound,
        "cancelOwnOrder: cross-distributor cancel throws NotFoundError (not InvalidTransitionError)",
      );

      const StillConfirmed = await OrderRepo.findOneByOrFail({
        Id: OrderA1.Id,
      });
      check(
        StillConfirmed.Status === OrderStatus.Confirmed,
        "cancelOwnOrder: rejected cross-distributor attempt left the order untouched",
      );
    }

    console.log("\nSection 10: cancellation side effects");
    {
      const ProductBeforeA3Cancel = await ProductRepo.findOneByOrFail({
        Id: Product.Id,
      });

      const CancelledA3 = await cancelOwnOrder(DistributorA.Id, OrderA3.Id);
      check(
        CancelledA3.Status === OrderStatus.Cancelled,
        "cancelOwnOrder: PendingApproval order cancels successfully",
      );

      const ProductAfterA3Cancel = await ProductRepo.findOneByOrFail({
        Id: Product.Id,
      });
      check(
        ProductAfterA3Cancel.StockQuantity ===
          ProductBeforeA3Cancel.StockQuantity + 5,
        "cancelOwnOrder: cancelling a PendingApproval order releases its reserved stock",
      );

      const PointsBeforeA1Cancel = await getTrailingNinetyDayPoints(
        DistributorA.Id,
      );
      const ProductBeforeA1Cancel = await ProductRepo.findOneByOrFail({
        Id: Product.Id,
      });

      const CancelledA1 = await cancelOwnOrder(DistributorA.Id, OrderA1.Id);
      check(
        CancelledA1.Status === OrderStatus.Cancelled,
        "cancelOwnOrder: Confirmed order cancels successfully",
      );

      const PointsAfterA1Cancel = await getTrailingNinetyDayPoints(
        DistributorA.Id,
      );
      const PointsAwardedForA1 = Math.floor(Number(OrderA1.Total) / 100);
      check(
        PointsAfterA1Cancel === PointsBeforeA1Cancel - PointsAwardedForA1,
        `cancelOwnOrder: cancelling a Confirmed order reverses its awarded points (expected ${PointsBeforeA1Cancel - PointsAwardedForA1}, got ${PointsAfterA1Cancel})`,
      );

      const ProductAfterA1Cancel = await ProductRepo.findOneByOrFail({
        Id: Product.Id,
      });
      check(
        ProductAfterA1Cancel.StockQuantity ===
          ProductBeforeA1Cancel.StockQuantity + 5,
        "cancelOwnOrder: cancelling a Confirmed order also releases its reserved stock",
      );

      const ProfileAfterA1Cancel = await getDistributorProfile(DistributorA.Id);
      const ExpectedTierAfterA1Cancel =
        PointsAfterA1Cancel >= 5000
          ? "Gold"
          : PointsAfterA1Cancel >= 1000
            ? "Silver"
            : "Bronze";
      check(
        ProfileAfterA1Cancel.tier === ExpectedTierAfterA1Cancel,
        `getDistributorProfile: tier reflects the post-reversal point balance (expected ${ExpectedTierAfterA1Cancel}, got ${ProfileAfterA1Cancel.tier})`,
      );

      const CancelEvent = await OrderEventRepo.findOne({
        where: { Order: { Id: OrderA1.Id }, ToStatus: OrderStatus.Cancelled },
      });
      check(
        CancelEvent !== null,
        "cancelOwnOrder: records an OrderEvent for the Cancelled transition",
      );
      check(
        CancelEvent?.ActorType === ActorTypeEnum.Distributor &&
          CancelEvent?.ActorId === DistributorA.Id,
        "cancelOwnOrder: OrderEvent records the distributor as the actor",
      );
      check(
        CancelEvent?.CreatedAt instanceof Date,
        "cancelOwnOrder: OrderEvent has a timestamp",
      );

      const CancelOutboundEvent = await OutboundEventRepo.findOne({
        where: { Order: { Id: OrderA1.Id } },
        order: { CreatedAt: "DESC" },
      });
      check(
        CancelOutboundEvent !== null,
        "cancelOwnOrder: emits an outbound ERP event for the cancellation",
      );

      const ProductBeforeDoubleCancel = await ProductRepo.findOneByOrFail({
        Id: Product.Id,
      });
      let DoubleCancelThrew = false;
      let DoubleCancelIsInvalidTransition = false;
      try {
        await cancelOwnOrder(DistributorA.Id, OrderA1.Id);
      } catch (Err) {
        DoubleCancelThrew = true;
        DoubleCancelIsInvalidTransition = Err instanceof InvalidTransitionError;
      }
      check(
        DoubleCancelThrew,
        "cancelOwnOrder: cancelling an already-cancelled order throws",
      );
      check(
        DoubleCancelIsInvalidTransition,
        "cancelOwnOrder: repeat cancel throws InvalidTransitionError, not silently succeeding",
      );

      const ProductAfterDoubleCancel = await ProductRepo.findOneByOrFail({
        Id: Product.Id,
      });
      check(
        ProductAfterDoubleCancel.StockQuantity ===
          ProductBeforeDoubleCancel.StockQuantity,
        "cancelOwnOrder: stock is released exactly once, not again on a rejected repeat cancel",
      );
    }

    console.log("\nSection 11: cannot cancel Dispatched/Delivered orders");
    {
      await transitionOrder(
        OrderA2.Id,
        OrderStatus.Dispatched,
        ActorTypeEnum.SalesManager,
        null,
      );

      let DispatchedCancelThrew = false;
      let DispatchedCancelIsInvalidTransition = false;
      try {
        await cancelOwnOrder(DistributorA.Id, OrderA2.Id);
      } catch (Err) {
        DispatchedCancelThrew = true;
        DispatchedCancelIsInvalidTransition =
          Err instanceof InvalidTransitionError;
      }
      check(
        DispatchedCancelThrew,
        "cancelOwnOrder: cancelling a Dispatched order throws",
      );
      check(
        DispatchedCancelIsInvalidTransition,
        "cancelOwnOrder: Dispatched cancel attempt throws InvalidTransitionError",
      );

      await transitionOrder(
        OrderA2.Id,
        OrderStatus.Delivered,
        ActorTypeEnum.SalesManager,
        null,
      );

      let DeliveredCancelThrew = false;
      let DeliveredCancelIsInvalidTransition = false;
      try {
        await cancelOwnOrder(DistributorA.Id, OrderA2.Id);
      } catch (Err) {
        DeliveredCancelThrew = true;
        DeliveredCancelIsInvalidTransition =
          Err instanceof InvalidTransitionError;
      }
      check(
        DeliveredCancelThrew,
        "cancelOwnOrder: cancelling a Delivered order throws",
      );
      check(
        DeliveredCancelIsInvalidTransition,
        "cancelOwnOrder: Delivered cancel attempt throws InvalidTransitionError",
      );
    }

    console.log("\nSection 11b: cannot cancel Rejected orders");
    {
      const DistributorD = await DistributorRepo.save({
        Name: `Test Distributor D ${RunTag}`,
        CreditLimit: 0,
      });
      CreatedDistributorIds.push(DistributorD.Id);

      const OrderD1 = await placeOrder({
        distributorId: DistributorD.Id,
        lineItems: [{ productId: Product.Id, quantity: 1 }],
      });
      CreatedOrderIds.push(OrderD1.Id);
      check(
        OrderD1.Status === OrderStatus.PendingApproval,
        "setup: zero-credit order is PendingApproval",
      );

      await rejectOrder(OrderD1.Id, DistributorD.Id);

      let RejectedCancelThrew = false;
      let RejectedCancelIsInvalidTransition = false;
      try {
        await cancelOwnOrder(DistributorD.Id, OrderD1.Id);
      } catch (Err) {
        RejectedCancelThrew = true;
        RejectedCancelIsInvalidTransition =
          Err instanceof InvalidTransitionError;
      }
      check(
        RejectedCancelThrew,
        "cancelOwnOrder: cancelling a Rejected order throws",
      );
      check(
        RejectedCancelIsInvalidTransition,
        "cancelOwnOrder: Rejected cancel attempt throws InvalidTransitionError",
      );
    }

    console.log("\nSection 12: trailing-90-day loyalty window");
    {
      const AnchorOrder = await OrderRepo.save({
        Distributor: DistributorC,
        Status: OrderStatus.Confirmed,
        DiscountPercent: 0,
        Subtotal: 100,
        Total: 100,
        IdempotencyKey: null,
      });
      CreatedOrderIds.push(AnchorOrder.Id);

      const OldEntry = await PointsLedgerRepo.save({
        Distributor: DistributorC,
        Order: AnchorOrder,
        Points: 6000,
      });
      await PointsLedgerRepo.createQueryBuilder()
        .update(PointsLedgerEntity)
        .set({ CreatedAt: () => "DATE_SUB(NOW(), INTERVAL 100 DAY)" })
        .where("id = :id", { id: OldEntry.Id })
        .execute();

      await PointsLedgerRepo.save({
        Distributor: DistributorC,
        Order: AnchorOrder,
        Points: 200,
      });

      const Loyalty = await getLoyaltyById(DistributorC.Id);
      check(
        Loyalty.pointsBalance === 200,
        `getLoyaltyById: excludes the 100-day-old entry (expected 200, got ${Loyalty.pointsBalance})`,
      );
      check(
        Loyalty.tier === "Bronze",
        "getLoyaltyById: tier reflects only the trailing-90-day balance (Bronze, not Gold)",
      );
    }
  } finally {
    if (CreatedOrderIds.length > 0) {
      await PointsLedgerRepo.delete({ Order: { Id: In(CreatedOrderIds) } });
      await OutboundEventRepo.delete({ Order: { Id: In(CreatedOrderIds) } });
      await OrderRepo.delete({ Id: In(CreatedOrderIds) });
    }
    await ProductRepo.delete({ Id: Product.Id });
    await DistributorRepo.delete({ Id: In(CreatedDistributorIds) });
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
