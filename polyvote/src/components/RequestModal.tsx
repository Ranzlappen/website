import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Trash2, Plus, Undo2 } from 'lucide-react';
import { createChangeRequestFn } from '../firebase';
import { useStore } from '../hooks/useStore';
import type { Topic, Metric, ProposedChange } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  topic: Topic;
}

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

export default function RequestModal({ open, onClose, topic }: Props) {
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);
  const [description, setDescription] = useState('');
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // New metric form state
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [newMetricLabel, setNewMetricLabel] = useState('');
  const [newMetricChoices, setNewMetricChoices] = useState([
    { label: '', color: PRESET_COLORS[0] },
    { label: '', color: PRESET_COLORS[1] },
  ]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setChanges([]);
      setDescription('');
      setShowAddMetric(false);
      setNewMetricLabel('');
      setNewMetricChoices([
        { label: '', color: PRESET_COLORS[0] },
        { label: '', color: PRESET_COLORS[1] },
      ]);
    }
  }, [open]);

  // Focus trap and Escape
  useEffect(() => {
    if (!open) return;
    const el = modalRef.current;
    if (el) el.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && el) {
        const focusable = el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // ── Change helpers ──

  const hasChange = (metricId: string, choiceId?: string, action?: string) =>
    changes.some((c) =>
      c.metricId === metricId &&
      (!choiceId || c.choiceId === choiceId) &&
      (!action || c.action === action)
    );

  const removeChange = (changeId: string) =>
    setChanges((prev) => prev.filter((c) => c.changeId !== changeId));

  // Edit metric label
  const editMetricLabel = (metric: Metric, newLabel: string) => {
    const existing = changes.find(
      (c) => c.metricId === metric.id && c.action === 'edit-metric'
    );
    if (existing) {
      setChanges((prev) =>
        prev.map((c) =>
          c.changeId === existing.changeId
            ? { ...c, newValue: { label: newLabel } }
            : c
        )
      );
    } else {
      setChanges((prev) => [
        ...prev,
        {
          changeId: crypto.randomUUID().slice(0, 8),
          action: 'edit-metric',
          metricId: metric.id,
          oldValue: { label: metric.label },
          newValue: { label: newLabel },
          status: 'pending' as const,
        },
      ]);
    }
  };

  // Delete metric
  const deleteMetric = (metric: Metric) => {
    if (hasChange(metric.id, undefined, 'delete-metric')) return;
    // Remove any choice-level changes for this metric
    setChanges((prev) => [
      ...prev.filter((c) => c.metricId !== metric.id),
      {
        changeId: crypto.randomUUID().slice(0, 8),
        action: 'delete-metric',
        metricId: metric.id,
        oldValue: { label: metric.label },
        status: 'pending' as const,
      },
    ]);
  };

  // Edit choice
  const editChoiceLabel = (metric: Metric, choiceId: string, oldLabel: string, newLabel: string) => {
    const existing = changes.find(
      (c) => c.metricId === metric.id && c.choiceId === choiceId && c.action === 'edit-choice'
    );
    if (existing) {
      setChanges((prev) =>
        prev.map((c) =>
          c.changeId === existing.changeId
            ? { ...c, newValue: { ...c.newValue, label: newLabel } }
            : c
        )
      );
    } else {
      setChanges((prev) => [
        ...prev,
        {
          changeId: crypto.randomUUID().slice(0, 8),
          action: 'edit-choice',
          metricId: metric.id,
          choiceId,
          oldValue: { label: oldLabel },
          newValue: { label: newLabel },
          status: 'pending' as const,
        },
      ]);
    }
  };

  const editChoiceColor = (metric: Metric, choiceId: string, oldColor: string, newColor: string) => {
    const existing = changes.find(
      (c) => c.metricId === metric.id && c.choiceId === choiceId && c.action === 'edit-choice'
    );
    if (existing) {
      setChanges((prev) =>
        prev.map((c) =>
          c.changeId === existing.changeId
            ? { ...c, newValue: { ...c.newValue, color: newColor } }
            : c
        )
      );
    } else {
      setChanges((prev) => [
        ...prev,
        {
          changeId: crypto.randomUUID().slice(0, 8),
          action: 'edit-choice',
          metricId: metric.id,
          choiceId,
          oldValue: { color: oldColor },
          newValue: { color: newColor },
          status: 'pending' as const,
        },
      ]);
    }
  };

  // Delete choice
  const deleteChoice = (metric: Metric, choiceId: string, choiceLabel: string) => {
    if (hasChange(metric.id, choiceId, 'delete-choice')) return;
    setChanges((prev) => [
      ...prev.filter((c) => !(c.metricId === metric.id && c.choiceId === choiceId)),
      {
        changeId: crypto.randomUUID().slice(0, 8),
        action: 'delete-choice',
        metricId: metric.id,
        choiceId,
        oldValue: { label: choiceLabel },
        status: 'pending' as const,
      },
    ]);
  };

  // Add choice to existing metric
  const [addChoiceMetric, setAddChoiceMetric] = useState<string | null>(null);
  const [addChoiceLabel, setAddChoiceLabel] = useState('');
  const [addChoiceColor, setAddChoiceColor] = useState(PRESET_COLORS[2]);

  const confirmAddChoice = (metricId: string) => {
    if (!addChoiceLabel.trim()) return;
    setChanges((prev) => [
      ...prev,
      {
        changeId: crypto.randomUUID().slice(0, 8),
        action: 'add-choice',
        metricId,
        newValue: { label: addChoiceLabel.trim(), color: addChoiceColor },
        status: 'pending' as const,
      },
    ]);
    setAddChoiceMetric(null);
    setAddChoiceLabel('');
    setAddChoiceColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
  };

  // Add new metric
  const confirmAddMetric = () => {
    if (!newMetricLabel.trim()) return;
    if (newMetricChoices.some((c) => !c.label.trim())) return;
    const metricId = `new-${crypto.randomUUID().slice(0, 8)}`;
    setChanges((prev) => [
      ...prev,
      {
        changeId: crypto.randomUUID().slice(0, 8),
        action: 'add-metric',
        metricId,
        newValue: {
          label: newMetricLabel.trim(),
          choices: newMetricChoices.map((c, i) => ({
            id: `choice-${i}`,
            label: c.label.trim(),
            color: c.color,
            votes: 0,
          })),
        },
        status: 'pending' as const,
      },
    ]);
    setShowAddMetric(false);
    setNewMetricLabel('');
    setNewMetricChoices([
      { label: '', color: PRESET_COLORS[0] },
      { label: '', color: PRESET_COLORS[1] },
    ]);
  };

  const handleSubmit = async () => {
    if (changes.length === 0) {
      addToast('No changes proposed. Edit metrics or choices above.', 'error');
      return;
    }
    if (!user) {
      addToast('You must be signed in to submit a request.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createChangeRequestFn({
        topicId: topic.id,
        topicTitle: topic.title,
        description: description.trim(),
        changes,
      });
      addToast('Change request submitted!', 'success');
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to submit request.';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isMetricDeleted = (metricId: string) =>
    changes.some((c) => c.metricId === metricId && c.action === 'delete-metric');

  const isChoiceDeleted = (metricId: string, choiceId: string) =>
    changes.some((c) => c.metricId === metricId && c.choiceId === choiceId && c.action === 'delete-choice');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60"
          />

          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-modal-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-surface-200 bg-surface-100 p-6 shadow-xl sm:inset-x-auto focus:outline-none"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="request-modal-title" className="text-lg font-semibold text-gray-100">
                Propose Changes
              </h2>
              <button onClick={onClose} aria-label="Close dialog" className="text-gray-500 hover:text-gray-300 rounded">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-1">
              Topic: <span className="text-gray-200">{topic.title}</span>
            </p>
            <p className="text-xs text-gray-500 mb-5">
              Edit, delete, or add metrics and choices below. Each change will be individually reviewed.
            </p>

            {/* ── Metrics / Choices editor ── */}
            <div className="space-y-4 mb-5">
              {topic.metrics.map((metric) => {
                const metricDeleted = isMetricDeleted(metric.id);
                const metricEdit = changes.find(
                  (c) => c.metricId === metric.id && c.action === 'edit-metric'
                );

                return (
                  <div
                    key={metric.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      metricDeleted
                        ? 'border-red-500/30 bg-red-500/5 opacity-60'
                        : 'border-surface-200 bg-surface-50'
                    }`}
                  >
                    {/* Metric header */}
                    <div className="flex items-center gap-2 mb-3">
                      {metricEdit ? (
                        <input
                          type="text"
                          value={metricEdit.newValue?.label ?? metric.label}
                          onChange={(e) => editMetricLabel(metric, e.target.value)}
                          className="flex-1 rounded-lg border border-brand-400/50 bg-surface-100 px-2 py-1 text-sm text-gray-200 focus:border-brand-400 focus:outline-none"
                        />
                      ) : (
                        <span className="flex-1 text-sm font-medium text-gray-200">{metric.label}</span>
                      )}

                      {!metricDeleted && (
                        <div className="flex items-center gap-1">
                          {metricEdit ? (
                            <button
                              onClick={() => removeChange(metricEdit.changeId)}
                              title="Undo edit"
                              className="rounded p-1 text-gray-500 hover:text-brand-400"
                            >
                              <Undo2 size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => editMetricLabel(metric, metric.label)}
                              title="Edit metric label"
                              className="rounded p-1 text-gray-500 hover:text-brand-400"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteMetric(metric)}
                            title="Delete metric"
                            className="rounded p-1 text-gray-500 hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      {metricDeleted && (
                        <button
                          onClick={() => {
                            const c = changes.find(
                              (ch) => ch.metricId === metric.id && ch.action === 'delete-metric'
                            );
                            if (c) removeChange(c.changeId);
                          }}
                          title="Undo delete"
                          className="rounded p-1 text-red-400 hover:text-gray-300"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Choices */}
                    {!metricDeleted && (
                      <div className="space-y-2 ml-2">
                        {metric.choices.map((choice) => {
                          const choiceDeleted = isChoiceDeleted(metric.id, choice.id);
                          const choiceEdit = changes.find(
                            (c) =>
                              c.metricId === metric.id &&
                              c.choiceId === choice.id &&
                              c.action === 'edit-choice'
                          );

                          return (
                            <div
                              key={choice.id}
                              className={`flex items-center gap-2 ${choiceDeleted ? 'opacity-40 line-through' : ''}`}
                            >
                              {choiceEdit ? (
                                <>
                                  <input
                                    type="color"
                                    value={choiceEdit.newValue?.color ?? choice.color}
                                    onChange={(e) =>
                                      editChoiceColor(metric, choice.id, choice.color, e.target.value)
                                    }
                                    className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                                  />
                                  <input
                                    type="text"
                                    value={choiceEdit.newValue?.label ?? choice.label}
                                    onChange={(e) =>
                                      editChoiceLabel(metric, choice.id, choice.label, e.target.value)
                                    }
                                    className="flex-1 rounded-lg border border-brand-400/50 bg-surface-100 px-2 py-1 text-sm text-gray-200 focus:border-brand-400 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => removeChange(choiceEdit.changeId)}
                                    title="Undo edit"
                                    className="rounded p-1 text-gray-500 hover:text-brand-400"
                                  >
                                    <Undo2 size={12} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span
                                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: choice.color }}
                                  />
                                  <span className="flex-1 text-sm text-gray-300">{choice.label}</span>
                                  {!choiceDeleted && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          editChoiceLabel(metric, choice.id, choice.label, choice.label);
                                          editChoiceColor(metric, choice.id, choice.color, choice.color);
                                        }}
                                        title="Edit choice"
                                        className="rounded p-1 text-gray-600 hover:text-brand-400"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        onClick={() => deleteChoice(metric, choice.id, choice.label)}
                                        title="Delete choice"
                                        className="rounded p-1 text-gray-600 hover:text-red-400"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                  {choiceDeleted && (
                                    <button
                                      onClick={() => {
                                        const c = changes.find(
                                          (ch) =>
                                            ch.metricId === metric.id &&
                                            ch.choiceId === choice.id &&
                                            ch.action === 'delete-choice'
                                        );
                                        if (c) removeChange(c.changeId);
                                      }}
                                      title="Undo delete"
                                      className="rounded p-1 text-red-400 hover:text-gray-300"
                                    >
                                      <Undo2 size={12} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}

                        {/* Add choice inline */}
                        {addChoiceMetric === metric.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={addChoiceColor}
                              onChange={(e) => setAddChoiceColor(e.target.value)}
                              className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={addChoiceLabel}
                              onChange={(e) => setAddChoiceLabel(e.target.value)}
                              placeholder="New choice label"
                              className="flex-1 rounded-lg border border-surface-200 bg-surface-100 px-2 py-1 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none"
                              onKeyDown={(e) => e.key === 'Enter' && confirmAddChoice(metric.id)}
                            />
                            <button
                              onClick={() => confirmAddChoice(metric.id)}
                              disabled={!addChoiceLabel.trim()}
                              className="rounded-lg bg-brand-400 px-2 py-1 text-xs text-surface disabled:opacity-50"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setAddChoiceMetric(null)}
                              className="text-xs text-gray-500 hover:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddChoiceMetric(metric.id)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-400 mt-1"
                          >
                            <Plus size={12} /> Add Choice
                          </button>
                        )}

                        {/* Show pending add-choice changes for this metric */}
                        {changes
                          .filter((c) => c.metricId === metric.id && c.action === 'add-choice')
                          .map((c) => (
                            <div key={c.changeId} className="flex items-center gap-2 text-xs text-brand-400">
                              <span
                                className="inline-block h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: c.newValue?.color }}
                              />
                              <span>+ {c.newValue?.label}</span>
                              <button
                                onClick={() => removeChange(c.changeId)}
                                className="text-gray-500 hover:text-red-400"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pending add-metric changes */}
              {changes
                .filter((c) => c.action === 'add-metric')
                .map((c) => (
                  <div
                    key={c.changeId}
                    className="rounded-xl border border-brand-400/30 bg-brand-400/5 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-brand-400">
                        + {c.newValue?.label}
                      </span>
                      <button
                        onClick={() => removeChange(c.changeId)}
                        className="ml-auto text-gray-500 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="ml-2 space-y-1">
                      {c.newValue?.choices?.map((ch) => (
                        <div key={ch.id} className="flex items-center gap-2 text-xs text-gray-400">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: ch.color }}
                          />
                          {ch.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {/* Add metric button */}
              {showAddMetric ? (
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-3">
                  <input
                    type="text"
                    value={newMetricLabel}
                    onChange={(e) => setNewMetricLabel(e.target.value)}
                    placeholder="New metric label"
                    className="w-full rounded-lg border border-surface-200 bg-surface-100 px-2 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none"
                  />
                  <div className="space-y-2">
                    {newMetricChoices.map((ch, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={ch.color}
                          onChange={(e) => {
                            const updated = [...newMetricChoices];
                            updated[i] = { ...updated[i], color: e.target.value };
                            setNewMetricChoices(updated);
                          }}
                          className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={ch.label}
                          onChange={(e) => {
                            const updated = [...newMetricChoices];
                            updated[i] = { ...updated[i], label: e.target.value };
                            setNewMetricChoices(updated);
                          }}
                          placeholder={`Choice ${i + 1}`}
                          className="flex-1 rounded-lg border border-surface-200 bg-surface-100 px-2 py-1 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none"
                        />
                        {newMetricChoices.length > 2 && (
                          <button
                            onClick={() => setNewMetricChoices((prev) => prev.filter((_, j) => j !== i))}
                            className="text-gray-500 hover:text-red-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {newMetricChoices.length < 6 && (
                      <button
                        onClick={() =>
                          setNewMetricChoices((prev) => [
                            ...prev,
                            { label: '', color: PRESET_COLORS[prev.length % PRESET_COLORS.length] },
                          ])
                        }
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-400"
                      >
                        <Plus size={12} /> Add Choice
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmAddMetric}
                      disabled={!newMetricLabel.trim() || newMetricChoices.some((c) => !c.label.trim())}
                      className="rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
                    >
                      Add Metric
                    </button>
                    <button
                      onClick={() => setShowAddMetric(false)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddMetric(true)}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-surface-200 px-4 py-3 text-sm text-gray-500 hover:text-brand-400 hover:border-brand-400/30 transition-colors w-full justify-center"
                >
                  <Plus size={16} /> Add New Metric
                </button>
              )}
            </div>

            {/* Changes summary */}
            {changes.length > 0 && (
              <div className="mb-4 rounded-lg border border-brand-400/20 bg-brand-400/5 px-3 py-2">
                <p className="text-xs font-medium text-brand-400 mb-1">{changes.length} change(s) proposed</p>
                <ul className="text-xs text-gray-400 space-y-0.5">
                  {changes.map((c) => (
                    <li key={c.changeId}>
                      {c.action === 'edit-metric' && `Rename metric "${c.oldValue?.label}" → "${c.newValue?.label}"`}
                      {c.action === 'delete-metric' && `Delete metric "${c.oldValue?.label}"`}
                      {c.action === 'edit-choice' && `Edit choice "${c.oldValue?.label || c.oldValue?.color}"`}
                      {c.action === 'delete-choice' && `Delete choice "${c.oldValue?.label}"`}
                      {c.action === 'add-choice' && `Add choice "${c.newValue?.label}"`}
                      {c.action === 'add-metric' && `Add metric "${c.newValue?.label}"`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Optional description */}
            <label htmlFor="request-description" className="block text-xs text-gray-400 mb-1">
              Reason for changes (optional)
            </label>
            <textarea
              id="request-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain why these changes are needed…"
              rows={2}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || changes.length === 0}
                className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : `Submit ${changes.length} Change(s)`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
