import { ReactNode } from "react";

interface ModalProps {
  title?: ReactNode;
  children: ReactNode;
  onDismiss?: () => void;
}

export default function Modal({
  title: Title,
  children,
  onDismiss: OnDismiss,
}: ModalProps) {
  return (
    <div
      className="modal-overlay"
      role="alertdialog"
      aria-modal="true"
      onMouseDown={(Evt) => {
        if (Evt.target === Evt.currentTarget) OnDismiss?.();
      }}
    >
      <div className="modal-panel">
        {Title && <div className="modal-panel__title">{Title}</div>}
        {children}
      </div>
    </div>
  );
}
