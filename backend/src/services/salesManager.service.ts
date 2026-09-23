import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum } from "../models/OrderEventEntity";
import { salesManagerRepository } from "../repositories/salesManager.repository";
import {
  approveOrder as approveOrderService,
  cancelOrder as cancelOrderService,
  deliverOrder as deliverOrderService,
  dispatchOrder as dispatchOrderService,
  getOrderById as getOrderByIdService,
  getOrdersPaginated,
  NotFoundError,
  PaginatedOrders,
  rejectOrder as rejectOrderService,
} from "./order.service";

async function requireActiveSalesManager(
  SalesManagerId: string,
): Promise<void> {
  const SalesManager = await salesManagerRepository.findById(SalesManagerId);
  if (!SalesManager || SalesManager.IsDeleted) {
    throw new NotFoundError(`Sales manager ${SalesManagerId} not found`);
  }
}

export interface OrderListQuery {
  page: number;
  limit: number;
  status?: OrderStatus;
  search?: string;
  sortField: string;
  sortDirection: "ASC" | "DESC";
}

export async function getAllOrders(
  Query: OrderListQuery,
): Promise<PaginatedOrders> {
  return getOrdersPaginated({
    Page: Query.page,
    Limit: Query.limit,
    Status: Query.status,
    Search: Query.search,
    SortField: Query.sortField,
    SortDirection: Query.sortDirection,
  });
}

export async function getPendingApprovalOrders(
  Query: Omit<OrderListQuery, "status">,
): Promise<PaginatedOrders> {
  return getOrdersPaginated({
    Page: Query.page,
    Limit: Query.limit,
    Status: OrderStatus.PendingApproval,
    Search: Query.search,
    SortField: Query.sortField,
    SortDirection: Query.sortDirection,
  });
}

export async function getOrderById(
  OrderId: string,
): Promise<OrderEntity | null> {
  return getOrderByIdService(OrderId);
}

export async function approveOrder(
  SalesManagerId: string,
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  await requireActiveSalesManager(SalesManagerId);
  return approveOrderService(OrderId, SalesManagerId, IdempotencyKey);
}

export async function rejectOrder(
  SalesManagerId: string,
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  await requireActiveSalesManager(SalesManagerId);
  return rejectOrderService(OrderId, SalesManagerId, IdempotencyKey);
}

export async function cancelOrder(
  SalesManagerId: string,
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  await requireActiveSalesManager(SalesManagerId);
  return cancelOrderService(
    OrderId,
    ActorTypeEnum.SalesManager,
    SalesManagerId,
    IdempotencyKey,
  );
}

export async function dispatchOrder(
  SalesManagerId: string,
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  await requireActiveSalesManager(SalesManagerId);
  return dispatchOrderService(OrderId, SalesManagerId, IdempotencyKey);
}

export async function deliverOrder(
  SalesManagerId: string,
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  await requireActiveSalesManager(SalesManagerId);
  return deliverOrderService(OrderId, SalesManagerId, IdempotencyKey);
}
