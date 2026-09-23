import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}

export default function StatCard({
  label: Label,
  value: Value,
  hint: Hint,
  accent = false,
}: StatCardProps) {
  return (
    <div
      className={["stat-card", accent ? "stat-card--accent" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="stat-card__label">{Label}</span>
      <span className="stat-card__value">{Value}</span>
      {Hint && <span className="stat-card__hint">{Hint}</span>}
    </div>
  );
}
