import { ApiClient } from "./client";
import { ListResponse } from "./types";

export interface ProductDto {
  Id: string;
  Sku: string;
  Name: string;
  UnitPrice: number | string;
  StockQuantity: number;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export async function getAllProducts(
  Params: GetProductsParams = {},
): Promise<ListResponse<ProductDto>> {
  const Response = await ApiClient.get<ListResponse<ProductDto>>(
    "/product/getallproducts",
    { params: Params },
  );
  return Response.data;
}
