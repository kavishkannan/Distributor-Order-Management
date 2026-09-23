import { Request, Response } from "express";

export const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(Value: unknown): Value is string {
  return typeof Value === "string" && UuidPattern.test(Value);
}

export const EmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(Value: unknown): Value is string {
  return typeof Value === "string" && EmailPattern.test(Value.trim());
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export function sendValidationError(
  Res: Response,
  Issues: ValidationIssue[],
): void {
  Res.status(400).json({
    statusCode: 400,
    message: "Validation failed",
    errors: Issues,
  });
}

export interface Parsed<T> {
  value: T;
  issue?: ValidationIssue;
}

export function collectIssues(
  Issues: ValidationIssue[],
  ...Parsed: Array<Parsed<unknown> | ValidationIssue[]>
): void {
  for (const Entry of Parsed) {
    if (Array.isArray(Entry)) {
      Issues.push(...Entry);
    } else if (Entry.issue) {
      Issues.push(Entry.issue);
    }
  }
}

const DefaultPageSize = 10;
const MaxPageSize = 100;

export interface PaginationParams {
  Page: number;
  Limit: number;
}

export function parsePagination(
  RawPage: unknown,
  RawLimit: unknown,
): { value: PaginationParams; issues: ValidationIssue[] } {
  const Issues: ValidationIssue[] = [];
  const Page = RawPage === undefined ? 1 : Number(RawPage);
  const Limit = RawLimit === undefined ? DefaultPageSize : Number(RawLimit);

  if (!Number.isInteger(Page) || Page < 1) {
    Issues.push({ field: "page", message: "page must be a positive integer" });
  }
  if (!Number.isInteger(Limit) || Limit < 1 || Limit > MaxPageSize) {
    Issues.push({
      field: "limit",
      message: `limit must be a positive integer between 1 and ${MaxPageSize}`,
    });
  }

  return {
    value: {
      Page: Issues.some((I) => I.field === "page") ? 1 : Page,
      Limit: Issues.some((I) => I.field === "limit") ? DefaultPageSize : Limit,
    },
    issues: Issues,
  };
}

export const OrderSortFieldMap: Record<string, string> = {
  createdat: "CreatedAt",
  total: "Total",
  status: "Status",
};

export const ProductSortFieldMap: Record<string, string> = {
  name: "Name",
  sku: "Sku",
  unitprice: "UnitPrice",
  stockquantity: "StockQuantity",
  createdat: "CreatedAt",
};

export function parseSortField(
  Raw: unknown,
  Allowed: Record<string, string>,
  DefaultField: string,
  FieldName = "sortBy",
): Parsed<string> {
  if (Raw === undefined) return { value: DefaultField };
  if (typeof Raw !== "string" || !(Raw.toLowerCase() in Allowed)) {
    return {
      value: DefaultField,
      issue: {
        field: FieldName,
        message: `${FieldName} must be one of ${Object.keys(Allowed).join(", ")}`,
      },
    };
  }
  return { value: Allowed[Raw.toLowerCase()] };
}

export function parseSortDirection(
  Raw: unknown,
  FieldName = "sortOrder",
): Parsed<"ASC" | "DESC"> {
  if (Raw === undefined) return { value: "DESC" };
  if (typeof Raw !== "string") {
    return {
      value: "DESC",
      issue: { field: FieldName, message: `${FieldName} must be ASC or DESC` },
    };
  }
  const Upper = Raw.toUpperCase();
  if (Upper !== "ASC" && Upper !== "DESC") {
    return {
      value: "DESC",
      issue: { field: FieldName, message: `${FieldName} must be ASC or DESC` },
    };
  }
  return { value: Upper };
}

const MaxSearchLength = 100;

export function parseSearch(
  Raw: unknown,
  FieldName = "search",
): Parsed<string | undefined> {
  if (Raw === undefined) return { value: undefined };
  if (typeof Raw !== "string") {
    return {
      value: undefined,
      issue: { field: FieldName, message: `${FieldName} must be a string` },
    };
  }
  const Trimmed = Raw.trim();
  if (Trimmed.length === 0) return { value: undefined };
  if (Trimmed.length > MaxSearchLength) {
    return {
      value: undefined,
      issue: {
        field: FieldName,
        message: `${FieldName} must be at most ${MaxSearchLength} characters`,
      },
    };
  }
  return { value: Trimmed };
}

export function parseBooleanFlag(
  Raw: unknown,
  FieldName: string,
): Parsed<boolean | undefined> {
  if (Raw === undefined) return { value: undefined };
  if (Raw === "true") return { value: true };
  if (Raw === "false") return { value: false };
  return {
    value: undefined,
    issue: { field: FieldName, message: `${FieldName} must be true or false` },
  };
}

export function parseEnum<T extends string>(
  Raw: unknown,
  Allowed: Set<T> | readonly T[],
  FieldName: string,
): Parsed<T | undefined> {
  const AllowedSet = Allowed instanceof Set ? Allowed : new Set(Allowed);
  if (Raw === undefined) return { value: undefined };
  if (typeof Raw !== "string" || !AllowedSet.has(Raw as T)) {
    return {
      value: undefined,
      issue: {
        field: FieldName,
        message: `${FieldName} must be one of ${[...AllowedSet].join(", ")}`,
      },
    };
  }
  return { value: Raw as T };
}

export function parsePositiveInteger(
  Raw: unknown,
  FieldName: string,
  Max?: number,
): Parsed<number> {
  const Value = typeof Raw === "number" ? Raw : Number(Raw);
  if (!Number.isInteger(Value) || Value <= 0) {
    return {
      value: 0,
      issue: {
        field: FieldName,
        message: `${FieldName} must be a positive integer`,
      },
    };
  }
  if (Max !== undefined && Value > Max) {
    return {
      value: Value,
      issue: {
        field: FieldName,
        message: `${FieldName} must be at most ${Max}`,
      },
    };
  }
  return { value: Value };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function buildPaginationMeta(
  Page: number,
  Limit: number,
  Total: number,
): PaginationMeta {
  const TotalPages = Math.max(1, Math.ceil(Total / Limit));
  return {
    page: Page,
    limit: Limit,
    total: Total,
    totalPages: TotalPages,
    hasNextPage: Page < TotalPages,
    hasPreviousPage: Page > 1,
  };
}

export interface ListResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function toListResponse<T>(
  Items: T[],
  Page: number,
  Limit: number,
  Total: number,
): ListResponse<T> {
  return { data: Items, pagination: buildPaginationMeta(Page, Limit, Total) };
}

export const MaxIdempotencyKeyLength = 100;

export function parseIdempotencyKeyHeader(
  Value: unknown,
): Parsed<string | undefined> {
  if (Value === undefined) return { value: undefined };
  if (
    typeof Value !== "string" ||
    Value.trim().length === 0 ||
    Value.length > MaxIdempotencyKeyLength
  ) {
    return {
      value: undefined,
      issue: {
        field: "Idempotency-Key",
        message: `Idempotency-Key header must be 1-${MaxIdempotencyKeyLength} characters`,
      },
    };
  }
  return { value: Value.trim() };
}

export function readIdempotencyKey(
  Req: Request,
  Res: Response,
): { key: string | undefined } | null {
  const Parsed = parseIdempotencyKeyHeader(Req.headers["idempotency-key"]);
  if (Parsed.issue) {
    sendValidationError(Res, [Parsed.issue]);
    return null;
  }
  return { key: Parsed.value };
}
