import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db, adminUpdateRequestStatusFn, adminBulkUpdateRequestsFn } from '../../firebase';
import { useStore } from '../../hooks/useStore';
import type { ChangeRequest } from '../../types';
import DataTable from './components/DataTable';

export default function AdminRequests() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChangeRequest[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await adminUpdateRequestStatusFn({ requestId: id, status });
      addToast(`Request ${status}.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update request.', 'error');
    }
  };

  const handleBulkAction = async (status: 'approved' | 'rejected') => {
    if (selected.size === 0) return;
    try {
      await adminBulkUpdateRequestsFn({ requestIds: [...selected], status });
      addToast(`${selected.size} requests ${status}.`, 'success');
      setSelected(new Set());
    } catch (err) {
      console.error(err);
      addToast('Failed to perform bulk action.', 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const statusBadge: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  const typeBadge: Record<string, string> = {
    edit: 'bg-blue-500/20 text-blue-400',
    add: 'bg-brand-500/20 text-brand-400',
    delete: 'bg-red-500/20 text-red-400',
  };

  const columns = [
    {
      key: 'select',
      label: '',
      render: (r: ChangeRequest) =>
        r.status === 'pending' ? (
          <input
            type="checkbox"
            checked={selected.has(r.id)}
            onChange={() => toggleSelect(r.id)}
            className="rounded"
          />
        ) : null,
    },
    {
      key: 'type',
      label: 'Type',
      render: (r: ChangeRequest) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${typeBadge[r.type]}`}>
          {r.type}
        </span>
      ),
    },
    {
      key: 'topic',
      label: 'Topic',
      render: (r: ChangeRequest) => (
        <span className="text-sm text-gray-300 truncate max-w-xs block">{r.topicTitle}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (r: ChangeRequest) => (
        <span className="text-sm text-gray-400 truncate max-w-xs block">{r.description}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: ChangeRequest) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge[r.status]}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: 'time',
      label: 'Time',
      render: (r: ChangeRequest) => (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={12} />
          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: ChangeRequest) =>
        r.status === 'pending' ? (
          <div className="flex gap-1">
            <button
              onClick={() => handleStatusChange(r.id, 'approved')}
              className="rounded-lg p-1.5 text-gray-500 hover:text-green-400"
              title="Approve"
            >
              <CheckCircle2 size={14} />
            </button>
            <button
              onClick={() => handleStatusChange(r.id, 'rejected')}
              className="rounded-lg p-1.5 text-gray-500 hover:text-red-400"
              title="Reject"
            >
              <XCircle size={14} />
            </button>
          </div>
        ) : null,
    },
  ];

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

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
          <span className="text-sm text-gray-300">{selected.size} selected</span>
          <button
            onClick={() => handleBulkAction('approved')}
            className="flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20"
          >
            <CheckCircle2 size={14} /> Approve All
          </button>
          <button
            onClick={() => handleBulkAction('rejected')}
            className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
          >
            <XCircle size={14} /> Reject All
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : (
        <DataTable
          columns={columns}
          data={requests}
          pageSize={15}
          emptyMessage="No change requests."
        />
      )}
    </div>
  );
}
