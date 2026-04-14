/*
 * CHANGE: Major rewrite – Topic proposals with endorsement system + existing change requests
 * REASON: Shows active topic proposals, endorsement/promotion flow, archived requests, and change requests
 * DATE: 2026-04-03
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Plus,
  ThumbsUp,
  ChevronDown,
  Archive,
  Sparkles,
} from 'lucide-react';
import { db, adminUpdateRequestStatusFn, endorseTopicRequestFn } from '../firebase';
import { useStore } from '../hooks/useStore';
import { useTopicRequests } from '../hooks/useTopicRequests';
import { categoryColor } from '../components/CategoryFilter';
import type { ChangeRequest, TopicRequest } from '../types';
import { REQUEST_ENDORSEMENTS_NEEDED } from '../types';

/** Badge styles by change-request status */
const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-brand-500/20 text-brand-400',
  rejected: 'bg-red-500/20 text-red-400',
};

/** Badge styles by change-request type */
const typeBadge: Record<string, string> = {
  edit: 'bg-blue-500/20 text-blue-400',
  add: 'bg-brand-500/20 text-brand-400',
  delete: 'bg-red-500/20 text-red-400',
};

export default function Requests() {
  // ── Change requests (existing system) ──
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [crLoading, setCrLoading] = useState(true);
  const addToast = useStore((s) => s.addToast);
  const user = useStore((s) => s.user);

  // ── Topic requests (new system) ──
  const { requests: topicRequests, loading: trLoading } = useTopicRequests();
  const [showArchived, setShowArchived] = useState(false);

  // Subscribe to change requests
  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setChangeRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChangeRequest[],
        );
        setCrLoading(false);
      },
      (err) => {
        console.error('Requests onSnapshot error:', err);
        setCrLoading(false);
      },
    );
    return unsub;
  }, []);

  // Expired requests are now archived by a scheduled Cloud Function (every 5 min)
  const now = Date.now();

  // Split topic requests into active vs archived
  const activeProposals = topicRequests.filter(
    (r) => r.status === 'pending' && r.expiresAt > now,
  );
  const archivedProposals = topicRequests.filter(
    (r) => r.status === 'archived' || r.status === 'promoted' || (r.status === 'pending' && r.expiresAt <= now),
  );

  // ── Endorse a topic request ──
  const handleEndorse = async (req: TopicRequest) => {
    if (!user) {
      addToast('You must be signed in to endorse.', 'error');
      return;
    }
    if (req.endorsers.includes(user.uid)) {
      addToast('You already endorsed this proposal.', 'info');
      return;
    }

    try {
      const result = await endorseTopicRequestFn({ requestId: req.id });
      const newCount = (result.data as { newCount: number }).newCount;

      if (newCount >= REQUEST_ENDORSEMENTS_NEEDED) {
        addToast('Topic promoted to main voting!', 'success');
      } else {
        addToast('Endorsement recorded!', 'success');
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to endorse.';
      addToast(message, 'error');
    }
  };

  // ── Update change request status (via Cloud Function) ──
  const updateCrStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await adminUpdateRequestStatusFn({ requestId: id, status });
      addToast(`Request ${status}.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update request.', 'error');
    }
  };

  const loading = trLoading && crLoading;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
          <FileText size={24} className="text-brand-400" />
          Requests
        </h1>
        <Link
          to="/requests/new"
          className="flex items-center justify-center gap-1 rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-surface hover:bg-brand-500 transition-colors w-full sm:w-auto"
        >
          <Plus size={16} /> Propose New Topic
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* ══════════ Section 1: Active Topic Proposals ══════════ */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-200 mb-4">
              <Sparkles size={18} className="text-brand-400" />
              Active Topic Proposals
            </h2>

            {activeProposals.length === 0 ? (
              <p className="py-8 text-center text-gray-500 rounded-xl border border-surface-200 bg-surface-50">
                No active proposals.{' '}
                <Link to="/requests/new" className="text-brand-400 hover:underline">
                  Be the first to propose a topic!
                </Link>
              </p>
            ) : (
              <div className="space-y-4">
                {activeProposals.map((req, i) => {
                  const timeLeft = req.expiresAt - now;
                  const minsLeft = Math.max(0, Math.ceil(timeLeft / 60000));
                  const alreadyEndorsed = user ? req.endorsers.includes(user.uid) : false;

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-xl border border-surface-200 bg-surface-50 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColor[req.category] || categoryColor.Other}`}>
                          {req.category}
                        </span>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-yellow-500/20 text-yellow-400">
                          pending
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={12} />
                          {minsLeft}m remaining
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-gray-100 mb-1">{req.title}</h3>
                      <p className="text-sm text-gray-400 mb-3">{req.description}</p>

                      {/* Metrics preview */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {req.metrics.map((m) => (
                          <div key={m.id} className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="text-gray-400">{m.label}:</span>
                            {m.choices.map((c) => (
                              <span
                                key={c.id}
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: c.color }}
                                title={c.label}
                              />
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* Endorsement */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {req.endorsementCount}/{REQUEST_ENDORSEMENTS_NEEDED} endorsements
                        </span>
                        {!alreadyEndorsed ? (
                          <button
                            onClick={() => handleEndorse(req)}
                            aria-label={`Endorse proposal: ${req.title}`}
                            className="flex items-center gap-1 rounded-lg bg-brand-400/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                          >
                            <ThumbsUp size={14} aria-hidden="true" /> Endorse
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-brand-400/60">
                            <CheckCircle2 size={14} /> Endorsed
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ══════════ Section 2: Change Requests ══════════ */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-200 mb-4">
              <FileText size={18} className="text-gray-400" />
              Change Requests
            </h2>

            {crLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="skeleton h-28 rounded-xl" />
                ))}
              </div>
            ) : changeRequests.length === 0 ? (
              <p className="py-8 text-center text-gray-500 rounded-xl border border-surface-200 bg-surface-50">
                No change requests yet.
              </p>
            ) : (
              <div className="space-y-4">
                {changeRequests.map((req, i) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl border border-surface-200 bg-surface-50 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${typeBadge[req.type]}`}>
                        {req.type}
                      </span>
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

                    {req.status === 'pending' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => updateCrStatus(req.id, 'approved')}
                          aria-label={`Approve change request for ${req.topicTitle}`}
                          className="flex items-center gap-1 rounded-lg bg-brand-400/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                        >
                          <CheckCircle2 size={14} aria-hidden="true" /> Approve
                        </button>
                        <button
                          onClick={() => updateCrStatus(req.id, 'rejected')}
                          aria-label={`Reject change request for ${req.topicTitle}`}
                          className="flex items-center gap-1 rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          <XCircle size={14} aria-hidden="true" /> Reject
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* ══════════ Section 3: Archived / Expired ══════════ */}
          {archivedProposals.length > 0 && (
            <section>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 text-lg font-semibold text-gray-400 mb-4 hover:text-gray-300"
              >
                <Archive size={18} />
                Archived / Expired ({archivedProposals.length})
                <ChevronDown
                  size={16}
                  className={`transition-transform ${showArchived ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {showArchived && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4"
                  >
                    {archivedProposals.map((req, i) => (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-xl border border-surface-200 bg-surface-50 p-5 opacity-50"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColor[req.category] || categoryColor.Other}`}>
                            {req.category}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            req.status === 'promoted'
                              ? 'bg-brand-500/20 text-brand-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {req.status === 'promoted' ? 'promoted' : 'expired'}
                          </span>
                          <span className="ml-auto text-xs text-gray-600">
                            {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-400 mb-1">{req.title}</h3>
                        <p className="text-xs text-gray-500">{req.description}</p>
                        <p className="text-xs text-gray-600 mt-2">
                          {req.endorsementCount}/{REQUEST_ENDORSEMENTS_NEEDED} endorsements
                        </p>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
