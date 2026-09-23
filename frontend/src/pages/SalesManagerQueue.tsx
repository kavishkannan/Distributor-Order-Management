import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { newIdempotencyKey } from "../api/client";
import {
  approveOrder,
  rejectOrder,
  SalesManagerOrderSummaryDto,
} from "../api/salesManager";
import SalesManagerSubNav from "../components/SalesManagerSubNav";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Input from "../components/ui/Input";
import { TableSkeleton } from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useListQueryState } from "../hooks/useListQueryState";
import { useSalesManagerOrders } from "../hooks/useSalesManagerOrders";
import { useToast } from "../contexts/ToastContext";
import { formatPrice } from "../utils/currency";

type PendingAction = { orderId: string; kind: "approve" | "reject" };

export default function SalesManagerQueue() {
  const { showToast: ShowToast } = useToast();
  const { getParam, getNumberParam, updateParams } = useListQueryState();

  const Page = getNumberParam("page", 1);
  const Limit = getNumberParam("limit", 10);

  const [SearchInput, SetSearchInput] = useState(getParam("search"));
  const DebouncedSearch = useDebouncedValue(SearchInput, 400);

  useEffect(() => {
    if (DebouncedSearch !== getParam("search")) {
      updateParams({ search: DebouncedSearch || undefined }, true);
    }
  }, [DebouncedSearch]);

  const Search = getParam("search");

  const [PendingAction, SetPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [ActingOrderId, SetActingOrderId] = useState<string | null>(null);
  const [ActionError, SetActionError] = useState<string | null>(null);

  const {
    orders: Result,
    loading: Loading,
    error: ErrorMessage,
    refetch: Refetch,
  } = useSalesManagerOrders("pending", {
    page: Page,
    limit: Limit,
    search: Search || undefined,
  });

  const ActionKey = useMemo(() => newIdempotencyKey(), [PendingAction]);

  async function handleConfirm() {
    if (!PendingAction) return;
    SetActingOrderId(PendingAction.orderId);
    SetActionError(null);
    try {
      if (PendingAction.kind === "approve") {
        await approveOrder(PendingAction.orderId, ActionKey);
        ShowToast(`Order #${PendingAction.orderId} approved.`, "success");
      } else {
        await rejectOrder(PendingAction.orderId, ActionKey);
        ShowToast(`Order #${PendingAction.orderId} rejected.`, "success");
      }
      SetPendingAction(null);
      Refetch();
    } catch (Err) {
      const Data = axios.isAxiosError(Err) ? Err.response?.data : undefined;
      SetActionError(Data?.message ?? `Failed to ${PendingAction.kind} order.`);
      SetPendingAction(null);
      Refetch();
    } finally {
      SetActingOrderId(null);
    }
  }

  const OrdersList: SalesManagerOrderSummaryDto[] = Result?.data ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Sales Manager Queue"
        subtitle="Orders awaiting approval, oldest first."
      />
      <SalesManagerSubNav />

      <div className="filter-bar">
        <Input
          id="sm-queue-search"
          label="Search"
          placeholder="Order id or distributor"
          value={SearchInput}
          maxLength={100}
          onChange={(Evt) => SetSearchInput(Evt.target.value)}
        />
      </div>

      {Loading && <TableSkeleton rows={Limit > 10 ? 10 : Limit} columns={5} />}
      {!Loading && ErrorMessage && (
        <ErrorState message={ErrorMessage} onRetry={Refetch} />
      )}
      {ActionError && (
        <div className="alert alert--danger" role="alert">
          {ActionError}
        </div>
      )}

      {!Loading && !ErrorMessage && Result && (
        <>
          {OrdersList.length === 0 ? (
            <EmptyState
              title="Queue is empty"
              message="No orders are pending approval right now."
            />
          ) : (
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="data-table data-table--responsive">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Distributor</th>
                      <th>Total</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OrdersList.map((Order) => (
                      <tr key={Order.Id}>
                        <td data-label="Order">
                          <Link
                            className="cell-link"
                            to={`/sales-manager-orders/${Order.Id}`}
                          >
                            #{Order.Id}
                          </Link>
                        </td>
                        <td data-label="Distributor">
                          {Order.Distributor.Name}
                        </td>
                        <td data-label="Total">{formatPrice(Order.Total)}</td>
                        <td data-label="Created">
                          {new Date(Order.CreatedAt).toLocaleString()}
                        </td>
                        <td data-label="Actions" className="actions-cell">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={ActingOrderId === Order.Id}
                            onClick={() =>
                              SetPendingAction({
                                orderId: Order.Id,
                                kind: "approve",
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={ActingOrderId === Order.Id}
                            onClick={() =>
                              SetPendingAction({
                                orderId: Order.Id,
                                kind: "reject",
                              })
                            }
                          >
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Pagination
            meta={Result.pagination}
            onPageChange={(NewPage) => updateParams({ page: NewPage })}
            onPageSizeChange={(NewLimit) =>
              updateParams({ limit: NewLimit }, true)
            }
          />
        </>
      )}

      {PendingAction && (
        <ConfirmDialog
          message={
            PendingAction.kind === "approve"
              ? "Are you sure you want to approve this order?"
              : "Are you sure you want to reject this order?"
          }
          confirmLabel={
            PendingAction.kind === "approve"
              ? "Confirm Approval"
              : "Confirm Rejection"
          }
          cancelLabel="Cancel"
          busy={ActingOrderId === PendingAction.orderId}
          onCancel={() => SetPendingAction(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
