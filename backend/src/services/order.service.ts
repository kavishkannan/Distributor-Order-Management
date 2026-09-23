import { logger } from "../config/logger";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum } from "../models/OrderEventEntity";
import { OutboundEventEntity } from "../models/OutboundEventEntity";
import { distributorRepository } from "../repositories/distributor.repository";
import { orderRepository } from "../repositories/order.repository";
import { orderEventRepository } from "../repositories/orderEvent.repository";
import { orderLineItemRepository } from "../repositories/orderLineItem.repository";
import { pointsLedgerRepository } from "../repositories/pointsLedger.repository";
import { productRepository } from "../repositories/product.repository";
import {
  isUniqueViolation,
  runInTransaction,
  TransactionContext,
} from "../repositories/transaction";
import { createOutboundEvent, deliverOutboundEvents } from "./erp.service";
import {
  calculatePointsEarned,
  calculateTier,
  getDiscountForTier,
  getTrailingNinetyDayPoints,
} from "./loyalty.service";

const ErpEventType = "OrderStatusChanged";

export class NotFoundError extends Error {}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly fromStatus: OrderStatus,
    public readonly toStatus: OrderStatus,
  ) {
    super(`Cannot transition from ${fromStatus} to ${toStatus}`);
  }
}

export class IdempotencyKeyConflictError extends Error {}

export class InsufficientStockError extends Error {
  constructor(
    public readonly sku: string,
    public readonly availableQuantity: number,
  ) {
    super(
      `Insufficient stock for SKU ${sku}: only ${availableQuantity} available`,
    );
  }
}

export interface PlaceOrderLineItemInput {
  productId: string;
  quantity: number;
}

export interface PlaceOrderInput {
  distributorId: string;
  lineItems: PlaceOrderLineItemInput[];
  idempotencyKey?: string;
}

function roundCurrency(Value: number): number {
  return Math.round(Value * 100) / 100;
}

export async function getAvailableCredit(
  DistributorId: string,
  CreditLimit: number,
  Tx?: TransactionContext,
): Promise<number> {
  const OpenOrdersTotal = await orderRepository.sumTotalsExcludingStatuses(
    DistributorId,
    [OrderStatus.Delivered, OrderStatus.Cancelled, OrderStatus.Rejected],
    Tx,
  );

  return roundCurrency(CreditLimit - OpenOrdersTotal);
}

function assertSamePlacementRequest(
  Existing: OrderEntity,
  DistributorId: string,
  LineItems: PlaceOrderLineItemInput[],
): void {
  const aggregate = (Pairs: [string, number][]) => {
    const Totals = new Map<string, number>();
    for (const [ProductId, Quantity] of Pairs)
      Totals.set(ProductId, (Totals.get(ProductId) ?? 0) + Quantity);
    return JSON.stringify(
      [...Totals.entries()].sort(([A], [B]) => A.localeCompare(B)),
    );
  };
  const Requested = aggregate(
    LineItems.map((Item) => [Item.productId, Item.quantity]),
  );
  const Stored = aggregate(
    (Existing.LineItems ?? []).map((Item) => [Item.Product.Id, Item.Quantity]),
  );
  if (Existing.Distributor?.Id !== DistributorId || Requested !== Stored) {
    throw new IdempotencyKeyConflictError(
      "This idempotency key was already used for a different order request",
    );
  }
}

