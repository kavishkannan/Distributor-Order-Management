import { Navigate, Route, Routes, useParams } from "react-router-dom";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import RoleGuard from "./components/RoleGuard";
import Catalogue from "./pages/Catalogue";
import DistributorDashboard from "./pages/DistributorDashboard";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import DistributorOrderDetail from "./pages/orders/DistributorOrderDetail";
import DistributorOrders from "./pages/orders/DistributorOrders";
import PlaceOrder from "./pages/orders/PlaceOrder";
import SalesManagerQueue from "./pages/SalesManagerQueue";
import SalesManagerDashboard from "./pages/salesManager/SalesManagerDashboard";
import SalesManagerOrderDetail from "./pages/salesManager/SalesManagerOrderDetail";
import SalesManagerOrders from "./pages/salesManager/SalesManagerOrders";

function ParamRedirect({
  to,
}: {
  to: (Params: Record<string, string | undefined>) => string;
}) {
  const Params = useParams();
  return <Navigate to={to(Params)} replace />;
}

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route
            path="/signin"
            element={
              <PublicOnlyRoute>
                <SignIn />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignUp />
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Catalogue />
              </ProtectedRoute>
            }
          />

          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <RoleGuard allow="DISTRIBUTOR">
                  <DistributorOrders />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <RoleGuard allow="DISTRIBUTOR">
                  <DistributorOrderDetail />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/place-order"
            element={
              <ProtectedRoute>
                <RoleGuard allow="DISTRIBUTOR">
                  <PlaceOrder />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/distributor-dashboard"
            element={
              <ProtectedRoute>
                <RoleGuard allow="DISTRIBUTOR">
                  <DistributorDashboard />
                </RoleGuard>
              </ProtectedRoute>
            }
          />

          <Route
            path="/sales-manager-dashboard"
            element={
              <ProtectedRoute>
                <RoleGuard allow="SALES_MANAGER">
                  <SalesManagerDashboard />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales-manager-queue"
            element={
              <ProtectedRoute>
                <RoleGuard allow="SALES_MANAGER">
                  <SalesManagerQueue />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales-manager-orders"
            element={
              <ProtectedRoute>
                <RoleGuard allow="SALES_MANAGER">
                  <SalesManagerOrders />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales-manager-orders/:id"
            element={
              <ProtectedRoute>
                <RoleGuard allow="SALES_MANAGER">
                  <SalesManagerOrderDetail />
                </RoleGuard>
              </ProtectedRoute>
            }
          />

          <Route
            path="/orders/new"
            element={<Navigate to="/place-order" replace />}
          />
          <Route
            path="/distributor/dashboard"
            element={<Navigate to="/distributor-dashboard" replace />}
          />
          <Route
            path="/distributor/:distributorId/orders"
            element={<Navigate to="/orders" replace />}
          />
          <Route
            path="/distributor/:distributorId/orders/:orderId"
            element={<ParamRedirect to={(P) => `/orders/${P.orderId}`} />}
          />
          <Route
            path="/sales-manager/queue"
            element={<Navigate to="/sales-manager-queue" replace />}
          />
          <Route
            path="/sales-manager/orders"
            element={<Navigate to="/sales-manager-orders" replace />}
          />
          <Route
            path="/sales-manager/orders/:orderId"
            element={
              <ParamRedirect to={(P) => `/sales-manager-orders/${P.orderId}`} />
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
