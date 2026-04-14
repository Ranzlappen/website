import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const shortcuts = [
  { key: '/', label: 'Focus search' },
  { key: 't', label: 'Toggle theme' },
  { key: '?', label: 'Show this help' },
  { key: 'Esc', label: 'Close dialogs' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardHelp({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-surface-200 bg-surface-50 p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-100">Keyboard Shortcuts</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <dl className="space-y-2">
              {shortcuts.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <dt className="text-sm text-gray-400">{s.label}</dt>
                  <dd>
                    <kbd className="rounded border border-surface-200 bg-surface-100 px-2 py-0.5 font-mono text-xs text-gray-300">
                      {s.key}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
