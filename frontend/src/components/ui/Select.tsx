import { ReactNode, SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  children: ReactNode;
}

export default function Select({
  label: Label,
  error: Error,
  className,
  id,
  children,
  ...Rest
}: SelectProps) {
  const SelectEl = (
    <select
      id={id}
      className={["select", Error ? "input--error" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={Error ? true : undefined}
      {...Rest}
    >
      {children}
    </select>
  );

  if (!Label) return SelectEl;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {Label}
      </label>
      {SelectEl}
      {Error && (
        <span className="field-error" role="alert">
          {Error}
        </span>
      )}
    </div>
  );
}
