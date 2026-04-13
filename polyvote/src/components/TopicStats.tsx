/*
 * CHANGE: New file – Topic statistics panel
 * REASON: Show aggregate stats like participants, consensus, and top choices
 * DATE: 2026-04-13
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp, Users, Target, Award } from 'lucide-react';
import type { Topic } from '../types';

interface Props {
  topic: Topic;
}

/** Calculate consensus score: 1 - normalized Shannon entropy (0 = split, 1 = unanimous) */
function consensusScore(votes: number[]): number {
  const total = votes.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const probs = votes.map((v) => v / total);
  const entropy = -probs.reduce((s, p) => (p > 0 ? s + p * Math.log2(p) : s), 0);
  const maxEntropy = Math.log2(votes.length);
  if (maxEntropy === 0) return 1;
  return Math.round((1 - entropy / maxEntropy) * 100);
}

export default function TopicStats({ topic }: Props) {
  const [expanded, setExpanded] = useState(false);

  const participants = Math.max(
    ...topic.metrics.map((m) => m.choices.reduce((sum, c) => sum + c.votes, 0)),
    0,
  );

  // Per-metric stats
  const metricStats = topic.metrics.map((m) => {
    const votes = m.choices.map((c) => c.votes);
    const totalVotes = votes.reduce((s, v) => s + v, 0);
    const topChoice = m.choices.reduce((best, c) => (c.votes > best.votes ? c : best), m.choices[0]);
    const score = consensusScore(votes);
    return { label: m.label, totalVotes, topChoice, consensus: score };
  });

  // Overall consensus
  const avgConsensus = metricStats.length > 0
    ? Math.round(metricStats.reduce((s, m) => s + m.consensus, 0) / metricStats.length)
    : 0;

  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 mt-8">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-gray-300 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 rounded-xl"
      >
        <span className="flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-400" />
          Topic Statistics
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={<Users size={16} className="text-blue-400" />}
                  label="Participants"
                  value={`~${participants}`}
                />
                <StatCard
                  icon={<Target size={16} className="text-brand-400" />}
                  label="Total Votes"
                  value={String(topic.totalVotes)}
                />
                <StatCard
                  icon={<Award size={16} className="text-yellow-400" />}
                  label="Avg. Consensus"
                  value={`${avgConsensus}%`}
                />
              </div>

              {/* Per-metric breakdown */}
              <div className="space-y-2">
                {metricStats.map((m) => (
                  <div key={m.label} className="rounded-lg border border-surface-200 bg-surface-100 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 font-medium">{m.label}</span>
                      <span className="text-xs text-gray-500">{m.totalVotes} votes</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: m.topChoice.color }}
                        />
                        Top: {m.topChoice.label}
                      </span>
                      <span className={`font-medium ${m.consensus >= 60 ? 'text-brand-400' : 'text-gray-500'}`}>
                        {m.consensus}% consensus
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-100 p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-lg font-bold text-gray-200">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}
