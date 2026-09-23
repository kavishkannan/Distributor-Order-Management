import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { newIdempotencyKey } from "../../api/client";
import {
  cancelDistributorOrder,
  getDistributorOrderById,
} from "../../api/distributors";
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
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { formatPrice } from "../../utils/currency";

const CancellableStatuses = new Set(["Placed", "PendingApproval", "Confirmed"]);

export default function DistributorOrderDetail() {
  const { id: OrderId } = useParams();
  const { user: User } = useAuth();
  const DistributorId = User!.distributorId!;
  const { showToast: ShowToast } = useToast();
  const [Order, SetOrder] = useState<OrderDto | null>(null);
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [ConfirmOpen, SetConfirmOpen] = useState(false);
  const [Cancelling, SetCancelling] = useState(false);
  const CancelKey = useMemo(() => newIdempotencyKey(), [ConfirmOpen]);

  const Load = useCallback(() => {
    if (!OrderId) return Promise.resolve();

    SetLoading(true);
    SetErrorMessage(null);

    return getDistributorOrderById(DistributorId, OrderId)
      .then(SetOrder)
      .catch(() => SetErrorMessage("Order not found."))
      .finally(() => SetLoading(false));
  }, [DistributorId, OrderId]);

  useEffect(() => {
    Load();
  }, [Load]);

  async function handleConfirmCancel() {
    if (!OrderId) return;
    SetCancelling(true);
    try {
      await cancelDistributorOrder(DistributorId, OrderId, CancelKey);
      ShowToast("Order cancelled.", "success");
      SetConfirmOpen(false);
      await Load();
    } catch (Err) {
      const Data = axios.isAxiosError(Err) ? Err.response?.data : undefined;
      SetErrorMessage(Data?.message ?? "Failed to cancel order.");
      SetConfirmOpen(false);
    } finally {
      SetCancelling(false);
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
        actions={
          CancellableStatuses.has(Order.Status) ? (
            <Button variant="danger" onClick={() => SetConfirmOpen(true)}>
              Cancel order
            </Button>
          ) : undefined
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

      <p>
        <Link to="/orders">&larr; Back to orders</Link>
      </p>

      {ConfirmOpen && (
        <ConfirmDialog
          message="Are you sure you want to cancel this order?"
          cancelLabel="Cancel"
          confirmLabel="Confirm Cancellation"
          busy={Cancelling}
          onCancel={() => SetConfirmOpen(false)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}
