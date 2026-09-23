import { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  trailing?: ReactNode;
}

export default function Input({
  label: Label,
  hint: Hint,
  error: Error,
  trailing: Trailing,
  className,
  id,
  ...Rest
}: InputProps) {
  const InputEl = (
    <input
      id={id}
      className={["input", Error ? "input--error" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={Error ? true : undefined}
      {...Rest}
    />
  );

  return (
    <div className="field">
      {Label && (
        <label className="field__label" htmlFor={id}>
          {Label}
        </label>
      )}
      {Trailing ? (
        <div className="input-group">
          {InputEl}
          {Trailing}
        </div>
      ) : (
        InputEl
      )}
      {Hint && !Error && <span className="field__hint">{Hint}</span>}
      {Error && (
        <span className="field-error" role="alert">
          {Error}
        </span>
      )}
    </div>
  );
}
