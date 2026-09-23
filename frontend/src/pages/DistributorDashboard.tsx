import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import TierBadge from "../components/TierBadge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import { CardGridSkeleton, TableSkeleton } from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { useAuth } from "../contexts/AuthContext";
import { useDistributorDashboard } from "../hooks/useDistributorDashboard";
import { formatPrice } from "../utils/currency";

export default function DistributorDashboard() {
  const { user: User } = useAuth();
  const DistributorId = User!.distributorId!;
  const {
    dashboard: Dashboard,
    loading: Loading,
    error: ErrorMessage,
    refetch: Refetch,
  } = useDistributorDashboard(DistributorId);

  return (
    <div className="page">
      <PageHeader
        title={`Welcome back, ${User!.name}`}
        subtitle="Loyalty, credit and recent order activity at a glance."
      />

      {Loading && (
        <>
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={4} columns={4} />
        </>
      )}

      {!Loading && ErrorMessage && (
        <ErrorState message={ErrorMessage} onRetry={Refetch} />
      )}

      {!Loading && !ErrorMessage && Dashboard && (
        <>
          <h2>{Dashboard.distributor.name}</h2>

          <div className="card-grid">
            <StatCard
              label="Loyalty tier"
              value={<TierBadge tier={Dashboard.distributor.tier} />}
              hint={`${Dashboard.distributor.currentDiscount}% current discount`}
              accent
            />
            <StatCard
              label="Points balance"
              value={Dashboard.distributor.pointsBalance}
              hint="Trailing 90 days"
            />
            <StatCard
              label="Credit limit"
              value={formatPrice(Dashboard.distributor.creditLimit)}
            />
            <StatCard
              label="Available credit"
              value={formatPrice(Dashboard.distributor.availableCredit)}
            />
          </div>

          <Card title="Recent orders">
            {Dashboard.recentOrders.length === 0 ? (
              <EmptyState
                title="No orders yet"
                message="Orders you place will appear here."
              />
            ) : (
              <div
                className="table-wrap"
                style={{ boxShadow: "none", border: "none" }}
              >
                <div className="table-scroll">
                  <table className="data-table data-table--responsive">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {Dashboard.recentOrders.map((Order) => (
                        <tr key={Order.Id}>
                          <td data-label="Order">#{Order.Id}</td>
                          <td data-label="Date">
                            {new Date(Order.CreatedAt).toLocaleString()}
                          </td>
                          <td data-label="Total">{formatPrice(Order.Total)}</td>
                          <td data-label="Status">
                            <StatusBadge status={Order.Status} />
                          </td>
                          <td data-label="Actions" className="actions-cell">
                            <Link to={`/orders/${Order.Id}`}>
                              <Button variant="secondary" size="sm">
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          <div className="cluster">
            <Link to="/orders">
              <Button variant="secondary">View all orders</Button>
            </Link>
            <Link to="/place-order">
              <Button variant="primary">Place new order</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost">Browse catalogue</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
