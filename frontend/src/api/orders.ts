import { ApiClient } from "./client";
import { ProductDto } from "./products";

export interface PlaceOrderLineItemInput {
  productId: string;
  quantity: number;
}

export interface OrderLineItemDto {
  Id: string;
  Quantity: number;
  UnitPrice: number | string;
  Product: ProductDto;
}

export interface DistributorDto {
  Id: string;
  Name: string;
  CreditLimit: number | string;
}

export interface OrderEventDto {
  Id: string;
  FromStatus: string | null;
  ToStatus: string;
  ActorType: string;
  ActorId: string | null;
  CreatedAt: string;
}

export interface OrderSummaryDto {
  Id: string;
  Status: string;
  DiscountPercent: number | string;
  Subtotal: number | string;
  Total: number | string;
  CreatedAt: string;
  UpdatedAt?: string;
  Distributor?: DistributorDto;
}

export interface OrderDto extends OrderSummaryDto {
  Distributor?: DistributorDto;
  LineItems: OrderLineItemDto[];
  Events?: OrderEventDto[];
}

export interface StockErrorDto {
  message: string;
  sku: string;
  availableQuantity: number;
}

export function isStockError(Value: unknown): Value is StockErrorDto {
  return (
    typeof Value === "object" &&
    Value !== null &&
    typeof (Value as StockErrorDto).sku === "string" &&
    typeof (Value as StockErrorDto).availableQuantity === "number"
  );
}

export async function placeOrder(
  LineItems: PlaceOrderLineItemInput[],
  IdempotencyKey?: string,
): Promise<OrderDto> {
  const Response = await ApiClient.post<OrderDto>("/order/placeorder", {
    lineItems: LineItems,
    idempotencyKey: IdempotencyKey,
  });
  return Response.data;
}
