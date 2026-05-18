interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-[var(--text-muted)] mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-[var(--border)] hover:border-[var(--accent)] text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
              destructive
                ? 'bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]'
                : 'bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
