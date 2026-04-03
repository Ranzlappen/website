/*
 * CHANGE: New file – Full-page form for proposing new voting topics
 * REASON: Lets users submit structured topic proposals with metrics and choices
 *         for community endorsement before promotion to main voting
 * DATE: 2026-04-03
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Palette } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../hooks/useStore';
import { REQUEST_TIMEOUT_MS } from '../types';
import type { Category } from '../types';

const CATEGORIES: Category[] = [
  'Politics', 'Technology', 'Science', 'Culture',
  'Environment', 'Health', 'Sports', 'Other',
];

const COLOR_PALETTE = [
  '#f87171', '#fb923c', '#facc15', '#4ade80',
  '#60a5fa', '#c084fc', '#f472b6', '#d1d5db',
  '#34d399', '#a78bfa', '#fbbf24', '#38bdf8',
];

interface MetricDraft {
  label: string;
  choices: { label: string; color: string }[];
}

const newChoice = (index: number) => ({
  label: '',
  color: COLOR_PALETTE[index % COLOR_PALETTE.length],
});

const newMetric = (): MetricDraft => ({
  label: '',
  choices: [newChoice(0), newChoice(1)],
});

/** Converts a string to a URL-safe slug ID */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || `id-${Date.now()}`;
}

export default function TopicRequestForm() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [metrics, setMetrics] = useState<MetricDraft[]>([newMetric()]);
  const [submitting, setSubmitting] = useState(false);

  const updateMetric = (mi: number, patch: Partial<MetricDraft>) => {
    setMetrics((prev) => prev.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  };

  const updateChoice = (mi: number, ci: number, patch: Partial<{ label: string; color: string }>) => {
    setMetrics((prev) =>
      prev.map((m, i) => {
        if (i !== mi) return m;
        const choices = m.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c));
        return { ...m, choices };
      }),
    );
  };

  const addChoice = (mi: number) => {
    setMetrics((prev) =>
      prev.map((m, i) => {
        if (i !== mi || m.choices.length >= 6) return m;
        return { ...m, choices: [...m.choices, newChoice(m.choices.length)] };
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

  const addMetric = () => {
    if (metrics.length < 6) setMetrics((prev) => [...prev, newMetric()]);
  };

  const removeMetric = (mi: number) => {
    if (metrics.length > 1) setMetrics((prev) => prev.filter((_, i) => i !== mi));
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required.';
    if (!description.trim()) return 'Description is required.';
    for (let mi = 0; mi < metrics.length; mi++) {
      if (!metrics[mi].label.trim()) return `Metric ${mi + 1} needs a label.`;
      for (let ci = 0; ci < metrics[mi].choices.length; ci++) {
        if (!metrics[mi].choices[ci].label.trim())
          return `Metric ${mi + 1}, choice ${ci + 1} needs a label.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!user) {
      addToast('Authentication required. Please wait…', 'error');
      return;
    }
    const err = validate();
    if (err) {
      addToast(err, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const now = Date.now();
      await addDoc(collection(db, 'topicRequests'), {
        title: title.trim(),
        description: description.trim(),
        category,
        metrics: metrics.map((m) => ({
          id: slugify(m.label),
          label: m.label.trim(),
          choices: m.choices.map((c) => ({
            id: slugify(c.label),
            label: c.label.trim(),
            color: c.color,
            votes: 0,
          })),
        })),
        status: 'pending',
        createdAt: now,
        expiresAt: now + REQUEST_TIMEOUT_MS,
        authorId: user.uid,
        endorsers: [user.uid],
        endorsementCount: 1,
      });
      addToast('Topic proposal submitted!', 'success');
      navigate('/requests');
    } catch (e) {
      console.error(e);
      addToast('Failed to submit proposal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <button
        onClick={() => navigate('/requests')}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-400"
      >
        <ArrowLeft size={14} /> Back to requests
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-100 mb-1">Propose a New Topic</h1>
        <p className="text-sm text-gray-400 mb-8">
          Submit a structured topic for community voting. If {2} or more people endorse your
          proposal within 10 minutes, it will be promoted to the main voting board.
        </p>

        {/* ── Title ── */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-300 mb-1 block">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Universal Basic Income"
            className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
          />
        </label>

        {/* ── Description ── */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-300 mb-1 block">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the topic and what aspects voters should consider…"
            rows={3}
            className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
          />
        </label>

        {/* ── Category ── */}
        <div className="mb-6">
          <span className="text-sm font-medium text-gray-300 mb-2 block">Category</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? 'bg-brand-400 text-surface'
                    : 'bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">
              Metrics ({metrics.length}/6)
            </span>
            {metrics.length < 6 && (
              <button
                onClick={addMetric}
                className="flex items-center gap-1 rounded-lg bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-400 hover:bg-brand-400/20"
              >
                <Plus size={14} /> Add Metric
              </button>
            )}
          </div>

          <div className="space-y-4">
            {metrics.map((metric, mi) => (
              <motion.div
                key={mi}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-surface-200 bg-surface-50 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <input
                    value={metric.label}
                    onChange={(e) => updateMetric(mi, { label: e.target.value })}
                    placeholder={`Metric ${mi + 1} label (e.g. Preferred Approach)`}
                    className="flex-1 rounded-lg border border-surface-200 bg-surface px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
                  />
                  {metrics.length > 1 && (
                    <button
                      onClick={() => removeMetric(mi)}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                      title="Remove metric"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Choices */}
                <div className="space-y-2 ml-2">
                  {metric.choices.map((choice, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      {/* Color picker */}
                      <div className="relative group">
                        <button
                          className="h-7 w-7 rounded-md border border-surface-200"
                          style={{ backgroundColor: choice.color }}
                          title="Pick color"
                        />
                        <div className="absolute left-0 top-8 z-10 hidden group-hover:grid grid-cols-4 gap-1 rounded-lg border border-surface-200 bg-surface-100 p-2 shadow-xl">
                          {COLOR_PALETTE.map((c) => (
                            <button
                              key={c}
                              onClick={() => updateChoice(mi, ci, { color: c })}
                              className="h-6 w-6 rounded-md border border-surface-200 hover:ring-2 hover:ring-white/30"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>

                      <input
                        value={choice.label}
                        onChange={(e) => updateChoice(mi, ci, { label: e.target.value })}
                        placeholder={`Choice ${ci + 1}`}
                        className="flex-1 rounded-lg border border-surface-200 bg-surface px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
                      />

                      {metric.choices.length > 2 && (
                        <button
                          onClick={() => removeChoice(mi, ci)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                          title="Remove choice"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {metric.choices.length < 6 && (
                    <button
                      onClick={() => addChoice(mi)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-gray-300"
                    >
                      <Plus size={12} /> Add choice
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
          <button
            onClick={() => navigate('/requests')}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-brand-400 px-6 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Proposal'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
