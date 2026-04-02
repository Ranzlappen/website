/*
 * CHANGE: New file – Single-select colorful voting card for a metric choice
 * REASON: Interactive voting UI – each choice is a clickable card with color and count
 * DATE: 2026-04-02
 */
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Props {
  label: string;
  color: string;
  votes: number;
  totalMetricVotes: number;
  selected: boolean;
  disabled: boolean;
  onVote: () => void;
}

export default function VotingCard({
  label,
  color,
  votes,
  totalMetricVotes,
  selected,
  disabled,
  onVote,
}: Props) {
  const pct = totalMetricVotes > 0 ? Math.round((votes / totalMetricVotes) * 100) : 0;

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={onVote}
      disabled={disabled && !selected}
      className={`relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all ${
        selected
          ? 'border-white/30 ring-2 ring-white/20'
          : disabled
            ? 'border-surface-200 opacity-60 cursor-default'
            : 'border-surface-200 hover:border-white/20 cursor-pointer'
      }`}
    >
      {/* Colored progress bar background */}
      <div
        className="absolute inset-0 opacity-20 transition-all duration-500"
        style={{
          background: `linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%)`,
        }}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Color dot */}
          <span
            className="h-3 w-3 rounded-full ring-2 ring-white/10"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-gray-200">{label}</span>
          {selected && <Check size={14} className="text-brand-400" />}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{votes} vote{votes !== 1 ? 's' : ''}</span>
          {totalMetricVotes > 0 && (
            <span className="rounded bg-surface-200 px-1.5 py-0.5 font-mono">
              {pct}%
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
