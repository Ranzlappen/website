import { useStore } from '../store';

export default function Toast() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center gap-3 min-w-[280px] ${
            toast.type === 'error'
              ? 'bg-red-900/80 border-red-700 text-red-100'
              : toast.type === 'success'
                ? 'bg-green-900/80 border-green-700 text-green-100'
                : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text)]'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-60 hover:opacity-100 text-lg leading-none"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