export async function placeOrder(Input: PlaceOrderInput): Promise<OrderEntity> {
  const {
    distributorId: DistributorId,
    lineItems: LineItems,
    idempotencyKey: IdempotencyKey,
  } = Input;

  if (IdempotencyKey) {
    const Existing =
      await orderRepository.findByIdempotencyKeyWithLineItems(IdempotencyKey);
    if (Existing) {
      assertSamePlacementRequest(Existing, DistributorId, LineItems);
      logger.info("Order placement replayed (idempotency key)", {
        orderId: Existing.Id,
        distributorId: DistributorId,
      });
      return Existing;
    }
  }

  let Order: OrderEntity;
  let PointsAwarded = 0;
  const PlacementOutboundEvents: OutboundEventEntity[] = [];
  try {
    Order = await runInTransaction(async (Tx) => {
      const Distributor = await distributorRepository.lockById(
        Tx,
        DistributorId,
      );
      if (!Distributor) {
        throw new NotFoundError(`Distributor ${DistributorId} not found`);
      }

      const ProductIds = [
        ...new Set(LineItems.map((Item) => Item.productId)),
      ].sort();

      const Products = await productRepository.lockByIds(Tx, ProductIds);

      const ProductById = new Map(
        Products.map((Product) => [Product.Id, Product]),
      );
      for (const ProductId of ProductIds) {
        if (
          !ProductById.has(ProductId) ||
          ProductById.get(ProductId)!.IsDeleted
        ) {
          throw new NotFoundError(`Product ${ProductId} not found`);
        }
      }

      const RequestedQuantityByProductId = new Map<string, number>();
      for (const Item of LineItems) {
        RequestedQuantityByProductId.set(
          Item.productId,
          (RequestedQuantityByProductId.get(Item.productId) ?? 0) +
            Item.quantity,
        );
      }

      for (const [
        ProductId,
        RequestedQuantity,
      ] of RequestedQuantityByProductId) {
        const Product = ProductById.get(ProductId)!;
        if (Product.StockQuantity < RequestedQuantity) {
          throw new InsufficientStockError(Product.Sku, Product.StockQuantity);
        }
      }

      for (const Item of LineItems) {
        const Product = ProductById.get(Item.productId)!;
        Product.StockQuantity -= Item.quantity;
      }
      await productRepository.saveMany(Tx, Products);

      const PointsInTrailing90Days = await getTrailingNinetyDayPoints(
        DistributorId,
        Tx,
      );
      const Tier = calculateTier(PointsInTrailing90Days);
      const DiscountPercent = getDiscountForTier(Tier);

      const Subtotal = roundCurrency(
        LineItems.reduce((Sum, Item) => {
          const Product = ProductById.get(Item.productId)!;
          return Sum + Number(Product.UnitPrice) * Item.quantity;
        }, 0),
      );
      const Total = roundCurrency(
        Subtotal - Subtotal * (DiscountPercent / 100),
      );

      const AvailableCredit = await getAvailableCredit(
        DistributorId,
        Number(Distributor.CreditLimit),
        Tx,
      );

      const Status =
        Total <= AvailableCredit
          ? OrderStatus.Confirmed
          : OrderStatus.PendingApproval;

      const Order = await orderRepository.create(Tx, {
        Distributor: Distributor,
        Status: OrderStatus.Placed,
        DiscountPercent: DiscountPercent,
        Subtotal: Subtotal,
        Total: Total,
        IdempotencyKey: IdempotencyKey ?? null,
      });

      const SavedLineItems = await orderLineItemRepository.createMany(
        Tx,
        LineItems.map((Item) => ({
          Order: Order,
          Product: ProductById.get(Item.productId)!,
          Quantity: Item.quantity,
          UnitPrice: ProductById.get(Item.productId)!.UnitPrice,
        })),
      );

      PlacementOutboundEvents.push(
        await recordStatusChange(
          Tx,
          Order,
          null,
          OrderStatus.Placed,
          ActorTypeEnum.Distributor,
          DistributorId,
        ),
      );
      const Transition = await runTransition(
        Tx,
        Order.Id,
        Status,
        ActorTypeEnum.System,
        null,
      );
      PlacementOutboundEvents.push(Transition.OutboundEvent!);
      Order.Status = Status;

      if (Status === OrderStatus.Confirmed) {
        PointsAwarded = calculatePointsEarned(Total);
        await pointsLedgerRepository.addEntry(Tx, {
          Distributor: Distributor,
          Order: Order,
          Points: PointsAwarded,
        });
      }

      Order.LineItems = SavedLineItems.map((LineItem) => ({
        ...LineItem,
        Order: undefined as unknown as OrderEntity,
      }));
      return Order;
    });
  } catch (Err) {
    if (IdempotencyKey && isUniqueViolation(Err)) {
      const Existing =
        await orderRepository.findByIdempotencyKeyWithLineItems(IdempotencyKey);
      if (Existing) {
        assertSamePlacementRequest(Existing, DistributorId, LineItems);
        logger.info("Order placement replayed (idempotency key race)", {
          orderId: Existing.Id,
          distributorId: DistributorId,
        });
        return Existing;
      }
    }
    throw Err;
  }

  logger.info("Order placed", {
    orderId: Order.Id,
    distributorId: DistributorId,
    status: Order.Status,
    subtotal: Order.Subtotal,
    discountPercent: Order.DiscountPercent,
    total: Order.Total,
  });
  logger.info("Stock reserved", {
    orderId: Order.Id,
    items: Order.LineItems.map((Item) => ({
      productId: Item.Product.Id,
      sku: Item.Product.Sku,
      quantity: Item.Quantity,
    })),
  });
  if (Order.Status === OrderStatus.Confirmed) {
    logger.info("Loyalty points awarded", {
      orderId: Order.Id,
      distributorId: DistributorId,
      points: PointsAwarded,
    });
  }

  await deliverOutboundEvents(PlacementOutboundEvents);
  return Order;
}

