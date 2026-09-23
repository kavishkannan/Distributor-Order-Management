import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  tight?: boolean;
  children: ReactNode;
}

export default function Card({
  title: Title,
  tight = false,
  className,
  children,
  ...Rest
}: CardProps) {
  return (
    <div
      className={["card", tight ? "card--tight" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...Rest}
    >
      {Title && <div className="card__title">{Title}</div>}
      {children}
    </div>
  );
}
