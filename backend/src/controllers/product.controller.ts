import { NextFunction, Request, Response } from "express";
import { getProductsPaginated } from "../services/product.service";
import {
  parseBooleanFlag,
  parsePagination,
  parseSearch,
  parseSortDirection,
  parseSortField,
  ProductSortFieldMap,
  sendValidationError,
  toListResponse,
  ValidationIssue,
} from "../utils/validators";

export async function getAllProducts(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Pagination = parsePagination(Req.query.page, Req.query.limit);
  const Search = parseSearch(Req.query.search);
  const InStock = parseBooleanFlag(Req.query.inStock, "inStock");
  const SortField = parseSortField(
    Req.query.sortBy,
    ProductSortFieldMap,
    "Sku",
  );
  const SortDirection = parseSortDirection(Req.query.sortOrder);

  const Issues: ValidationIssue[] = [...Pagination.issues];
  for (const Field of [Search, InStock, SortField, SortDirection]) {
    if (Field.issue) Issues.push(Field.issue);
  }

  if (Issues.length > 0) {
    sendValidationError(Res, Issues);
    return;
  }

  try {
    const { Page, Limit } = Pagination.value;
    const Result = await getProductsPaginated({
      Page,
      Limit,
      Search: Search.value,
      InStockOnly: InStock.value,
      SortField: SortField.value,
      SortDirection: SortDirection.value,
    });
    Res.json(toListResponse(Result.items, Page, Limit, Result.total));
  } catch (Err) {
    Next(Err);
  }
}