export interface PaginatedOrders {
  items: OrderEntity[];
  total: number;
}

export interface OrderListFilters {
  Page: number;
  Limit: number;
  DistributorId?: string;
  Status?: OrderStatus;
  Search?: string;
  SortField: string;
  SortDirection: "ASC" | "DESC";
}

export async function getOrdersPaginated(
  Filters: OrderListFilters,
): Promise<PaginatedOrders> {
  const IncludeDistributor = !Filters.DistributorId;

  const [Items, Total] = await orderRepository.findPaginated({
    ...Filters,
    IncludeDistributor,
  });
  return { items: Items, total: Total };
}

export async function getOrdersForDistributor(
  DistributorId: string,
  Filters: Omit<OrderListFilters, "DistributorId">,
): Promise<PaginatedOrders> {
  return getOrdersPaginated({ ...Filters, DistributorId });
}

export async function getOrderById(
  OrderId: string,
): Promise<OrderEntity | null> {
  const Order = await orderRepository.findDetailById(OrderId);

  if (Order?.Events) {
    Order.Events = [...Order.Events].sort(
      (A, B) =>
        new Date(A.CreatedAt).getTime() - new Date(B.CreatedAt).getTime() ||
        Number(A.Sequence) - Number(B.Sequence),
    );
  }

  return Order;
}

export const AllowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.Placed]: [
    OrderStatus.Confirmed,
    OrderStatus.PendingApproval,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.PendingApproval]: [
    OrderStatus.Confirmed,
    OrderStatus.Rejected,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.Confirmed]: [OrderStatus.Dispatched, OrderStatus.Cancelled],
  [OrderStatus.Dispatched]: [OrderStatus.Delivered],
};

interface TransitionResult {
  Order: OrderEntity;
  PreviousStatus: OrderStatus;
  OutboundEvent: OutboundEventEntity | null;
  Replayed: boolean;
}

async function runTransition(
  Tx: TransactionContext,
  OrderId: string,
  NewStatus: OrderStatus,
  ActorType: ActorTypeEnum,
  ActorId: string | null,
  IdempotencyKey?: string,
): Promise<TransitionResult> {
  const Order = await orderRepository.lockByIdWithDistributor(Tx, OrderId);

  if (!Order) {
    throw new NotFoundError(`Order ${OrderId} not found`);
  }

  if (IdempotencyKey) {
    const Previous = await orderEventRepository.findByIdempotencyKeyWithOrder(
      Tx,
      IdempotencyKey,
    );
    if (Previous) {
      if (
        Previous.Order.Id !== OrderId ||
        Previous.ToStatus !== NewStatus ||
        Previous.ActorType !== ActorType ||
        Previous.ActorId !== ActorId
      ) {
        throw new IdempotencyKeyConflictError(
          "This idempotency key was already used for a different request",
        );
      }
      return {
        Order,
        PreviousStatus: Previous.FromStatus as OrderStatus,
        OutboundEvent: null,
        Replayed: true,
      };
    }
  }

  const CurrentStatus = Order.Status;

  const AllowedNextStatuses = AllowedTransitions[CurrentStatus] ?? [];
  if (!AllowedNextStatuses.includes(NewStatus)) {
    throw new InvalidTransitionError(CurrentStatus, NewStatus);
  }

  Order.Status = NewStatus;
  await orderRepository.save(Tx, Order);

  const OutboundEvent = await recordStatusChange(
    Tx,
    Order,
    CurrentStatus,
    NewStatus,
    ActorType,
    ActorId,
    IdempotencyKey,
  );

  return {
    Order,
    PreviousStatus: CurrentStatus,
    OutboundEvent,
    Replayed: false,
  };
}

