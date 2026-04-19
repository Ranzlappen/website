/*
 * CHANGE: Enhanced voting card with animated counters and vote confirmation effect
 * REASON: Polished voting UX with smooth transitions and visual feedback
 * DATE: 2026-04-13
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

/** Animated number that smoothly counts up/down. */
function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;

    const duration = 400;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
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
  const [justVoted, setJustVoted] = useState(false);
  const prevSelected = useRef(selected);

  // Trigger pulse animation when this card gets selected
  useEffect(() => {
    if (selected && !prevSelected.current) {
      setJustVoted(true);
      const timer = setTimeout(() => setJustVoted(false), 600);
      return () => clearTimeout(timer);
    }
    prevSelected.current = selected;
  }, [selected]);

  return (
    <motion.button
      role="radio"
      aria-checked={selected}
      aria-label={`${label}: ${votes} vote${votes !== 1 ? 's' : ''}, ${pct}%`}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={onVote}
      disabled={disabled && !selected}
      className={`relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        selected
          ? 'border-white/30 ring-2 ring-white/20'
          : disabled
            ? 'border-surface-200 opacity-60 cursor-default'
            : 'border-surface-200 hover:border-white/20 cursor-pointer'
      }`}
    >
      {/* Animated progress bar background */}
      <motion.div
        className="absolute inset-0 opacity-20"
        initial={false}
        animate={{
          background: `linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%)`,
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Vote confirmation pulse */}
      <AnimatePresence>
        {justVoted && (
          <motion.div
            initial={{ opacity: 0.4, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0 rounded-xl"
            style={{ backgroundColor: color }}
          />
        )}
      </AnimatePresence>

      <div className="relative flex flex-wrap items-center justify-between gap-y-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Color dot */}
          <span
            className="h-3 w-3 rounded-full ring-2 ring-white/10 shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-gray-200 truncate min-w-0">{label}</span>
          <AnimatePresence>
            {selected && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                <Check size={14} className="text-brand-400" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>
            <AnimatedCount value={votes} /> vote{votes !== 1 ? 's' : ''}
          </span>
          {totalMetricVotes > 0 && (
            <motion.span
              key={pct}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="rounded bg-surface-200 px-1.5 py-0.5 font-mono"
            >
              {pct}%
            </motion.span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
