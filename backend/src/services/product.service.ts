import { ProductEntity } from "../models/ProductEntity";
import { productRepository } from "../repositories/product.repository";

export interface PaginatedProducts {
  items: ProductEntity[];
  total: number;
}

export interface ProductListFilters {
  Page: number;
  Limit: number;
  Search?: string;
  InStockOnly?: boolean;
  SortField: string;
  SortDirection: "ASC" | "DESC";
}

export async function getProductsPaginated(
  Filters: ProductListFilters,
): Promise<PaginatedProducts> {
  const [Items, Total] = await productRepository.findActivePaginated(Filters);
  return { items: Items, total: Total };
}
