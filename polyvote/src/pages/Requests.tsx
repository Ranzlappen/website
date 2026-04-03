/*
 * CHANGE: New file – Requests listing page with approve/reject controls
 * REASON: Displays all pending change requests; owner can approve or reject
 * DATE: 2026-04-02
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { db } from '../firebase';
import { useStore } from '../hooks/useStore';
import type { ChangeRequest } from '../types';

/** Badge styles by request status */
const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-brand-500/20 text-brand-400',
  rejected: 'bg-red-500/20 text-red-400',
};

/** Badge styles by request type */
const typeBadge: Record<string, string> = {
  edit: 'bg-blue-500/20 text-blue-400',
  add: 'bg-brand-500/20 text-brand-400',
  delete: 'bg-red-500/20 text-red-400',
};

export default function Requests() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChangeRequest[],
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'requests', id), { status });
      addToast(`Request ${status}.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update request.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-100">
        <FileText size={24} className="text-brand-400" />
        Change Requests
      </h1>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="py-20 text-center text-gray-500">No requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req, i) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-surface-200 bg-surface-50 p-5"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* Type badge */}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${typeBadge[req.type]}`}>
                  {req.type}
                </span>
                {/* Status badge */}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge[req.status]}`}>
                  {req.status}
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-1">
                Topic: <span className="text-gray-300">{req.topicTitle}</span>
              </p>
              <p className="text-sm text-gray-300">{req.description}</p>

              {/* Approve / Reject controls (visible for pending requests) */}
              {req.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => updateStatus(req.id, 'approved')}
                    className="flex items-center gap-1 rounded-lg bg-brand-400/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-400/20"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    onClick={() => updateStatus(req.id, 'rejected')}
                    className="flex items-center gap-1 rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/20"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