async function recordStatusChange(
  Tx: TransactionContext,
  Order: OrderEntity,
  FromStatus: OrderStatus | null,
  ToStatus: OrderStatus,
  ActorType: ActorTypeEnum,
  ActorId: string | null,
  IdempotencyKey?: string,
): Promise<OutboundEventEntity> {
  const Event = await orderEventRepository.append(Tx, {
    OrderId: Order.Id,
    FromStatus: FromStatus,
    ToStatus: ToStatus,
    ActorType: ActorType,
    ActorId: ActorId,
    IdempotencyKey: IdempotencyKey ?? null,
  });
  return createOutboundEvent(Tx, Order, Event, ErpEventType);
}

function logTransition(
  Result: TransitionResult,
  NewStatus: OrderStatus,
  ActorType: ActorTypeEnum,
  ActorId: string | null,
): void {
  const Context = {
    orderId: Result.Order.Id,
    fromStatus: Result.PreviousStatus,
    toStatus: NewStatus,
    actorType: ActorType,
    actorId: ActorId,
  };
  if (Result.Replayed) {
    logger.info("Order status change replayed (idempotency key)", Context);
  } else {
    logger.info("Order status changed", Context);
  }
}

async function deliverTransitionEvent(
  OutboundEvent: OutboundEventEntity | null,
): Promise<void> {
  if (OutboundEvent) await deliverOutboundEvents([OutboundEvent]);
}

export async function transitionOrder(
  OrderId: string,
  NewStatus: OrderStatus,
  ActorType: ActorTypeEnum,
  ActorId: string | null,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  const Result = await runInTransaction((Tx) =>
    runTransition(Tx, OrderId, NewStatus, ActorType, ActorId, IdempotencyKey),
  );
  logTransition(Result, NewStatus, ActorType, ActorId);
  await deliverTransitionEvent(Result.OutboundEvent);
  return Result.Order;
}

export interface ReleasedStockItem {
  productId: string;
  sku: string;
  quantity: number;
}

async function releaseStock(
  Tx: TransactionContext,
  OrderId: string,
): Promise<ReleasedStockItem[]> {
  const LineItems = await orderLineItemRepository.findByOrderIdWithProduct(
    Tx,
    OrderId,
  );

  for (const LineItem of LineItems) {
    await productRepository.incrementStock(
      Tx,
      LineItem.Product.Id,
      LineItem.Quantity,
    );
  }

  return LineItems.map((LineItem) => ({
    productId: LineItem.Product.Id,
    sku: LineItem.Product.Sku,
    quantity: LineItem.Quantity,
  }));
}

function logStockReleased(OrderId: string, Items: ReleasedStockItem[]): void {
  logger.info("Stock released", { orderId: OrderId, items: Items });
}

async function reversePoints(
  Tx: TransactionContext,
  OrderId: string,
): Promise<number> {
  const Entries = await pointsLedgerRepository.findByOrderIdWithDistributor(
    Tx,
    OrderId,
  );
  const NetPoints = Entries.reduce((Sum, Entry) => Sum + Entry.Points, 0);

  if (Entries.length === 0 || NetPoints <= 0) {
    return 0;
  }

  await pointsLedgerRepository.addEntry(Tx, {
    Distributor: Entries[0].Distributor,
    Order: { Id: OrderId } as OrderEntity,
    Points: -NetPoints,
  });
  return NetPoints;
}

export async function getPendingApprovalOrders(
  Filters: Omit<OrderListFilters, "Status" | "DistributorId">,
): Promise<PaginatedOrders> {
  return getOrdersPaginated({
    ...Filters,
    Status: OrderStatus.PendingApproval,
  });
}

