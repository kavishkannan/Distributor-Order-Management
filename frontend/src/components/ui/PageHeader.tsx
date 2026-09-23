import { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({
  title: Title,
  subtitle: Subtitle,
  actions: Actions,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        <h1>{Title}</h1>
        {Subtitle && <p className="page-header__subtitle">{Subtitle}</p>}
      </div>
      {Actions && <div className="page-header__actions">{Actions}</div>}
    </div>
  );
}
