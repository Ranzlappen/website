/*
 * CHANGE: New file – Horizontal bar chart visualization for metric results
 * REASON: Alternative to radar chart, more readable on mobile and for 2-choice metrics
 * DATE: 2026-04-13
 */
import { motion } from 'framer-motion';
import type { Metric } from '../types';

interface Props {
  metric: Metric;
}

export default function BarChart({ metric }: Props) {
  const totalVotes = metric.choices.reduce((s, c) => s + c.votes, 0);

  // Build accessible summary
  const summary = metric.choices
    .map((c) => `${c.label}: ${c.votes} vote${c.votes !== 1 ? 's' : ''} (${totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0}%)`)
    .join(', ');

  return (
    <div
      className="space-y-2.5"
      role="img"
      aria-label={`Bar chart for ${metric.label}: ${summary}`}
    >
      {metric.choices.map((choice, i) => {
        const pct = totalVotes > 0 ? (choice.votes / totalVotes) * 100 : 0;
        const roundedPct = Math.round(pct);

        return (
          <div key={choice.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-white/10"
                  style={{ backgroundColor: choice.color }}
                />
                <span className="text-gray-300 truncate">{choice.label}</span>
              </div>
              <span className="text-xs text-gray-500 font-mono tabular-nums">
                {choice.votes} ({roundedPct}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-200 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: choice.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
