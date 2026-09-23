export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ValidationErrorResponse {
  statusCode: 400;
  message: string;
  errors: { field: string; message: string }[];
}

export function isValidationErrorResponse(
  Value: unknown,
): Value is ValidationErrorResponse {
  return (
    typeof Value === "object" &&
    Value !== null &&
    Array.isArray((Value as ValidationErrorResponse).errors) &&
    (Value as ValidationErrorResponse).statusCode === 400
  );
}
