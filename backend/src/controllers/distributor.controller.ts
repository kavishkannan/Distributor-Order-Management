import { NextFunction, Request, Response } from "express";
import { OrderStatus } from "../models/OrderEntity";
import { UserRole } from "../models/UserEntity";
import {
  IdempotencyKeyConflictError,
  InvalidTransitionError,
  NotFoundError as OrderNotFoundError,
} from "../services/order.service";
import {
  cancelOwnOrder,
  getDistributorDashboard as getDistributorDashboardService,
  getDistributorOrders as getDistributorOrdersService,
  getDistributorProfile,
  getLoyaltyById as getLoyaltyByIdService,
  getOwnOrderById,
  NotFoundError,
} from "../services/distributor.service";
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

function requireDistributorId(Req: Request, Res: Response): string | null {
  const DistributorId = Req.params.id;
  if (!isUuid(DistributorId)) {
    sendValidationError(Res, [
      { field: "id", message: "Distributor id must be a UUID" },
    ]);
    return null;
  }
  return DistributorId;
}

function requireOwnDistributorId(Req: Request, Res: Response): string | null {
  const DistributorId = requireDistributorId(Req, Res);
  if (!DistributorId) return null;

  if (DistributorId !== Req.user?.distributorId) {
    Res.status(403).json({
      message: "You do not have access to this distributor's resources",
    });
    return null;
  }
  return DistributorId;
}

function handleDistributorServiceError(
  Err: unknown,
  Res: Response,
  Next: NextFunction,
): void {
  if (Err instanceof NotFoundError || Err instanceof OrderNotFoundError) {
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
  if (Err instanceof IdempotencyKeyConflictError) {
    Res.status(422).json({ message: Err.message });
    return;
  }
  Next(Err);
}

export async function getDistributorById(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const DistributorId =
    Req.user?.role === UserRole.SalesManager
      ? requireDistributorId(Req, Res)
      : requireOwnDistributorId(Req, Res);
  if (!DistributorId) return;

  try {
    const Profile = await getDistributorProfile(DistributorId);
    Res.json(Profile);
  } catch (Err) {
    handleDistributorServiceError(Err, Res, Next);
  }
}

export async function getDashboard(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const DistributorId = requireOwnDistributorId(Req, Res);
  if (!DistributorId) return;

  try {
    const Dashboard = await getDistributorDashboardService(DistributorId);
    Res.json(Dashboard);
  } catch (Err) {
    handleDistributorServiceError(Err, Res, Next);
  }
}

export async function getOrders(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const DistributorId = requireOwnDistributorId(Req, Res);
  if (!DistributorId) return;

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
    return;
  }

  try {
    const { Page, Limit } = Pagination.value;
    const Result = await getDistributorOrdersService(DistributorId, {
      page: Page,
      limit: Limit,
      status: Status.value,
      search: Search.value,
      sortField: SortField.value,
      sortDirection: SortDirection.value,
    });
    Res.json(toListResponse(Result.items, Page, Limit, Result.total));
  } catch (Err) {
    handleDistributorServiceError(Err, Res, Next);
  }
}

export async function getOrderById(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const DistributorId = requireOwnDistributorId(Req, Res);
  if (!DistributorId) return;

  const OrderId = Req.params.orderId;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "orderId", message: "Order id must be a UUID" },
    ]);
    return;
  }

  try {
    const Order = await getOwnOrderById(DistributorId, OrderId);
    if (!Order) {
      Res.status(404).json({ message: `Order ${OrderId} not found` });
      return;
    }
    Res.json(Order);
  } catch (Err) {
    handleDistributorServiceError(Err, Res, Next);
  }
}

export async function cancelOrder(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const DistributorId = requireOwnDistributorId(Req, Res);
  if (!DistributorId) return;

  const OrderId = Req.params.orderId;
  if (!isUuid(OrderId)) {
    sendValidationError(Res, [
      { field: "orderId", message: "Order id must be a UUID" },
    ]);
    return;
  }
  const Idem = readIdempotencyKey(Req, Res);
  if (!Idem) return;

  try {
    const Order = await cancelOwnOrder(DistributorId, OrderId, Idem.key);
    Res.json(Order);
  } catch (Err) {
    handleDistributorServiceError(Err, Res, Next);
  }
}

export async function getLoyaltyById(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const DistributorId = requireOwnDistributorId(Req, Res);
  if (!DistributorId) return;

  try {
    const Summary = await getLoyaltyByIdService(DistributorId);
    Res.json(Summary);
  } catch (Err) {
    handleDistributorServiceError(Err, Res, Next);
  }
}
