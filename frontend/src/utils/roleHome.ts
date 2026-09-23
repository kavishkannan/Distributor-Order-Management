import { UserRole } from "../api/auth";

export function homePathForRole(Role: UserRole): string {
  return Role === "DISTRIBUTOR"
    ? "/distributor-dashboard"
    : "/sales-manager-queue";
}
