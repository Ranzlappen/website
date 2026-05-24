import { useEffect, useState } from 'react';
import Spinner from './Spinner';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
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
  const [busy, setBusy] = useState(false);

  // Escape closes — but never while an action is in flight.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (!busy) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4"
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-[var(--text-muted)] mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            disabled={busy}
            className="px-4 py-2 rounded border border-[var(--border)] hover:border-[var(--accent)] text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            aria-busy={busy}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-60 ${
              destructive
                ? 'bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]'
                : 'bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
