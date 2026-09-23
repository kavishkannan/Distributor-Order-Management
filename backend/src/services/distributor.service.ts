import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum } from "../models/OrderEventEntity";
import { distributorRepository } from "../repositories/distributor.repository";
import {
  calculateTier,
  getDiscountForTier,
  getTrailingNinetyDayPoints,
  LoyaltyTier,
} from "./loyalty.service";
import {
  cancelOrder as cancelOrderService,
  getAvailableCredit,
  getOrderById as getOrderByIdService,
  getOrdersForDistributor,
  PaginatedOrders,
} from "./order.service";

export class NotFoundError extends Error {}

async function requireActiveDistributor(
  DistributorId: string,
): Promise<DistributorEntity> {
  const Distributor = await distributorRepository.findById(DistributorId);
  if (!Distributor || Distributor.IsDeleted) {
    throw new NotFoundError(`Distributor ${DistributorId} not found`);
  }
  return Distributor;
}

export interface DistributorProfile {
  id: string;
  name: string;
  creditLimit: number;
  availableCredit: number;
  tier: LoyaltyTier;
  pointsBalance: number;
  currentDiscount: number;
}

async function buildProfile(
  Distributor: DistributorEntity,
): Promise<DistributorProfile> {
  const CreditLimit = Number(Distributor.CreditLimit);
  const [AvailableCredit, PointsBalance] = await Promise.all([
    getAvailableCredit(Distributor.Id, CreditLimit),
    getTrailingNinetyDayPoints(Distributor.Id),
  ]);
  const Tier = calculateTier(PointsBalance);

  return {
    id: Distributor.Id,
    name: Distributor.Name,
    creditLimit: CreditLimit,
    availableCredit: AvailableCredit,
    tier: Tier,
    pointsBalance: PointsBalance,
    currentDiscount: getDiscountForTier(Tier),
  };
}

export async function getDistributorProfile(
  DistributorId: string,
): Promise<DistributorProfile> {
  const Distributor = await requireActiveDistributor(DistributorId);
  return buildProfile(Distributor);
}

export interface DistributorDashboardData {
  distributor: DistributorProfile;
  recentOrders: OrderEntity[];
}

const RecentOrdersLimit = 5;

export async function getDistributorDashboard(
  DistributorId: string,
): Promise<DistributorDashboardData> {
  const Distributor = await requireActiveDistributor(DistributorId);
  const [Profile, RecentOrders] = await Promise.all([
    buildProfile(Distributor),
    getOrdersForDistributor(DistributorId, {
      Page: 1,
      Limit: RecentOrdersLimit,
      SortField: "CreatedAt",
      SortDirection: "DESC",
    }),
  ]);

  return { distributor: Profile, recentOrders: RecentOrders.items };
}

export interface DistributorOrdersQuery {
  page: number;
  limit: number;
  status?: OrderStatus;
  search?: string;
  sortField: string;
  sortDirection: "ASC" | "DESC";
}

export async function getDistributorOrders(
  DistributorId: string,
  Query: DistributorOrdersQuery,
): Promise<PaginatedOrders> {
  await requireActiveDistributor(DistributorId);
  return getOrdersForDistributor(DistributorId, {
    Page: Query.page,
    Limit: Query.limit,
    Status: Query.status,
    Search: Query.search,
    SortField: Query.sortField,
    SortDirection: Query.sortDirection,
  });
}

export async function getOwnOrderById(
  DistributorId: string,
  OrderId: string,
): Promise<OrderEntity | null> {
  await requireActiveDistributor(DistributorId);

  const Order = await getOrderByIdService(OrderId);
  if (!Order || Order.Distributor.Id !== DistributorId) {
    return null;
  }
  return Order;
}

export async function cancelOwnOrder(
  DistributorId: string,
  OrderId: string,
  IdempotencyKey?: string,
): Promise<OrderEntity> {
  await requireActiveDistributor(DistributorId);

  const Order = await getOrderByIdService(OrderId);
  if (!Order || Order.Distributor.Id !== DistributorId) {
    throw new NotFoundError(`Order ${OrderId} not found`);
  }

  return cancelOrderService(
    OrderId,
    ActorTypeEnum.Distributor,
    DistributorId,
    IdempotencyKey,
  );
}

export interface LoyaltySummary {
  pointsBalance: number;
  tier: LoyaltyTier;
  currentDiscount: number;
}

export async function getLoyaltyById(
  DistributorId: string,
): Promise<LoyaltySummary> {
  await requireActiveDistributor(DistributorId);

  const PointsBalance = await getTrailingNinetyDayPoints(DistributorId);
  const Tier = calculateTier(PointsBalance);
  const CurrentDiscount = getDiscountForTier(Tier);

  return {
    pointsBalance: PointsBalance,
    tier: Tier,
    currentDiscount: CurrentDiscount,
  };
}
