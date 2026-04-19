import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db, adminUpdateRequestStatusFn, adminBulkUpdateRequestsFn } from '../../firebase';
import { useStore } from '../../hooks/useStore';
import type { ChangeRequest, ProposedChange } from '../../types';

const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  partial: 'bg-blue-500/20 text-blue-400',
};

const actionLabel: Record<string, string> = {
  'edit-metric': 'Edit metric',
  'delete-metric': 'Delete metric',
  'edit-choice': 'Edit choice',
  'delete-choice': 'Delete choice',
  'add-metric': 'Add metric',
  'add-choice': 'Add choice',
};

const actionColor: Record<string, string> = {
  'edit-metric': 'text-blue-400',
  'delete-metric': 'text-red-400',
  'edit-choice': 'text-blue-400',
  'delete-choice': 'text-red-400',
  'add-metric': 'text-green-400',
  'add-choice': 'text-green-400',
};

function ChangeItem({
  change,
  onApprove,
  onReject,
  disabled,
}: {
  change: ProposedChange;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-200 last:border-0">
      <span className={`text-xs font-medium w-28 shrink-0 ${actionColor[change.action] || 'text-gray-400'}`}>
        {actionLabel[change.action] || change.action}
      </span>

      <div className="flex-1 text-sm text-gray-300">
        {/* Show diff */}
        {change.action === 'edit-metric' && (
          <>
            <span className="text-red-400/70 line-through">{change.oldValue?.label}</span>
            {' → '}
            <span className="text-green-400">{change.newValue?.label}</span>
          </>
        )}
        {change.action === 'delete-metric' && (
          <span className="text-red-400">{change.oldValue?.label}</span>
        )}
        {change.action === 'edit-choice' && (
          <span className="flex items-center gap-2">
            {change.oldValue?.label && (
              <span className="text-red-400/70 line-through">{change.oldValue.label}</span>
            )}
            {change.newValue?.label && (
              <>
                {change.oldValue?.label ? ' → ' : ''}
                <span className="text-green-400">{change.newValue.label}</span>
              </>
            )}
            {change.newValue?.color && (
              <span
                className="inline-block h-3 w-3 rounded-full border border-white/20"
                style={{ backgroundColor: change.newValue.color }}
                title={`New color: ${change.newValue.color}`}
              />
            )}
          </span>
        )}
        {change.action === 'delete-choice' && (
          <span className="text-red-400">{change.oldValue?.label}</span>
        )}
        {change.action === 'add-choice' && (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: change.newValue?.color }}
            />
            <span className="text-green-400">{change.newValue?.label}</span>
          </span>
        )}
        {change.action === 'add-metric' && (
          <span>
            <span className="text-green-400">{change.newValue?.label}</span>
            <span className="text-gray-500 text-xs ml-2">
              ({change.newValue?.choices?.map((c) => c.label).join(', ')})
            </span>
          </span>
        )}
      </div>

      {/* Per-change status or actions */}
      {change.status === 'pending' ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onApprove}
            disabled={disabled}
            className="rounded p-1 text-gray-500 hover:text-green-400 disabled:opacity-50"
            title="Approve this change"
          >
            <CheckCircle2 size={16} />
          </button>
          <button
            onClick={onReject}
            disabled={disabled}
            className="rounded p-1 text-gray-500 hover:text-red-400 disabled:opacity-50"
            title="Reject this change"
          >
            <XCircle size={16} />
          </button>
        </div>
      ) : (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusBadge[change.status]}`}>
          {change.status}
        </span>
      )}
    </div>
  );
}

function RequestCard({
  req,
  onReviewChanges,
}: {
  req: ChangeRequest;
  onReviewChanges: (requestId: string, changeStatuses: { changeId: string; status: 'approved' | 'rejected' }[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(req.status === 'pending');
  const [reviewing, setReviewing] = useState(false);
  const addToast = useStore((s) => s.addToast);

  const pendingChanges = req.changes?.filter((c) => c.status === 'pending') || [];
  const hasChanges = req.changes && req.changes.length > 0;

  const handleReviewSingle = async (changeId: string, status: 'approved' | 'rejected') => {
    setReviewing(true);
    try {
      await onReviewChanges(req.id, [{ changeId, status }]);
    } finally {
      setReviewing(false);
    }
  };

  const handleApproveAll = async () => {
    if (pendingChanges.length === 0) return;
    setReviewing(true);
    try {
      await onReviewChanges(
        req.id,
        pendingChanges.map((c) => ({ changeId: c.changeId, status: 'approved' as const }))
      );
      addToast('All changes approved and applied.', 'success');
    } catch {
      addToast('Failed to approve changes.', 'error');
    } finally {
      setReviewing(false);
    }
  };

  const handleRejectAll = async () => {
    if (pendingChanges.length === 0) return;
    setReviewing(true);
    try {
      await onReviewChanges(
        req.id,
        pendingChanges.map((c) => ({ changeId: c.changeId, status: 'rejected' as const }))
      );
      addToast('All changes rejected.', 'success');
    } catch {
      addToast('Failed to reject changes.', 'error');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-100/50 transition-colors"
      >
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge[req.status]}`}>
              {req.status}
            </span>
            <span className="text-xs text-gray-500">
              {hasChanges ? `${req.changes.length} change(s)` : 'No structured changes'}
            </span>
            {pendingChanges.length > 0 && (
              <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] font-medium text-yellow-400">
                {pendingChanges.length} pending
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-200 line-clamp-2 break-words">{req.topicTitle}</p>
          {req.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{req.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
          <Clock size={12} />
          {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
        </span>
        {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {/* Expanded: changes list */}
      {expanded && hasChanges && (
        <div className="px-5 pb-4 border-t border-surface-200">
          {/* Bulk actions */}
          {pendingChanges.length > 1 && (
            <div className="flex items-center gap-2 py-3 border-b border-surface-200">
              <span className="text-xs text-gray-400">Bulk:</span>
              <button
                onClick={handleApproveAll}
                disabled={reviewing}
                className="flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50"
              >
                <CheckCircle2 size={12} /> Approve All
              </button>
              <button
                onClick={handleRejectAll}
                disabled={reviewing}
                className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                <XCircle size={12} /> Reject All
              </button>
            </div>
          )}

          {/* Individual changes */}
          <div className="divide-y divide-surface-200">
            {req.changes.map((change) => (
              <ChangeItem
                key={change.changeId}
                change={change}
                onApprove={() => handleReviewSingle(change.changeId, 'approved')}
                onReject={() => handleReviewSingle(change.changeId, 'rejected')}
                disabled={reviewing}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChangeRequest[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleReviewChanges = async (
    requestId: string,
    changeStatuses: { changeId: string; status: 'approved' | 'rejected' }[]
  ) => {
    try {
      await adminUpdateRequestStatusFn({ requestId, changeStatuses });
    } catch (err) {
      console.error(err);
      addToast('Failed to update request.', 'error');
      throw err;
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  // Bulk operations on entire requests
  const handleBulkApprove = async () => {
    if (pendingRequests.length === 0) return;
    try {
      await adminBulkUpdateRequestsFn({
        requestIds: pendingRequests.map((r) => r.id),
        status: 'approved',
      });
      addToast(`${pendingRequests.length} requests approved.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to perform bulk action.', 'error');
    }
  };

  const handleBulkReject = async () => {
    if (pendingRequests.length === 0) return;
    try {
      await adminBulkUpdateRequestsFn({
        requestIds: pendingRequests.map((r) => r.id),
        status: 'rejected',
      });
      addToast(`${pendingRequests.length} requests rejected.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to perform bulk action.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">
          Change Requests ({requests.length})
        </h1>
        {pendingRequests.length > 0 && (
          <span className="rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
            {pendingRequests.length} pending
          </span>
        )}
      </div>

      {/* Bulk actions for all pending */}
      {pendingRequests.length > 1 && (
        <div className="flex items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
          <span className="text-sm text-gray-300">All {pendingRequests.length} pending requests:</span>
          <button
            onClick={handleBulkApprove}
            className="flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20"
          >
            <CheckCircle2 size={14} /> Approve All
          </button>
          <button
            onClick={handleBulkReject}
            className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
          >
            <XCircle size={14} /> Reject All
          </button>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-gray-500 rounded-xl border border-surface-200 bg-surface-50">
          No change requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestCard key={req.id} req={req} onReviewChanges={handleReviewChanges} />
          ))}
        </div>
      )}
    </div>
  );
}
