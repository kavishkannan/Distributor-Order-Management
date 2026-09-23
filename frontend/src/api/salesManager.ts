import { ApiClient, idempotencyHeaders } from "./client";
import { ListResponse } from "./types";
import { DistributorDto, OrderDto, OrderSummaryDto } from "./orders";

export interface SalesManagerOrderSummaryDto extends OrderSummaryDto {
  Distributor: DistributorDto;
}

export interface GetOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export async function getAllOrders(
  Params: GetOrdersParams = {},
): Promise<ListResponse<SalesManagerOrderSummaryDto>> {
  const Response = await ApiClient.get<
    ListResponse<SalesManagerOrderSummaryDto>
  >("/salesmanager/getallorders", {
    params: Params,
  });
  return Response.data;
}

export async function getPendingApprovalOrders(
  Params: Omit<GetOrdersParams, "status"> = {},
): Promise<ListResponse<SalesManagerOrderSummaryDto>> {
  const Response = await ApiClient.get<
    ListResponse<SalesManagerOrderSummaryDto>
  >("/salesmanager/getpendingapprovals", {
    params: Params,
  });
  return Response.data;
}

export async function getOrderById(OrderId: string): Promise<OrderDto> {
  const Response = await ApiClient.get<OrderDto>(
    `/salesmanager/getorderbyid/${OrderId}`,
  );
  return Response.data;
}

export async function approveOrder(
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderDto> {
  const Response = await ApiClient.post<OrderDto>(
    `/salesmanager/approveorder/${OrderId}`,
    undefined,
    idempotencyHeaders(IdempotencyKey),
  );
  return Response.data;
}

export async function rejectOrder(
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderDto> {
  const Response = await ApiClient.post<OrderDto>(
    `/salesmanager/rejectorder/${OrderId}`,
    undefined,
    idempotencyHeaders(IdempotencyKey),
  );
  return Response.data;
}

export async function cancelOrder(
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderDto> {
  const Response = await ApiClient.post<OrderDto>(
    `/salesmanager/cancelorder/${OrderId}`,
    undefined,
    idempotencyHeaders(IdempotencyKey),
  );
  return Response.data;
}

export async function dispatchOrder(
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderDto> {
  const Response = await ApiClient.post<OrderDto>(
    `/salesmanager/dispatchorder/${OrderId}`,
    undefined,
    idempotencyHeaders(IdempotencyKey),
  );
  return Response.data;
}

export async function deliverOrder(
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderDto> {
  const Response = await ApiClient.post<OrderDto>(
    `/salesmanager/deliverorder/${OrderId}`,
    undefined,
    idempotencyHeaders(IdempotencyKey),
  );
  return Response.data;
}
