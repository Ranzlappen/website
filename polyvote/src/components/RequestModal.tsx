/*
 * CHANGE: New file – Modal for submitting change requests
 * REASON: Lets users request edits, additions, or deletions for topics/metrics
 * DATE: 2026-04-02
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../hooks/useStore';
import type { ChangeRequest } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  topicId: string;
  topicTitle: string;
}

export default function RequestModal({ open, onClose, topicId, topicTitle }: Props) {
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);
  const [type, setType] = useState<ChangeRequest['type']>('edit');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    if (!user) {
      addToast('You must be signed in to submit a request.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'requests'), {
        topicId,
        topicTitle,
        type,
        description: description.trim(),
        status: 'pending',
        createdAt: Date.now(),
        authorId: user.uid,
      });
      addToast('Request submitted!', 'success');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const code = err instanceof Error && 'code' in err ? (err as { code: string }).code : '';
      if (code === 'permission-denied') {
        addToast('Permission denied. Please refresh and try again.', 'error');
      } else if (code === 'unavailable' || code === 'deadline-exceeded') {
        addToast('Network error. Please check your connection.', 'error');
      } else {
        addToast(`Failed to submit request.${code ? ` (${code})` : ''}`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-lg rounded-xl border border-surface-200 bg-surface-100 p-6 shadow-xl sm:inset-x-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-100">Request Changes</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Topic: <span className="text-gray-200">{topicTitle}</span>
            </p>

            {/* Type selector */}
            <div className="flex gap-2 mb-4">
              {(['edit', 'add', 'delete'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    type === t
                      ? 'bg-brand-400 text-surface'
                      : 'bg-surface-200 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you'd like to change…"
              rows={4}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
