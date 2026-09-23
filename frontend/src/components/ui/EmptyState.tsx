import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon: Icon = "\u{1F4ED}",
  title: Title,
  message: Message,
  action: Action,
}: EmptyStateProps) {
  return (
    <div className="state-panel">
      <span className="state-panel__icon" aria-hidden="true">
        {Icon}
      </span>
      <span className="state-panel__title">{Title}</span>
      {Message && <p>{Message}</p>}
      {Action}
    </div>
  );
}
