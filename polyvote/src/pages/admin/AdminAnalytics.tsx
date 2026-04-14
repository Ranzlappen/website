import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Vote } from 'lucide-react';
import { adminGetAnalyticsFn } from '../../firebase';
import { useStore } from '../../hooks/useStore';
import StatCard from './components/StatCard';

interface AnalyticsData {
  totals: {
    topics: number;
    users: number;
    requests: number;
    pendingReports: number;
    totalVotes: number;
    newUsersToday: number;
  };
  topTopics: { id: string; title: string; votes: number }[];
  categoryBreakdown: Record<string, number>;
}

const categoryColors: Record<string, string> = {
  Politics: 'bg-red-400',
  Technology: 'bg-blue-400',
  Science: 'bg-purple-400',
  Culture: 'bg-pink-400',
  Environment: 'bg-green-400',
  Health: 'bg-emerald-400',
  Sports: 'bg-orange-400',
  Other: 'bg-gray-400',
};

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await adminGetAnalyticsFn({});
        setData(result.data as AnalyticsData);
      } catch (err) {
        console.error(err);
        addToast('Failed to load analytics.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-100">Analytics</h1>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const totals = data?.totals ?? { topics: 0, users: 0, totalVotes: 0, newUsersToday: 0, requests: 0, pendingReports: 0 };
  const breakdown = data?.categoryBreakdown ?? {};
  const totalTopics = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Analytics</h1>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Topics" value={totals.topics} icon={<BarChart3 size={20} />} />
        <StatCard label="Total Users" value={totals.users} icon={<Users size={20} />} color="text-blue-400" />
        <StatCard label="Total Votes" value={totals.totalVotes.toLocaleString()} icon={<Vote size={20} />} color="text-purple-400" />
        <StatCard label="New Users Today" value={totals.newUsersToday} icon={<TrendingUp size={20} />} color="text-green-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Topics by Category</h2>
          <div className="space-y-3">
            {Object.entries(breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => {
                const pct = Math.round((count / totalTopics) * 100);
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-300">{category}</span>
                      <span className="text-xs text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${categoryColors[category] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top Topics */}
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Top Topics by Votes</h2>
          {(data?.topTopics ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No voting data yet.</p>
          ) : (
            <div className="space-y-2">
              {(data?.topTopics ?? []).map((t, i) => {
                const maxVotes = data?.topTopics[0]?.votes || 1;
                const pct = Math.round((t.votes / maxVotes) * 100);
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-300 truncate mr-2">
                        <span className="text-gray-500">#{i + 1}</span> {t.title}
                      </span>
                      <span className="flex-shrink-0 text-xs text-gray-500">{t.votes}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
