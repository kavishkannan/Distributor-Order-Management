import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { homePathForRole } from "../utils/roleHome";

interface PublicOnlyRouteProps {
  children: ReactNode;
}

export default function PublicOnlyRoute({
  children: Children,
}: PublicOnlyRouteProps) {
  const { user: User, isLoading: IsLoading } = useAuth();
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

  if (User) {
    const AttemptedFrom = (
      Location.state as { from?: { pathname: string } } | null
    )?.from?.pathname;
    return (
      <Navigate to={AttemptedFrom ?? homePathForRole(User.role)} replace />
    );
  }

  return <>{Children}</>;
}
