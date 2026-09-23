import Button from "./ui/Button";
import Modal from "./ui/Modal";

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  message: Message,
  confirmLabel: ConfirmLabel = "Confirm",
  cancelLabel: CancelLabel = "Cancel",
  busy: Busy = false,
  onConfirm: OnConfirm,
  onCancel: OnCancel,
}: ConfirmDialogProps) {
  return (
    <Modal onDismiss={Busy ? undefined : OnCancel}>
      <p>{Message}</p>
      <div className="modal-actions">
        <Button variant="secondary" onClick={OnCancel} disabled={Busy}>
          {CancelLabel}
        </Button>
        <Button variant="primary" onClick={OnConfirm} loading={Busy}>
          {ConfirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
