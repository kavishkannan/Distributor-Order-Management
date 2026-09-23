import { PaginationMeta } from "../../api/types";
import Button from "./Button";
import Select from "./Select";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (Page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (Limit: number) => void;
  loading?: boolean;
}

const DefaultPageSizeOptions = [10, 20, 50];

export default function Pagination({
  meta: Meta,
  onPageChange: OnPageChange,
  pageSizeOptions = DefaultPageSizeOptions,
  onPageSizeChange: OnPageSizeChange,
  loading: Loading = false,
}: PaginationProps) {
  return (
    <div className="pagination-controls">
      <div className="cluster">
        <Button
          variant="secondary"
          size="sm"
          disabled={Loading || !Meta.hasPreviousPage}
          onClick={() => OnPageChange(1)}
        >
          {"«"} First
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={Loading || !Meta.hasPreviousPage}
          onClick={() => OnPageChange(Meta.page - 1)}
        >
          Previous
        </Button>
      </div>

      <span className="pagination-controls__status">
        Page {Meta.page} of {Meta.totalPages} ({Meta.total} total)
      </span>

      <div className="cluster">
        {OnPageSizeChange && (
          <Select
            aria-label="Page size"
            value={String(Meta.limit)}
            disabled={Loading}
            onChange={(Evt) => OnPageSizeChange(Number(Evt.target.value))}
          >
            {pageSizeOptions.map((Size) => (
              <option key={Size} value={Size}>
                {Size} / page
              </option>
            ))}
          </Select>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={Loading || !Meta.hasNextPage}
          onClick={() => OnPageChange(Meta.page + 1)}
        >
          Next
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={Loading || !Meta.hasNextPage}
          onClick={() => OnPageChange(Meta.totalPages)}
        >
          Last {"»"}
        </Button>
      </div>
    </div>
  );
}
