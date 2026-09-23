import { Link } from "react-router-dom";
import SalesManagerSubNav from "../../components/SalesManagerSubNav";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import {
  CardGridSkeleton,
  TableSkeleton,
} from "../../components/ui/LoadingState";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import { useSalesManagerDashboard } from "../../hooks/useSalesManagerDashboard";
import { formatPrice } from "../../utils/currency";

export default function SalesManagerDashboard() {
  const {
    data: Data,
    loading: Loading,
    error: ErrorMessage,
    refetch: Refetch,
  } = useSalesManagerDashboard();

  return (
    <div className="page">
      <PageHeader
        title="Sales Manager Dashboard"
        subtitle="Order pipeline overview across every distributor."
        actions={
          <>
            <Link to="/sales-manager-queue">
              <Button variant="primary">Review approval queue</Button>
            </Link>
          </>
        }
      />

      <SalesManagerSubNav />

      {Loading && (
        <>
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={4} columns={5} />
        </>
      )}

      {!Loading && ErrorMessage && (
        <ErrorState message={ErrorMessage} onRetry={Refetch} />
      )}

      {!Loading && !ErrorMessage && Data && (
        <>
          <div className="card-grid">
            <StatCard
              label="Pending approval"
              value={Data.pendingApprovalCount}
              accent
              hint="Awaiting a decision"
            />
            <StatCard
              label="Confirmed"
              value={Data.confirmedCount}
              hint="Approved, not yet dispatched"
            />
            <StatCard
              label="Dispatched"
              value={Data.dispatchedCount}
              hint="On the way"
            />
            <StatCard
              label="Delivered"
              value={Data.deliveredCount}
              hint="Completed"
            />
          </div>

          <Card title="Approval queue preview">
            {Data.pendingQueuePreview.length === 0 ? (
              <EmptyState
                title="Queue is empty"
                message="No orders are waiting for approval right now."
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
                      </tr>
                    </thead>
                    <tbody>
                      {Data.pendingQueuePreview.map((Order) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          <Card title="Recent orders">
            {Data.recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data-table data-table--responsive">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Distributor</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Data.recentOrders.map((Order) => (
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
                          <td data-label="Status">
                            <StatusBadge status={Order.Status} />
                          </td>
                          <td data-label="Created">
                            {new Date(Order.CreatedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
