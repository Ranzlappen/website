/*
 * CHANGE: New file – User engagement stats display
 * REASON: Show voting activity in the navbar for engagement feedback
 * DATE: 2026-04-13
 */
import { Vote } from 'lucide-react';
import { useStore } from '../hooks/useStore';

export default function UserStats() {
  const votedMap = useStore((s) => s.votedMap);

  const topicCount = Object.keys(votedMap).length;
  const totalVotes = Object.values(votedMap).reduce(
    (sum, metrics) => sum + Object.keys(metrics).length,
    0,
  );

  if (topicCount === 0) return null;

  return (
    <span
      className="hidden sm:flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-[11px] font-medium text-gray-400"
      title={`${totalVotes} votes across ${topicCount} topics`}
    >
      <Vote size={12} className="text-brand-400" />
      {topicCount} topic{topicCount !== 1 ? 's' : ''}
    </span>
  );
}
