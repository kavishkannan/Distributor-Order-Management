import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  approveOrder,
  cancelOrder,
  deliverOrder,
  dispatchOrder,
  getOrderById,
  rejectOrder,
} from "../../api/salesManager";
import { newIdempotencyKey } from "../../api/client";
import { OrderDto } from "../../api/orders";
import ConfirmDialog from "../../components/ConfirmDialog";
import OrderTimeline from "../../components/OrderTimeline";
import OrderTotalsCard from "../../components/OrderTotalsCard";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ErrorState from "../../components/ui/ErrorState";
import { TableSkeleton } from "../../components/ui/LoadingState";
import PageHeader from "../../components/ui/PageHeader";
import { useToast } from "../../contexts/ToastContext";
import { formatPrice } from "../../utils/currency";

type ActionKind = "approve" | "reject" | "cancel" | "dispatch" | "deliver";

const CancellableStatuses = new Set(["Placed", "PendingApproval", "Confirmed"]);

const ActionCopy: Record<
  ActionKind,
  { message: string; confirmLabel: string; successMessage: string }
> = {
  approve: {
    message: "Are you sure you want to approve this order?",
    confirmLabel: "Confirm Approval",
    successMessage: "Order approved.",
  },
  reject: {
    message: "Are you sure you want to reject this order?",
    confirmLabel: "Confirm Rejection",
    successMessage: "Order rejected.",
  },
  cancel: {
    message:
      "Are you sure you want to cancel this order? Reserved stock is released and any points awarded are reversed.",
    confirmLabel: "Confirm Cancellation",
    successMessage: "Order cancelled.",
  },
  dispatch: {
    message: "Are you sure you want to dispatch this order?",
    confirmLabel: "Confirm Dispatch",
    successMessage: "Order dispatched.",
  },
  deliver: {
    message: "Are you sure you want to mark this order delivered?",
    confirmLabel: "Confirm Delivery",
    successMessage: "Order marked delivered.",
  },
};

export default function SalesManagerOrderDetail() {
  const { id: OrderId } = useParams();
  const { showToast: ShowToast } = useToast();
  const [Order, SetOrder] = useState<OrderDto | null>(null);
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [PendingAction, SetPendingAction] = useState<ActionKind | null>(null);
  const [Acting, SetActing] = useState(false);
  const ActionKey = useMemo(() => newIdempotencyKey(), [PendingAction]);

  const Load = useCallback(() => {
    if (!OrderId) return Promise.resolve();

    SetLoading(true);
    SetErrorMessage(null);

    return getOrderById(OrderId)
      .then(SetOrder)
      .catch(() => SetErrorMessage("Order not found."))
      .finally(() => SetLoading(false));
  }, [OrderId]);

  useEffect(() => {
    Load();
  }, [Load]);

  async function handleConfirm() {
    if (!OrderId || !PendingAction) return;
    SetActing(true);
    try {
      const Action = {
        approve: approveOrder,
        reject: rejectOrder,
        cancel: cancelOrder,
        dispatch: dispatchOrder,
        deliver: deliverOrder,
      }[PendingAction];
      await Action(OrderId, ActionKey);
      ShowToast(ActionCopy[PendingAction].successMessage, "success");
      SetPendingAction(null);
      await Load();
    } catch (Err) {
      const Data = axios.isAxiosError(Err) ? Err.response?.data : undefined;
      const Message = Data?.message ?? `Failed to ${PendingAction} order.`;
      SetPendingAction(null);
      await Load();
      SetErrorMessage(Message);
      ShowToast(Message, "error");
    } finally {
      SetActing(false);
    }
  }

  if (Loading) {
    return (
      <div className="page">
        <PageHeader title="Order Detail" />
        <TableSkeleton rows={4} columns={5} />
      </div>
    );
  }

  if (!Order) {
    return (
      <div className="page">
        <PageHeader title="Order Detail" />
        <ErrorState message={ErrorMessage ?? "Order not found."} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={
          <>
            Order #{Order.Id} <StatusBadge status={Order.Status} />
          </>
        }
        subtitle={
          Order.Distributor
            ? `Distributor: ${Order.Distributor.Name}`
            : undefined
        }
        actions={
          <>
            {Order.Status === "PendingApproval" && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => SetPendingAction("approve")}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => SetPendingAction("reject")}
                >
                  Reject
                </Button>
              </>
            )}
            {Order.Status === "Confirmed" && (
              <Button
                variant="primary"
                onClick={() => SetPendingAction("dispatch")}
              >
                Dispatch order
              </Button>
            )}
            {CancellableStatuses.has(Order.Status) && (
              <Button
                variant="danger"
                onClick={() => SetPendingAction("cancel")}
              >
                Cancel order
              </Button>
            )}
            {Order.Status === "Dispatched" && (
              <Button
                variant="primary"
                onClick={() => SetPendingAction("deliver")}
              >
                Mark delivered
              </Button>
            )}
          </>
        }
      />

      {ErrorMessage && (
        <div className="alert alert--danger" role="alert">
          {ErrorMessage}
        </div>
      )}

      <Card title="Line items">
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data-table data-table--responsive">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {Order.LineItems.map((Item) => (
                  <tr key={Item.Id}>
                    <td data-label="SKU">{Item.Product.Sku}</td>
                    <td data-label="Product">{Item.Product.Name}</td>
                    <td data-label="Quantity">{Item.Quantity}</td>
                    <td data-label="Unit Price">
                      {formatPrice(Item.UnitPrice)}
                    </td>
                    <td data-label="Line Total">
                      {formatPrice(Number(Item.UnitPrice) * Item.Quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <OrderTotalsCard order={Order} />

      {Order.Events && Order.Events.length > 0 && (
        <Card title="Event log">
          <OrderTimeline events={Order.Events} />
        </Card>
      )}

      <p className="cluster">
        <Link to="/sales-manager-queue">&larr; Back to queue</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/sales-manager-orders">Back to all orders</Link>
      </p>

      {PendingAction && (
        <ConfirmDialog
          message={ActionCopy[PendingAction].message}
          confirmLabel={ActionCopy[PendingAction].confirmLabel}
          cancelLabel="Cancel"
          busy={Acting}
          onCancel={() => SetPendingAction(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
