import { ReactNode } from "react";
import { UserRole } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";
import AccessDenied from "../pages/AccessDenied";

interface RoleGuardProps {
  allow: UserRole | UserRole[];
  children: ReactNode;
}

export default function RoleGuard({
  allow: Allow,
  children: Children,
}: RoleGuardProps) {
  const { hasRole: HasRole } = useAuth();

  if (!HasRole(Allow)) {
    return <AccessDenied />;
  }

  return <>{Children}</>;
}
