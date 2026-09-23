import { ApiClient, idempotencyHeaders } from "./client";
import { ListResponse } from "./types";
import { OrderDto, OrderSummaryDto } from "./orders";

export type LoyaltyTier = "Bronze" | "Silver" | "Gold";

export interface DistributorProfileDto {
  id: string;
  name: string;
  creditLimit: number;
  availableCredit: number;
  tier: LoyaltyTier;
  pointsBalance: number;
  currentDiscount: number;
}

export async function getDistributorById(
  DistributorId: string,
): Promise<DistributorProfileDto> {
  const Response = await ApiClient.get<DistributorProfileDto>(
    `/distributor/getdistributorbyid/${DistributorId}`,
  );
  return Response.data;
}

export interface DistributorDashboardDto {
  distributor: DistributorProfileDto;
  recentOrders: OrderSummaryDto[];
}

export async function getDistributorDashboard(
  DistributorId: string,
): Promise<DistributorDashboardDto> {
  const Response = await ApiClient.get<DistributorDashboardDto>(
    `/distributor/getdashboard/${DistributorId}`,
  );
  return Response.data;
}

export interface GetDistributorOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export async function getDistributorOrders(
  DistributorId: string,
  Params: GetDistributorOrdersParams = {},
): Promise<ListResponse<OrderSummaryDto>> {
  const Response = await ApiClient.get<ListResponse<OrderSummaryDto>>(
    `/distributor/getorders/${DistributorId}`,
    {
      params: Params,
    },
  );
  return Response.data;
}

export async function getDistributorOrderById(
  DistributorId: string,
  OrderId: string,
): Promise<OrderDto> {
  const Response = await ApiClient.get<OrderDto>(
    `/distributor/getorderbyid/${DistributorId}/${OrderId}`,
  );
  return Response.data;
}

export async function cancelDistributorOrder(
  DistributorId: string,
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderDto> {
  const Response = await ApiClient.post<OrderDto>(
    `/distributor/cancelorder/${DistributorId}/${OrderId}`,
    undefined,
    idempotencyHeaders(IdempotencyKey),
  );
  return Response.data;
}

export interface LoyaltySummaryDto {
  pointsBalance: number;
  tier: LoyaltyTier;
  currentDiscount: number;
}

export async function getLoyaltyById(
  DistributorId: string,
): Promise<LoyaltySummaryDto> {
  const Response = await ApiClient.get<LoyaltySummaryDto>(
    `/distributor/getloyaltybyid/${DistributorId}`,
  );
  return Response.data;
}
