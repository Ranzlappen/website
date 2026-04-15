import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Users, Vote, Layers, TrendingUp, Award } from 'lucide-react';
import { getPublicStatsFn } from '../firebase';
import { categoryColor } from '../components/CategoryFilter';

interface PublicStats {
  totals: { topics: number; participants: number; totalVotes: number };
  categoryBreakdown: Record<string, number>;
  topTopics: { id: string; title: string; votes: number; category: string }[];
  trendingTopics: { id: string; title: string; votes: number; category: string }[];
  dailyTrends: { date: string; totalVotes: number; newTopics: number; activeUsers: number }[];
}

export default function Insights() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicStatsFn({})
      .then((result) => {
        setStats(result.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load insights:', err);
        setError('Failed to load insights. Please try again later.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-6">
          <div className="skeleton h-10 w-48 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
          </div>
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-400">
          {error || 'No data available.'}
        </div>
      </div>
    );
  }

  const { totals, categoryBreakdown, topTopics, trendingTopics, dailyTrends } = stats;
  const categories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCategoryCount = categories.length > 0 ? categories[0][1] : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-400/10 px-4 py-1.5 text-xs font-medium text-brand-400 mb-3">
          <BarChart3 size={14} />
          Community Insights
        </div>
        <h1 className="text-2xl font-bold text-gray-100 sm:text-3xl mb-2">Platform Insights</h1>
        <p className="text-gray-400">Live community statistics and voting trends across PolyVote.</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <StatCard icon={<Layers size={20} className="text-brand-400" />} label="Topics" value={totals.topics} />
        <StatCard icon={<Vote size={20} className="text-blue-400" />} label="Total Votes" value={totals.totalVotes} />
        <StatCard icon={<Users size={20} className="text-purple-400" />} label="Participants" value={totals.participants} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-surface-200 bg-surface-50 p-5"
        >
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Layers size={16} className="text-brand-400" />
            Topics by Category
          </h2>
          <div className="space-y-3">
            {categories.map(([cat, count]) => (
              <div key={cat}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${(categoryColor as Record<string, string>)[cat] || categoryColor.Other}`}>
                    {cat}
                  </span>
                  <span className="text-gray-500">{count} topic{count !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="h-full rounded-full bg-brand-400/60"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Topics */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-surface-200 bg-surface-50 p-5"
        >
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Award size={16} className="text-yellow-400" />
            Most Voted Topics
          </h2>
          <div className="space-y-2">
            {topTopics.map((topic, i) => (
              <Link
                key={topic.id}
                to={`/topic/${topic.id}`}
                className="flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-100 p-3 hover:border-brand-400/30 transition-colors"
              >
                <span className="text-lg font-bold text-gray-600 w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{topic.title}</p>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${(categoryColor as Record<string, string>)[topic.category] || categoryColor.Other}`}>
                    {topic.category}
                  </span>
                </div>
                <span className="text-sm font-semibold text-brand-400">{topic.votes}</span>
              </Link>
            ))}
            {topTopics.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No topics yet.</p>
            )}
          </div>
        </motion.div>

        {/* Trending Topics */}
        {trendingTopics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-surface-200 bg-surface-50 p-5"
          >
            <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-orange-400" />
              Trending Now
            </h2>
            <div className="space-y-2">
              {trendingTopics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/topic/${topic.id}`}
                  className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-100 p-3 hover:border-brand-400/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{topic.title}</p>
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${(categoryColor as Record<string, string>)[topic.category] || categoryColor.Other}`}>
                      {topic.category}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{topic.votes} votes</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Activity Trends */}
        {dailyTrends.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-surface-200 bg-surface-50 p-5"
          >
            <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-400" />
              Recent Activity (Last 30 Days)
            </h2>
            <div className="space-y-1.5">
              {dailyTrends.slice(-14).map((day) => {
                const maxVotes = Math.max(...dailyTrends.map((d) => d.totalVotes), 1);
                return (
                  <div key={day.date} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-16 shrink-0">{day.date.slice(5)}</span>
                    <div className="flex-1 h-3 rounded-full bg-surface-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400/60"
                        style={{ width: `${(day.totalVotes / maxVotes) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-500 w-8 text-right">{day.totalVotes}</span>
                  </div>
                );
              })}
            </div>
            {dailyTrends.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Activity data will appear after the first day.</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-surface-200 bg-surface-50 p-5 text-center"
    >
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-100">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{label}</div>
    </motion.div>
  );
}
