import { useEffect, useState, useCallback } from 'react';
import { Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { adminListReportsFn, adminReviewReportFn, adminDeleteCommentFn } from '../../firebase';
import { useStore } from '../../hooks/useStore';
import type { ContentReport, ReportStatus } from '../../types';
import DataTable from './components/DataTable';

export default function AdminModeration() {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const addToast = useStore((s) => s.addToast);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminListReportsFn({
        pageSize: 50,
        statusFilter: statusFilter || undefined,
      });
      setReports((result.data as { reports: ContentReport[] }).reports);
    } catch (err) {
      console.error(err);
      addToast('Failed to load reports.', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, addToast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleReview = async (reportId: string, status: ReportStatus) => {
    try {
      await adminReviewReportFn({ reportId, status });
      addToast(`Report ${status}.`, 'success');
      fetchReports();
    } catch (err) {
      console.error(err);
      addToast('Failed to review report.', 'error');
    }
  };

  const handleDeleteComment = async (report: ContentReport) => {
    if (report.type !== 'comment' || !report.parentId) {
      addToast('Can only delete comment reports with a parent topic.', 'error');
      return;
    }
    if (!confirm('Delete this comment? This cannot be undone.')) return;
    try {
      await adminDeleteCommentFn({ topicId: report.parentId, commentId: report.targetId });
      await adminReviewReportFn({ reportId: report.id, status: 'action-taken' });
      addToast('Comment deleted and report resolved.', 'success');
      fetchReports();
    } catch (err) {
      console.error(err);
      addToast('Failed to delete comment.', 'error');
    }
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    reviewed: 'bg-blue-500/20 text-blue-400',
    'action-taken': 'bg-green-500/20 text-green-400',
    dismissed: 'bg-gray-500/20 text-gray-400',
  };

  const reasonColor: Record<string, string> = {
    spam: 'text-orange-400',
    harassment: 'text-red-400',
    misinformation: 'text-yellow-400',
    inappropriate: 'text-pink-400',
    other: 'text-gray-400',
  };

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (r: ContentReport) => (
        <span className="text-xs text-gray-400 capitalize">{r.type}</span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r: ContentReport) => (
        <span className={`text-xs font-medium capitalize ${reasonColor[r.reason] || 'text-gray-400'}`}>
          {r.reason}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Details',
      render: (r: ContentReport) => (
        <span className="text-xs text-gray-400 truncate max-w-xs block">
          {r.description || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: ContentReport) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor[r.status]}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: 'time',
      label: 'Reported',
      render: (r: ContentReport) => (
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: ContentReport) =>
        r.status === 'pending' ? (
          <div className="flex gap-1">
            {r.type === 'comment' && (
              <button
                onClick={() => handleDeleteComment(r)}
                className="rounded-lg p-1.5 text-gray-500 hover:text-red-400"
                title="Delete content & resolve"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => handleReview(r.id, 'reviewed')}
              className="rounded-lg p-1.5 text-gray-500 hover:text-blue-400"
              title="Mark reviewed"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={() => handleReview(r.id, 'dismissed')}
              className="rounded-lg p-1.5 text-gray-500 hover:text-gray-300"
              title="Dismiss"
            >
              <XCircle size={14} />
            </button>
          </div>
        ) : r.status === 'reviewed' ? (
          <button
            onClick={() => handleReview(r.id, 'action-taken')}
            className="rounded-lg p-1.5 text-gray-500 hover:text-green-400"
            title="Mark action taken"
          >
            <CheckCircle2 size={14} />
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-100">Content Moderation</h1>

      {/* Filter */}
      <div className="flex gap-2">
        {(['pending', 'reviewed', 'action-taken', 'dismissed', ''] as const).map((status) => (
          <button
            key={status || 'all'}
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === status
                ? 'bg-brand-400/10 text-brand-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : (
        <DataTable
          columns={columns}
          data={reports.map((r) => ({ ...r, id: r.id }))}
          pageSize={15}
          emptyMessage={statusFilter ? `No ${statusFilter} reports.` : 'No reports.'}
        />
      )}
    </div>
  );
}
