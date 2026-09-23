import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({
  children: Children,
}: ProtectedRouteProps) {
  const { isAuthenticated: IsAuthenticated, isLoading: IsLoading } = useAuth();
  const Location = useLocation();

  if (IsLoading) {
    return (
      <div className="page">
        <div className="state-panel" aria-busy="true">
          <span className="state-panel__title">Loading...</span>
        </div>
      </div>
    );
  }

  if (!IsAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: Location }} />;
  }

  return <>{Children}</>;
}
