/*
 * CHANGE: New file – Toast notification container
 * REASON: Displays transient success/error/info messages
 * DATE: 2026-04-02
 */
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useStore } from '../hooks/useStore';

const iconMap = {
  success: <CheckCircle2 size={18} className="text-brand-400" />,
  error: <AlertCircle size={18} className="text-red-400" />,
  info: <Info size={18} className="text-blue-400" />,
};

export default function Toast() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="pointer-events-auto flex items-start gap-2 rounded-lg border border-surface-200 bg-surface-100 px-4 py-3 shadow-lg sm:max-w-sm"
          >
            <span className="shrink-0 mt-0.5">{iconMap[t.type]}</span>
            <span className="text-sm text-gray-200 flex-1 min-w-0 break-words">{t.text}</span>
            <button
              onClick={() => removeToast(t.id)}
              aria-label={`Dismiss: ${t.text}`}
              className="ml-2 shrink-0 text-gray-500 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
