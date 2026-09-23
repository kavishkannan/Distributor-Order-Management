interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message: Message,
  onRetry: OnRetry,
}: ErrorStateProps) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <span className="state-panel__icon" aria-hidden="true">
        {"⚠️"}
      </span>
      <span className="state-panel__title">Something went wrong</span>
      <p>{Message}</p>
      {OnRetry && (
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={OnRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}
