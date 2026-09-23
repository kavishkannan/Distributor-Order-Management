import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { newIdempotencyKey } from "../../api/client";
import {
  cancelDistributorOrder,
  getDistributorOrders,
} from "../../api/distributors";
import { OrderSummaryDto } from "../../api/orders";
import { ListResponse } from "../../api/types";
import ConfirmDialog from "../../components/ConfirmDialog";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import Input from "../../components/ui/Input";
import { TableSkeleton } from "../../components/ui/LoadingState";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import Select from "../../components/ui/Select";
import { useAuth } from "../../contexts/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useListQueryState } from "../../hooks/useListQueryState";
import { useToast } from "../../contexts/ToastContext";
import { formatPrice } from "../../utils/currency";

const CancellableStatuses = new Set(["Placed", "PendingApproval", "Confirmed"]);
const StatusOptions = [
  "Placed",
  "PendingApproval",
  "Confirmed",
  "Rejected",
  "Dispatched",
  "Delivered",
  "Cancelled",
];

export default function DistributorOrders() {
  const { user: User } = useAuth();
  const DistributorId = User!.distributorId!;
  const { showToast: ShowToast } = useToast();
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

  const [CancelTargetId, SetCancelTargetId] = useState<string | null>(null);
  const CancelKey = useMemo(() => newIdempotencyKey(), [CancelTargetId]);
  const [Cancelling, SetCancelling] = useState(false);
  const [ActionError, SetActionError] = useState<string | null>(null);

  const [Result, SetResult] = useState<ListResponse<OrderSummaryDto> | null>(
    null,
  );
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [RefetchToken, SetRefetchToken] = useState(0);

  useEffect(() => {
    let Cancelled = false;
    SetLoading(true);
    SetErrorMessage(null);

    getDistributorOrders(DistributorId, {
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
  }, [DistributorId, Page, Limit, Status, Search, SortValue, RefetchToken]);

  async function handleConfirmCancel() {
    if (!CancelTargetId) return;
    SetCancelling(true);
    SetActionError(null);
    try {
      await cancelDistributorOrder(DistributorId, CancelTargetId, CancelKey);
      ShowToast(`Order #${CancelTargetId} cancelled.`, "success");
      SetCancelTargetId(null);
      SetRefetchToken((Token) => Token + 1);
    } catch (Err) {
      const Data = axios.isAxiosError(Err) ? Err.response?.data : undefined;
      SetActionError(Data?.message ?? "Failed to cancel order.");
    } finally {
      SetCancelling(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Orders" subtitle="Your order history." />

      <div className="filter-bar">
        <Input
          id="distributor-orders-search"
          label="Search"
          placeholder="Order id"
          value={SearchInput}
          maxLength={100}
          onChange={(Evt) => SetSearchInput(Evt.target.value)}
        />

        <Select
          id="distributor-orders-status"
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
          id="distributor-orders-sort"
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

      {Loading && <TableSkeleton rows={Limit > 10 ? 10 : Limit} columns={6} />}
      {!Loading && ErrorMessage && (
        <ErrorState
          message={ErrorMessage}
          onRetry={() => SetRefetchToken((Token) => Token + 1)}
        />
      )}
      {ActionError && (
        <div className="alert alert--danger" role="alert">
          {ActionError}
        </div>
      )}

      {!Loading && !ErrorMessage && Result && Result.data.length === 0 && (
        <EmptyState
          title="No orders found"
          message="No orders match the current filters."
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
                    <th>Created</th>
                    <th>Total</th>
                    <th>Discount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Result.data.map((Order) => (
                    <tr key={Order.Id}>
                      <td data-label="Order">#{Order.Id}</td>
                      <td data-label="Created">
                        {new Date(Order.CreatedAt).toLocaleString()}
                      </td>
                      <td data-label="Total">{formatPrice(Order.Total)}</td>
                      <td data-label="Discount">{Order.DiscountPercent}%</td>
                      <td data-label="Status">
                        <StatusBadge status={Order.Status} />
                      </td>
                      <td data-label="Actions" className="actions-cell">
                        <Link to={`/orders/${Order.Id}`}>
                          <Button variant="secondary" size="sm">
                            View
                          </Button>
                        </Link>
                        {CancellableStatuses.has(Order.Status) && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => SetCancelTargetId(Order.Id)}
                          >
                            Cancel
                          </Button>
                        )}
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

      {CancelTargetId && (
        <ConfirmDialog
          message="Are you sure you want to cancel this order?"
          cancelLabel="Cancel"
          confirmLabel="Confirm Cancellation"
          busy={Cancelling}
          onCancel={() => SetCancelTargetId(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}
