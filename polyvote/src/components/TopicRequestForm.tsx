/*
 * CHANGE: New file – Structured form for proposing entirely new topics
 * REASON: Users can submit topic proposals with title, description, category, metrics, and choices
 * DATE: 2026-04-03
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { createTopicRequestFn } from '../firebase';
import { useStore } from '../hooks/useStore';
import type { Category } from '../types';

const CATEGORIES: Category[] = [
  'Politics',
  'Technology',
  'Science',
  'Culture',
  'Environment',
  'Health',
  'Sports',
  'Other',
];

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

interface MetricDraft {
  label: string;
  choices: { label: string; color: string }[];
}

function generateId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || crypto.randomUUID().slice(0, 8);
}

export default function TopicRequestForm() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [metrics, setMetrics] = useState<MetricDraft[]>([
    { label: '', choices: [{ label: '', color: PRESET_COLORS[0] }, { label: '', color: PRESET_COLORS[1] }] },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const updateMetricLabel = (mi: number, label: string) => {
    setMetrics((prev) => prev.map((m, i) => (i === mi ? { ...m, label } : m)));
  };

  const addMetric = () => {
    if (metrics.length >= 6) return;
    setMetrics((prev) => [
      ...prev,
      { label: '', choices: [{ label: '', color: PRESET_COLORS[prev.length * 2 % PRESET_COLORS.length] }, { label: '', color: PRESET_COLORS[(prev.length * 2 + 1) % PRESET_COLORS.length] }] },
    ]);
  };

  const removeMetric = (mi: number) => {
    if (metrics.length <= 1) return;
    setMetrics((prev) => prev.filter((_, i) => i !== mi));
  };

  const updateChoiceLabel = (mi: number, ci: number, label: string) => {
    setMetrics((prev) =>
      prev.map((m, i) =>
        i === mi
          ? { ...m, choices: m.choices.map((c, j) => (j === ci ? { ...c, label } : c)) }
          : m,
      ),
    );
  };

  const updateChoiceColor = (mi: number, ci: number, color: string) => {
    setMetrics((prev) =>
      prev.map((m, i) =>
        i === mi
          ? { ...m, choices: m.choices.map((c, j) => (j === ci ? { ...c, color } : c)) }
          : m,
      ),
    );
  };

  const addChoice = (mi: number) => {
    setMetrics((prev) =>
      prev.map((m, i) => {
        if (i !== mi || m.choices.length >= 6) return m;
        return { ...m, choices: [...m.choices, { label: '', color: PRESET_COLORS[m.choices.length % PRESET_COLORS.length] }] };
      }),
    );
  };

  const removeChoice = (mi: number, ci: number) => {
    setMetrics((prev) =>
      prev.map((m, i) => {
        if (i !== mi || m.choices.length <= 2) return m;
        return { ...m, choices: m.choices.filter((_, j) => j !== ci) };
      }),
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required.';
    if (!description.trim()) return 'Description is required.';
    for (let mi = 0; mi < metrics.length; mi++) {
      if (!metrics[mi].label.trim()) return `Metric ${mi + 1} needs a label.`;
      for (let ci = 0; ci < metrics[mi].choices.length; ci++) {
        if (!metrics[mi].choices[ci].label.trim())
          return `Metric ${mi + 1}, Choice ${ci + 1} needs a label.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      addToast(err, 'error');
      return;
    }
    if (!user) {
      addToast('You must be signed in to submit.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await createTopicRequestFn({
        title: title.trim(),
        description: description.trim(),
        category,
        metrics: metrics.map((m) => ({
          id: generateId(m.label),
          label: m.label.trim(),
          choices: m.choices.map((c) => ({
            id: generateId(c.label),
            label: c.label.trim(),
            color: c.color,
            votes: 0,
          })),
        })),
      });
      addToast('Topic proposal submitted!', 'success');
      navigate('/requests');
    } catch (e: unknown) {
      console.error(e);
      const code = e instanceof Error && 'code' in e ? (e as { code: string }).code : '';
      if (code === 'permission-denied') {
        addToast('Permission denied. Please refresh and try again.', 'error');
      } else if (code === 'unavailable' || code === 'deadline-exceeded') {
        addToast('Network error. Please check your connection.', 'error');
      } else {
        addToast(`Failed to submit proposal.${code ? ` (${code})` : ''}`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => navigate('/requests')}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-400"
      >
        <ArrowLeft size={14} /> Back to requests
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Propose a New Topic</h1>

        {/* Title */}
        <label htmlFor="proposal-title" className="block text-sm font-medium text-gray-300 mb-1">Title</label>
        <input
          id="proposal-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best Programming Language 2026"
          className="w-full rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 mb-4"
        />

        {/* Description */}
        <label htmlFor="proposal-description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
        <textarea
          id="proposal-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain what this topic is about…"
          rows={3}
          className="w-full rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 mb-4"
        />

        {/* Category */}
        <span id="proposal-category-label" className="block text-sm font-medium text-gray-300 mb-2">Category</span>
        <div role="radiogroup" aria-labelledby="proposal-category-label" className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              role="radio"
              aria-checked={category === cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                category === cat
                  ? 'bg-brand-400 text-surface'
                  : 'bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Metrics */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">Metrics</span>
            {metrics.length < 6 && (
              <button
                onClick={addMetric}
                className="flex items-center gap-1 text-xs text-brand-400 hover:underline"
              >
                <Plus size={12} /> Add Metric
              </button>
            )}
          </div>

          <div className="space-y-4">
            {metrics.map((metric, mi) => (
              <div key={mi} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                <div className="flex items-center gap-2 mb-3 min-w-0">
                  <input
                    type="text"
                    value={metric.label}
                    onChange={(e) => updateMetricLabel(mi, e.target.value)}
                    placeholder={`Metric ${mi + 1} label`}
                    className="flex-1 min-w-0 rounded-lg border border-surface-200 bg-surface-100 p-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
                  />
                  {metrics.length > 1 && (
                    <button
                      onClick={() => removeMetric(mi)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Choices */}
                <div className="space-y-2 ml-2">
                  {metric.choices.map((choice, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={choice.color}
                        onChange={(e) => updateChoiceColor(mi, ci, e.target.value)}
                        className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={choice.label}
                        onChange={(e) => updateChoiceLabel(mi, ci, e.target.value)}
                        placeholder={`Choice ${ci + 1}`}
                        className="flex-1 rounded-lg border border-surface-200 bg-surface-100 p-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
                      />
                      {metric.choices.length > 2 && (
                        <button
                          onClick={() => removeChoice(mi, ci)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {metric.choices.length < 6 && (
                    <button
                      onClick={() => addChoice(mi)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-400 mt-1"
                    >
                      <Plus size={12} /> Add Choice
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-lg bg-brand-400 px-4 py-3 text-sm font-medium text-surface disabled:opacity-50 hover:bg-brand-500 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Proposal'}
        </button>
      </motion.div>
    </div>
  );
}