export async function approveOrder(
  OrderId: string,
  ActorId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  const { Result, PointsAwarded } = await runInTransaction(async (Tx) => {
    const Result = await runTransition(
      Tx,
      OrderId,
      OrderStatus.Confirmed,
      ActorTypeEnum.SalesManager,
      ActorId,
      IdempotencyKey,
    );
    if (Result.Replayed) return { Result, PointsAwarded: null };

    if (Result.PreviousStatus !== OrderStatus.PendingApproval) {
      throw new InvalidTransitionError(
        Result.PreviousStatus,
        OrderStatus.Confirmed,
      );
    }

    const PointsAwarded = calculatePointsEarned(Number(Result.Order.Total));
    await pointsLedgerRepository.addEntry(Tx, {
      Distributor: Result.Order.Distributor,
      Order: Result.Order,
      Points: PointsAwarded,
    });

    return { Result, PointsAwarded };
  });

  logTransition(
    Result,
    OrderStatus.Confirmed,
    ActorTypeEnum.SalesManager,
    ActorId,
  );
  if (PointsAwarded !== null) {
    logger.info("Loyalty points awarded", {
      orderId: Result.Order.Id,
      distributorId: Result.Order.Distributor?.Id,
      points: PointsAwarded,
    });
  }
  await deliverTransitionEvent(Result.OutboundEvent);
  return Result.Order;
}

export async function rejectOrder(
  OrderId: string,
  ActorId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  const { Result, Released } = await runInTransaction(async (Tx) => {
    const Result = await runTransition(
      Tx,
      OrderId,
      OrderStatus.Rejected,
      ActorTypeEnum.SalesManager,
      ActorId,
      IdempotencyKey,
    );
    const Released = Result.Replayed
      ? null
      : await releaseStock(Tx, Result.Order.Id);
    return { Result, Released };
  });

  logTransition(
    Result,
    OrderStatus.Rejected,
    ActorTypeEnum.SalesManager,
    ActorId,
  );
  if (Released) logStockReleased(Result.Order.Id, Released);
  await deliverTransitionEvent(Result.OutboundEvent);
  return Result.Order;
}

export async function cancelOrder(
  OrderId: string,
  ActorType: ActorTypeEnum,
  ActorId: string | null,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  const { Result, Released, PointsReversed } = await runInTransaction(
    async (Tx) => {
      const Result = await runTransition(
        Tx,
        OrderId,
        OrderStatus.Cancelled,
        ActorType,
        ActorId,
        IdempotencyKey,
      );
      if (Result.Replayed) {
        return { Result, Released: null, PointsReversed: null };
      }
      const { PreviousStatus } = Result;

      let Released: ReleasedStockItem[] | null = null;
      let PointsReversed: number | null = null;
      if (
        PreviousStatus === OrderStatus.Placed ||
        PreviousStatus === OrderStatus.PendingApproval
      ) {
        Released = await releaseStock(Tx, Result.Order.Id);
      } else if (PreviousStatus === OrderStatus.Confirmed) {
        Released = await releaseStock(Tx, Result.Order.Id);
        PointsReversed = await reversePoints(Tx, Result.Order.Id);
      }

      return { Result, Released, PointsReversed };
    },
  );

  logTransition(Result, OrderStatus.Cancelled, ActorType, ActorId);
  if (Released) logStockReleased(Result.Order.Id, Released);
  if (PointsReversed !== null) {
    logger.info("Loyalty points reversed", {
      orderId: Result.Order.Id,
      distributorId: Result.Order.Distributor?.Id,
      points: PointsReversed,
    });
  }
  await deliverTransitionEvent(Result.OutboundEvent);
  return Result.Order;
}

export async function cancelOrderAsActor(
  OrderId: string,
  ActorType: ActorTypeEnum,
  ActorId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  if (ActorType === ActorTypeEnum.Distributor) {
    const Existing = await getOrderById(OrderId);
    if (!Existing || Existing.Distributor.Id !== ActorId) {
      throw new NotFoundError(`Order ${OrderId} not found`);
    }
  }
  return cancelOrder(OrderId, ActorType, ActorId, IdempotencyKey);
}

export async function dispatchOrder(
  OrderId: string,
  ActorId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  return transitionOrder(
    OrderId,
    OrderStatus.Dispatched,
    ActorTypeEnum.SalesManager,
    ActorId,
    IdempotencyKey,
  );
}

export async function deliverOrder(
  OrderId: string,
  ActorId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  return transitionOrder(
    OrderId,
    OrderStatus.Delivered,
    ActorTypeEnum.SalesManager,
    ActorId,
    IdempotencyKey,
  );
}
