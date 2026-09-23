import { NextFunction, Request, Response } from "express";
import { OrderStatus } from "../models/OrderEntity";
import {
  IdempotencyKeyConflictError,
  InvalidTransitionError,
  NotFoundError,
} from "../services/order.service";
import {
  approveOrder as approveOrderService,
  cancelOrder as cancelOrderService,
  deliverOrder as deliverOrderService,
  dispatchOrder as dispatchOrderService,
  getAllOrders as getAllOrdersService,
  getOrderById as getOrderByIdService,
  getPendingApprovalOrders as getPendingApprovalOrdersService,
  rejectOrder as rejectOrderService,
} from "../services/salesManager.service";
import {
  isUuid,
  OrderSortFieldMap,
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

function handleSalesManagerServiceError(
  Err: unknown,
  Res: Response,
  Next: NextFunction,
): void {
  if (Err instanceof IdempotencyKeyConflictError) {
    Res.status(422).json({ message: Err.message });
    return;
  }
  if (Err instanceof NotFoundError) {
    Res.status(404).json({ message: Err.message });
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
  Next(Err);
}

interface ParsedListQuery {
  Page: number;
  Limit: number;
  Status?: OrderStatus;
  Search?: string;
  SortField: string;
  SortDirection: "ASC" | "DESC";
}

function parseListQuery(Req: Request, Res: Response): ParsedListQuery | null {
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
  for (const Field of [Status, Search, SortField, SortDirection]) {
    if (Field.issue) Issues.push(Field.issue);
  }

  if (Issues.length > 0) {
    sendValidationError(Res, Issues);
    return null;
  }

  return {
    Page: Pagination.value.Page,
    Limit: Pagination.value.Limit,
    Status: Status.value,
    Search: Search.value,
    SortField: SortField.value,
    SortDirection: SortDirection.value,
  };
}

function requireOrderIdAndActorId(
  Req: Request,
  Res: Response,
): {
  OrderId: string;
  ActorId: string;
  IdempotencyKey: string | undefined;
} | null {
  const OrderId = Req.params.id;

  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "id", message: "Order id must be a UUID" },
    ]);
    return null;
  }

  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return null;

  return {
    OrderId,
    ActorId: Req.user!.salesManagerId!,
    IdempotencyKey: Idem.key,
  };
}

export async function getAllOrders(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = parseListQuery(Req, Res);
  if (!Parsed) return;

  try {
    const Result = await getAllOrdersService({
      page: Parsed.Page,
      limit: Parsed.Limit,
      status: Parsed.Status,
      search: Parsed.Search,
      sortField: Parsed.SortField,
      sortDirection: Parsed.SortDirection,
    });
    Res.json(
      toListResponse(Result.items, Parsed.Page, Parsed.Limit, Result.total),
    );
  } catch (Err) {
    handleSalesManagerServiceError(Err, Res, Next);
  }
}

export async function getPendingApprovals(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = parseListQuery(Req, Res);
  if (!Parsed) return;

  try {
    const Result = await getPendingApprovalOrdersService({
      page: Parsed.Page,
      limit: Parsed.Limit,
      search: Parsed.Search,
      sortField: Parsed.SortField,
      sortDirection: Parsed.SortDirection,
    });
    Res.json(
      toListResponse(Result.items, Parsed.Page, Parsed.Limit, Result.total),
    );
  } catch (Err) {
    handleSalesManagerServiceError(Err, Res, Next);
  }
}

export async function getOrderById(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const OrderId = Req.params.orderId;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "orderId", message: "Order id must be a UUID" },
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

export async function approveOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = requireOrderIdAndActorId(Req, Res);
  if (!Parsed) return;

  try {
    const Order = await approveOrderService(
      Parsed.ActorId,
      Parsed.OrderId,
      Parsed.IdempotencyKey,
    );
    Res.json(Order);
  } catch (Err) {
    handleSalesManagerServiceError(Err, Res, Next);
  }
}

export async function rejectOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = requireOrderIdAndActorId(Req, Res);
  if (!Parsed) return;

  try {
    const Order = await rejectOrderService(
      Parsed.ActorId,
      Parsed.OrderId,
      Parsed.IdempotencyKey,
    );
    Res.json(Order);
  } catch (Err) {
    handleSalesManagerServiceError(Err, Res, Next);
  }
}

export async function cancelOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = requireOrderIdAndActorId(Req, Res);
  if (!Parsed) return;

  try {
    const Order = await cancelOrderService(
      Parsed.ActorId,
      Parsed.OrderId,
      Parsed.IdempotencyKey,
    );
    Res.json(Order);
  } catch (Err) {
    handleSalesManagerServiceError(Err, Res, Next);
  }
}

export async function dispatchOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = requireOrderIdAndActorId(Req, Res);
  if (!Parsed) return;

  try {
    const Order = await dispatchOrderService(
      Parsed.ActorId,
      Parsed.OrderId,
      Parsed.IdempotencyKey,
    );
    Res.json(Order);
  } catch (Err) {
    handleSalesManagerServiceError(Err, Res, Next);
  }
}

export async function deliverOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = requireOrderIdAndActorId(Req, Res);
  if (!Parsed) return;

  try {
    const Order = await deliverOrderService(
      Parsed.ActorId,
      Parsed.OrderId,
      Parsed.IdempotencyKey,
    );
    Res.json(Order);
  } catch (Err) {
    handleSalesManagerServiceError(Err, Res, Next);
  }
}
