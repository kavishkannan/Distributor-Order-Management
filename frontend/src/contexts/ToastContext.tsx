import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AutoDismissMs = 4000;

export function ToastProvider({ children: Children }: { children: ReactNode }) {
  const [Toasts, SetToasts] = useState<ToastItem[]>([]);
  const NextId = useRef(1);

  const showToast = useCallback(
    (Message: string, Tone: ToastTone = "success") => {
      const Id = NextId.current;
      NextId.current += 1;
      SetToasts((Current) => [
        ...Current,
        { id: Id, message: Message, tone: Tone },
      ]);
      setTimeout(() => {
        SetToasts((Current) => Current.filter((T) => T.id !== Id));
      }, AutoDismissMs);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {Children}
      <div className="toast-viewport" aria-live="polite">
        {Toasts.map((Toast) => (
          <div
            className={`toast toast--${Toast.tone}`}
            key={Toast.id}
            role="status"
          >
            {Toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const Context = useContext(ToastContext);
  if (!Context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return Context;
}
