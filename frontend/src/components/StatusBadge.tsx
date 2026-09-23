import Badge, { BadgeTone } from "./ui/Badge";

const StatusTones: Record<string, BadgeTone> = {
  Placed: "neutral",
  Confirmed: "success",
  PendingApproval: "warning",
  Rejected: "danger",
  Dispatched: "info",
  Delivered: "success",
  Cancelled: "danger",
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status: Status }: StatusBadgeProps) {
  return <Badge tone={StatusTones[Status] ?? "neutral"}>{Status}</Badge>;
}
