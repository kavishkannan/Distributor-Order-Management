import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAllOrders,
  SalesManagerOrderSummaryDto,
} from "../../api/salesManager";
import { ListResponse } from "../../api/types";
import SalesManagerSubNav from "../../components/SalesManagerSubNav";
import StatusBadge from "../../components/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import Input from "../../components/ui/Input";
import { TableSkeleton } from "../../components/ui/LoadingState";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import Select from "../../components/ui/Select";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useListQueryState } from "../../hooks/useListQueryState";
import { formatPrice } from "../../utils/currency";

const StatusOptions = [
  "Placed",
  "PendingApproval",
  "Confirmed",
  "Rejected",
  "Dispatched",
  "Delivered",
  "Cancelled",
];

export default function SalesManagerOrders() {
  const { getParam, getNumberParam, updateParams } = useListQueryState();

  const Page = getNumberParam("page", 1);
  const Limit = getNumberParam("limit", 10);
  const Status = getParam("status");
  const SortValue = `${getParam("sortBy") || "createdat"}:${getParam("sortOrder") || "DESC"}`;

  const [SearchInput, SetSearchInput] = useState(getParam("search"));
  const DebouncedSearch = useDebouncedValue(SearchInput, 400);

  useEffect(() => {
    if (DebouncedSearch !== getParam("search")) {
      updateParams({ search: DebouncedSearch || undefined }, true);
    }
  }, [DebouncedSearch]);

  const Search = getParam("search");

  const [Result, SetResult] =
    useState<ListResponse<SalesManagerOrderSummaryDto> | null>(null);
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [RefetchToken, SetRefetchToken] = useState(0);

  useEffect(() => {
    let Cancelled = false;
    SetLoading(true);
    SetErrorMessage(null);

    getAllOrders({
      page: Page,
      limit: Limit,
      status: Status || undefined,
      search: Search || undefined,
      sortBy: SortValue.split(":")[0],
      sortOrder: SortValue.split(":")[1] as "ASC" | "DESC",
    })
      .then((Data) => {
        if (!Cancelled) SetResult(Data);
      })
      .catch(() => {
        if (!Cancelled) SetErrorMessage("Failed to load orders.");
      })
      .finally(() => {
        if (!Cancelled) SetLoading(false);
      });

    return () => {
      Cancelled = true;
    };
  }, [Page, Limit, Status, Search, SortValue, RefetchToken]);

  return (
    <div className="page">
      <PageHeader
        title="All Orders"
        subtitle="Every order in the system, with search, status and sort filters."
      />
      <SalesManagerSubNav />

      <div className="filter-bar">
        <Input
          id="sm-orders-search"
          label="Search"
          placeholder="Order id or distributor"
          value={SearchInput}
          maxLength={100}
          onChange={(Evt) => SetSearchInput(Evt.target.value)}
        />
        <Select
          id="sm-orders-status"
          label="Status"
          value={Status}
          onChange={(Evt) =>
            updateParams({ status: Evt.target.value || undefined }, true)
          }
        >
          <option value="">All statuses</option>
          {StatusOptions.map((Option) => (
            <option key={Option} value={Option}>
              {Option}
            </option>
          ))}
        </Select>

        <Select
          id="sm-orders-sort"
          label="Sort by"
          value={SortValue}
          onChange={(Evt) => {
            const [Field, Dir] = Evt.target.value.split(":");
            updateParams({ sortBy: Field, sortOrder: Dir }, true);
          }}
        >
          <option value="createdat:DESC">Newest first</option>
          <option value="createdat:ASC">Oldest first</option>
          <option value="total:DESC">Total: high to low</option>
          <option value="total:ASC">Total: low to high</option>
          <option value="status:ASC">Status</option>
        </Select>
      </div>

      {Loading && <TableSkeleton rows={Limit > 10 ? 10 : Limit} columns={5} />}
      {!Loading && ErrorMessage && (
        <ErrorState
          message={ErrorMessage}
          onRetry={() => SetRefetchToken((Token) => Token + 1)}
        />
      )}

      {!Loading && !ErrorMessage && Result && Result.data.length === 0 && (
        <EmptyState
          title="No orders found"
          message="Try a different search or status filter."
        />
      )}

      {!Loading && !ErrorMessage && Result && Result.data.length > 0 && (
        <>
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data-table data-table--responsive">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Distributor</th>
                    <th>Created</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Result.data.map((Order) => (
                    <tr key={Order.Id}>
                      <td data-label="Order">
                        <Link
                          className="cell-link"
                          to={`/sales-manager-orders/${Order.Id}`}
                        >
                          #{Order.Id}
                        </Link>
                      </td>
                      <td data-label="Distributor">{Order.Distributor.Name}</td>
                      <td data-label="Created">
                        {new Date(Order.CreatedAt).toLocaleString()}
                      </td>
                      <td data-label="Total">{formatPrice(Order.Total)}</td>
                      <td data-label="Status">
                        <StatusBadge status={Order.Status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            meta={Result.pagination}
            onPageChange={(NewPage) => updateParams({ page: NewPage })}
            onPageSizeChange={(NewLimit) =>
              updateParams({ limit: NewLimit }, true)
            }
          />
        </>
      )}
    </div>
  );
}
