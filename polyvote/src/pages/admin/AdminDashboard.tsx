import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Users, FileText, Flag, Vote, TrendingUp } from 'lucide-react';
import { adminGetAnalyticsFn } from '../../firebase';
import { useStore } from '../../hooks/useStore';
import StatCard from './components/StatCard';
import { formatDistanceToNow } from 'date-fns';

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
  recentActivity: { id: string; action: string; actorId: string; timestamp: number; metadata: Record<string, unknown> }[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await adminGetAnalyticsFn({});
        setData(result.data as AnalyticsData);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        addToast('Failed to load dashboard data.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const totals = data?.totals ?? { topics: 0, users: 0, requests: 0, pendingReports: 0, totalVotes: 0, newUsersToday: 0 };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Topics" value={totals.topics} icon={<FileText size={20} />} />
        <StatCard label="Total Users" value={totals.users} icon={<Users size={20} />} color="text-blue-400" />
        <StatCard label="Total Votes" value={totals.totalVotes.toLocaleString()} icon={<Vote size={20} />} color="text-purple-400" />
        <StatCard label="Pending Requests" value={totals.requests} icon={<BarChart3 size={20} />} color="text-yellow-400" />
        <StatCard label="Pending Reports" value={totals.pendingReports} icon={<Flag size={20} />} color="text-red-400" />
        <StatCard label="New Users Today" value={totals.newUsersToday} icon={<TrendingUp size={20} />} color="text-green-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Topics */}
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Top Topics by Votes</h2>
          {(data?.topTopics ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No topics yet.</p>
          ) : (
            <div className="space-y-2">
              {(data?.topTopics ?? []).slice(0, 5).map((t, i) => (
                <Link
                  key={t.id}
                  to={`/topic/${t.id}`}
                  className="flex items-center justify-between text-sm text-gray-300 hover:text-brand-400 rounded-lg px-2 py-1.5 hover:bg-surface-100 transition-colors"
                >
                  <span className="truncate">
                    <span className="text-gray-500 mr-2">#{i + 1}</span>
                    {t.title}
                  </span>
                  <span className="flex-shrink-0 text-xs text-gray-500">{t.votes} votes</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Recent Activity</h2>
          {(data?.recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {(data?.recentActivity ?? []).slice(0, 8).map((event) => (
                <div key={event.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 truncate">
                    <span className="font-mono text-xs text-gray-500">{event.action}</span>
                  </span>
                  <span className="flex-shrink-0 text-xs text-gray-600">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/admin/topics" className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-center hover:border-brand-400/30 transition-colors">
          <FileText size={20} className="mx-auto mb-2 text-brand-400" />
          <span className="text-sm text-gray-300">Manage Topics</span>
        </Link>
        <Link to="/admin/users" className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-center hover:border-blue-400/30 transition-colors">
          <Users size={20} className="mx-auto mb-2 text-blue-400" />
          <span className="text-sm text-gray-300">Manage Users</span>
        </Link>
        <Link to="/admin/requests" className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-center hover:border-yellow-400/30 transition-colors">
          <BarChart3 size={20} className="mx-auto mb-2 text-yellow-400" />
          <span className="text-sm text-gray-300">Review Requests</span>
        </Link>
        <Link to="/admin/moderation" className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-center hover:border-red-400/30 transition-colors">
          <Flag size={20} className="mx-auto mb-2 text-red-400" />
          <span className="text-sm text-gray-300">Moderation</span>
        </Link>
      </div>
    </div>
  );
}
