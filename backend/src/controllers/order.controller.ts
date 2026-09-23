import { NextFunction, Request, Response } from "express";
import { ActorTypeEnum } from "../models/OrderEventEntity";
import { OrderStatus } from "../models/OrderEntity";
import {
  approveOrder as approveOrderService,
  cancelOrderAsActor as cancelOrderAsActorService,
  deliverOrder as deliverOrderService,
  dispatchOrder as dispatchOrderService,
  getOrdersPaginated,
  getOrderById as getOrderByIdService,
  getPendingApprovalOrders as getPendingApprovalOrdersService,
  IdempotencyKeyConflictError,
  InsufficientStockError,
  InvalidTransitionError,
  NotFoundError,
  placeOrder as placeOrderService,
  PlaceOrderLineItemInput,
  rejectOrder as rejectOrderService,
} from "../services/order.service";
import {
  isUuid,
  OrderSortFieldMap,
  MaxIdempotencyKeyLength,
  parseEnum,
  parsePagination,
  parseSearch,
  parseSortDirection,
  parseSortField,
  readIdempotencyKey,
  sendValidationError,
  toListResponse,
  ValidationIssue,
} from "../utils/validators";

const OrderStatusValues = Object.values(OrderStatus);

const MaxLineItemsPerOrder = 100;
const MaxQuantityPerLineItem = 10_000;

function handleOrderServiceError(
  Err: unknown,
  Res: Response,
  Next: NextFunction,
): void {
  if (Err instanceof IdempotencyKeyConflictError) {
    Res.status(422).json({ message: Err.message });
    return;
  }
  if (Err instanceof InvalidTransitionError) {
    Res.status(409).json({
      message: Err.message,
      fromStatus: Err.fromStatus,
      toStatus: Err.toStatus,
    });
    return;
  }
  if (Err instanceof NotFoundError) {
    Res.status(404).json({ message: Err.message });
    return;
  }
  Next(Err);
}

interface PlaceOrderRequestBody {
  lineItems?: unknown;
  idempotencyKey?: unknown;
}

function parsePlaceOrderBody(
  Body: PlaceOrderRequestBody,
):
  | { value: { lineItems: PlaceOrderLineItemInput[]; idempotencyKey?: string } }
  | { issues: ValidationIssue[] } {
  const Issues: ValidationIssue[] = [];

  if (
    Body.idempotencyKey !== undefined &&
    (typeof Body.idempotencyKey !== "string" ||
      Body.idempotencyKey.length === 0 ||
      Body.idempotencyKey.length > MaxIdempotencyKeyLength)
  ) {
    Issues.push({
      field: "idempotencyKey",
      message: `idempotencyKey must be a 1-${MaxIdempotencyKeyLength} character string when provided`,
    });
  }

  const LineItems: PlaceOrderLineItemInput[] = [];
  if (!Array.isArray(Body.lineItems) || Body.lineItems.length === 0) {
    Issues.push({
      field: "lineItems",
      message: "lineItems is required and must be a non-empty array",
    });
  } else if (Body.lineItems.length > MaxLineItemsPerOrder) {
    Issues.push({
      field: "lineItems",
      message: `lineItems must contain at most ${MaxLineItemsPerOrder} entries`,
    });
  } else {
    Body.lineItems.forEach((RawItem, Index) => {
      if (typeof RawItem !== "object" || RawItem === null) {
        Issues.push({
          field: `lineItems[${Index}]`,
          message: "each line item must be an object",
        });
        return;
      }
      const Item = RawItem as { productId?: unknown; quantity?: unknown };
      if (!isUuid(Item.productId)) {
        Issues.push({
          field: `lineItems[${Index}].productId`,
          message: "productId is required and must be a UUID",
        });
      }
      if (
        typeof Item.quantity !== "number" ||
        !Number.isInteger(Item.quantity) ||
        Item.quantity <= 0
      ) {
        Issues.push({
          field: `lineItems[${Index}].quantity`,
          message: "quantity must be an integer greater than 0",
        });
      } else if (Item.quantity > MaxQuantityPerLineItem) {
        Issues.push({
          field: `lineItems[${Index}].quantity`,
          message: `quantity must be at most ${MaxQuantityPerLineItem}`,
        });
      }
      if (
        isUuid(Item.productId) &&
        typeof Item.quantity === "number" &&
        Number.isInteger(Item.quantity) &&
        Item.quantity > 0
      ) {
        LineItems.push({ productId: Item.productId, quantity: Item.quantity });
      }
    });
  }

  if (Issues.length > 0) return { issues: Issues };

  return {
    value: {
      lineItems: LineItems,
      idempotencyKey: Body.idempotencyKey as string | undefined,
    },
  };
}

export async function placeOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = parsePlaceOrderBody(Req.body ?? {});
  if ("issues" in Parsed) {
    sendValidationError(Res, Parsed.issues);
    return;
  }
  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return;
  Parsed.value.idempotencyKey ??= Idem.key;

  try {
    const Order = await placeOrderService({
      ...Parsed.value,
      distributorId: Req.user!.distributorId!,
    });
    Res.status(201).json(Order);
  } catch (Err) {
    if (Err instanceof InsufficientStockError) {
      Res.status(409).json({
        message: Err.message,
        sku: Err.sku,
        availableQuantity: Err.availableQuantity,
      });
      return;
    }
    if (Err instanceof NotFoundError) {
      Res.status(404).json({ message: Err.message });
      return;
    }
    if (Err instanceof IdempotencyKeyConflictError) {
      Res.status(422).json({ message: Err.message });
      return;
    }
    Next(Err);
  }
}

export async function getAllOrders(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const { distributorId } = Req.query;

  const Pagination = parsePagination(Req.query.page, Req.query.limit);
  const Status = parseEnum(Req.query.status, OrderStatusValues, "status");
  const Search = parseSearch(Req.query.search);
  const SortField = parseSortField(
    Req.query.sortBy,
    OrderSortFieldMap,
    "CreatedAt",
  );
  const SortDirection = parseSortDirection(Req.query.sortOrder);

  const Issues: ValidationIssue[] = [...Pagination.issues];
  if (distributorId !== undefined && !isUuid(distributorId)) {
    Issues.push({
      field: "distributorId",
      message: "distributorId must be a UUID",
    });
  }
  for (const Field of [Status, Search, SortField, SortDirection]) {
    if (Field.issue) Issues.push(Field.issue);
  }
  if (Issues.length > 0) {
    sendValidationError(Res, Issues);
    return;
  }

  try {
    const { Page, Limit } = Pagination.value;
    const Result = await getOrdersPaginated({
      Page,
      Limit,
      DistributorId: distributorId as string | undefined,
      Status: Status.value,
      Search: Search.value,
      SortField: SortField.value,
      SortDirection: SortDirection.value,
    });
    Res.json(toListResponse(Result.items, Page, Limit, Result.total));
  } catch (Err) {
    Next(Err);
  }
}

export async function getOrderById(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const OrderId = Req.params.id;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "id", message: "Order id must be a UUID" },
    ]);
    return;
  }

  try {
    const Order = await getOrderByIdService(OrderId);
    if (!Order) {
      Res.status(404).json({ message: `Order ${OrderId} not found` });
      return;
    }
    Res.json(Order);
  } catch (Err) {
    Next(Err);
  }
}

export async function getPendingApprovalOrders(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Pagination = parsePagination(Req.query.page, Req.query.limit);
  const Search = parseSearch(Req.query.search);
  const SortField = parseSortField(
    Req.query.sortBy,
    OrderSortFieldMap,
    "CreatedAt",
  );
  const SortDirection = parseSortDirection(Req.query.sortOrder);

  const Issues: ValidationIssue[] = [...Pagination.issues];
  for (const Field of [Search, SortField, SortDirection]) {
    if (Field.issue) Issues.push(Field.issue);
  }
  if (Issues.length > 0) {
    sendValidationError(Res, Issues);
    return;
  }

  try {
    const { Page, Limit } = Pagination.value;
    const Result = await getPendingApprovalOrdersService({
      Page,
      Limit,
      Search: Search.value,
      SortField: SortField.value,
      SortDirection: SortDirection.value,
    });
    Res.json(toListResponse(Result.items, Page, Limit, Result.total));
  } catch (Err) {
    Next(Err);
  }
}

export async function approveOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const OrderId = Req.params.id;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "id", message: "Order id must be a UUID" },
    ]);
    return;
  }
  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return;

  try {
    const Order = await approveOrderService(
      OrderId,
      Req.user!.salesManagerId!,
      Idem.key,
    );
    Res.json(Order);
  } catch (Err) {
    handleOrderServiceError(Err, Res, Next);
  }
}

export async function rejectOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const OrderId = Req.params.id;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "id", message: "Order id must be a UUID" },
    ]);
    return;
  }
  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return;

  try {
    const Order = await rejectOrderService(
      OrderId,
      Req.user!.salesManagerId!,
      Idem.key,
    );
    Res.json(Order);
  } catch (Err) {
    handleOrderServiceError(Err, Res, Next);
  }
}

function actorFromAuthenticatedUser(Req: Request): {
  ActorType: ActorTypeEnum;
  ActorId: string;
} {
  if (Req.user!.role === "DISTRIBUTOR") {
    return {
      ActorType: ActorTypeEnum.Distributor,
      ActorId: Req.user!.distributorId!,
    };
  }
  return {
    ActorType: ActorTypeEnum.SalesManager,
    ActorId: Req.user!.salesManagerId!,
  };
}

export async function cancelOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const OrderId = Req.params.id;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "id", message: "Order id must be a UUID" },
    ]);
    return;
  }
  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return;

  const { ActorType, ActorId } = actorFromAuthenticatedUser(Req);

  try {
    const Order = await cancelOrderAsActorService(
      OrderId,
      ActorType,
      ActorId,
      Idem.key,
    );
    Res.json(Order);
  } catch (Err) {
    handleOrderServiceError(Err, Res, Next);
  }
}

export async function dispatchOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const OrderId = Req.params.id;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "id", message: "Order id must be a UUID" },
    ]);
    return;
  }
  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return;

  try {
    const Order = await dispatchOrderService(
      OrderId,
      Req.user!.salesManagerId!,
      Idem.key,
    );
    Res.json(Order);
  } catch (Err) {
    handleOrderServiceError(Err, Res, Next);
  }
}

export async function deliverOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const OrderId = Req.params.id;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "id", message: "Order id must be a UUID" },
    ]);
    return;
  }
  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return;

  try {
    const Order = await deliverOrderService(
      OrderId,
      Req.user!.salesManagerId!,
      Idem.key,
    );
    Res.json(Order);
  } catch (Err) {
    handleOrderServiceError(Err, Res, Next);
  }
}
