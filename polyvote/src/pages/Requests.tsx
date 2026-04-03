/*
 * CHANGE: Rewritten – Requests page with topic proposals, endorsements, and change requests
 * REASON: Adds community endorsement system for topic proposals with auto-promotion
 *         and timeout/archival logic; keeps existing change request flow
 * DATE: 2026-04-03
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  addDoc,
  runTransaction,
  writeBatch,
  getDocs,
  where,
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
  Sparkles,
  Archive,
} from 'lucide-react';
import { db } from '../firebase';
import { useStore } from '../hooks/useStore';
import { useTopicRequests } from '../hooks/useTopicRequests';
import { categoryColor } from '../components/CategoryFilter';
import type { ChangeRequest, TopicRequest } from '../types';
import { REQUEST_ENDORSEMENTS_NEEDED, REQUEST_TIMEOUT_MS } from '../types';

/** Badge styles by request status */
const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-brand-500/20 text-brand-400',
  rejected: 'bg-red-500/20 text-red-400',
  promoted: 'bg-brand-500/20 text-brand-400',
  archived: 'bg-gray-500/20 text-gray-400',
};

/** Badge styles by change request type */
const typeBadge: Record<string, string> = {
  edit: 'bg-blue-500/20 text-blue-400',
  add: 'bg-brand-500/20 text-brand-400',
  delete: 'bg-red-500/20 text-red-400',
};

export default function Requests() {
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);
  const [showArchived, setShowArchived] = useState(false);

  // ── Change Requests (existing system) ──
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [crLoading, setCrLoading] = useState(true);

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
        console.error('Change requests snapshot error:', err);
        setCrLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── Topic Requests (new endorsement system) ──
  const { requests: topicRequests, loading: trLoading } = useTopicRequests();

  // Archive expired pending requests on load
  useEffect(() => {
    const archiveExpired = async () => {
      try {
        const q = query(
          collection(db, 'topicRequests'),
          where('status', '==', 'pending'),
        );
        const snap = await getDocs(q);
        const now = Date.now();
        const batch = writeBatch(db);
        let count = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.expiresAt && data.expiresAt < now) {
            batch.update(d.ref, { status: 'archived' });
            count++;
          }
        });
        if (count > 0) await batch.commit();
      } catch (err) {
        console.error('Failed to archive expired requests:', err);
      }
    };
    archiveExpired();
  }, []);

  // Split topic requests by status
  const activeProposals = useMemo(
    () => topicRequests.filter((r) => r.status === 'pending' && r.expiresAt > Date.now()),
    [topicRequests],
  );
  const promotedProposals = useMemo(
    () => topicRequests.filter((r) => r.status === 'promoted'),
    [topicRequests],
  );
  const archivedProposals = useMemo(
    () => topicRequests.filter(
      (r) => r.status === 'archived' || (r.status === 'pending' && r.expiresAt <= Date.now()),
    ),
    [topicRequests],
  );

  // ── Endorse a topic request ──
  const handleEndorse = useCallback(
    async (request: TopicRequest) => {
      if (!user) {
        addToast('Authentication required.', 'error');
        return;
      }
      if (request.endorsers.includes(user.uid)) {
        addToast('You already endorsed this proposal.', 'info');
        return;
      }

      try {
        const reqRef = doc(db, 'topicRequests', request.id);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(reqRef);
          if (!snap.exists()) return;
          const data = snap.data();

          if (data.status !== 'pending') return;
          if (data.expiresAt < Date.now()) {
            tx.update(reqRef, { status: 'archived' });
            return;
          }

          const endorsers: string[] = data.endorsers || [];
          if (endorsers.includes(user.uid)) return;

          const newEndorsers = [...endorsers, user.uid];
          const newCount = newEndorsers.length;

          if (newCount >= REQUEST_ENDORSEMENTS_NEEDED) {
            // Promote: create topic + update request status
            const topicsRef = collection(db, 'topics');
            const topicDoc = doc(topicsRef);
            tx.set(topicDoc, {
              title: data.title,
              description: data.description,
              category: data.category,
              metrics: data.metrics,
              createdAt: Date.now(),
              totalVotes: 0,
            });
            tx.update(reqRef, {
              endorsers: newEndorsers,
              endorsementCount: newCount,
              status: 'promoted',
            });
          } else {
            tx.update(reqRef, {
              endorsers: newEndorsers,
              endorsementCount: newCount,
            });
          }
        });

        const newCount = request.endorsementCount + 1;
        if (newCount >= REQUEST_ENDORSEMENTS_NEEDED) {
          addToast('Topic promoted to main voting!', 'success');
        } else {
          addToast('Endorsement recorded!', 'success');
        }
      } catch (err) {
        console.error(err);
        addToast('Failed to endorse.', 'error');
      }
    },
    [user, addToast],
  );

  // ── Update change request status ──
  const updateCrStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'requests', id), { status });
      addToast(`Request ${status}.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update request.', 'error');
    }
  };

  const loading = crLoading || trLoading;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
          <FileText size={24} className="text-brand-400" />
          Requests
        </h1>
        <Link
          to="/requests/new"
          className="flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-surface hover:bg-brand-500 transition-colors"
        >
          <Plus size={16} />
          Propose Topic
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
          {/* ═══ Section 1: Active Topic Proposals ═══ */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-200 mb-4">
              <Sparkles size={18} className="text-brand-400" />
              Active Proposals
              {activeProposals.length > 0 && (
                <span className="rounded-full bg-brand-400/20 px-2 py-0.5 text-xs text-brand-400">
                  {activeProposals.length}
                </span>
              )}
            </h2>

            {activeProposals.length === 0 ? (
              <p className="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center text-sm text-gray-500">
                No active proposals.{' '}
                <Link to="/requests/new" className="text-brand-400 hover:underline">
                  Propose a topic
                </Link>
              </p>
            ) : (
              <div className="space-y-4">
                {activeProposals.map((req, i) => (
                  <TopicProposalCard
                    key={req.id}
                    request={req}
                    index={i}
                    userId={user?.uid}
                    onEndorse={() => handleEndorse(req)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ═══ Section 1b: Recently Promoted ═══ */}
          {promotedProposals.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-200 mb-4">
                <CheckCircle2 size={18} className="text-brand-400" />
                Recently Promoted
              </h2>
              <div className="space-y-4">
                {promotedProposals.map((req, i) => (
                  <TopicProposalCard
                    key={req.id}
                    request={req}
                    index={i}
                    userId={user?.uid}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ═══ Section 2: Change Requests ═══ */}
          {changeRequests.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-200 mb-4">
                <FileText size={18} className="text-gray-400" />
                Change Requests
              </h2>
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
                          className="flex items-center gap-1 rounded-lg bg-brand-400/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-400/20"
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button
                          onClick={() => updateCrStatus(req.id, 'rejected')}
                          className="flex items-center gap-1 rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/20"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ Section 3: Archived / Expired ═══ */}
          {archivedProposals.length > 0 && (
            <section>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 text-lg font-semibold text-gray-400 mb-4 hover:text-gray-300"
              >
                <Archive size={18} />
                Archived ({archivedProposals.length})
                <ChevronDown
                  size={16}
                  className={`transition-transform ${showArchived ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showArchived && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4"
                  >
                    {archivedProposals.map((req, i) => (
                      <TopicProposalCard
                        key={req.id}
                        request={req}
                        index={i}
                        userId={user?.uid}
                        archived
                      />
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

// ── Topic Proposal Card ──

interface ProposalCardProps {
  request: TopicRequest;
  index: number;
  userId?: string;
  archived?: boolean;
  onEndorse?: () => void;
}

function TopicProposalCard({ request, index, userId, archived, onEndorse }: ProposalCardProps) {
  const isExpired = request.expiresAt <= Date.now();
  const alreadyEndorsed = userId ? request.endorsers.includes(userId) : false;
  const isAuthor = userId === request.authorId;

  const timeLeft = request.expiresAt - Date.now();
  const minutesLeft = Math.max(0, Math.ceil(timeLeft / 60000));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`rounded-xl border p-5 ${
        archived || isExpired
          ? 'border-surface-200 bg-surface-50 opacity-50'
          : 'border-surface-200 bg-surface-50'
      }`}
    >
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
          categoryColor[request.category] || categoryColor.Other
        }`}>
          {request.category}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
          statusBadge[request.status]
        }`}>
          {request.status}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <Clock size={12} />
          {request.status === 'pending' && !isExpired
            ? `${minutesLeft}m left`
            : formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Title & description */}
      <h3 className="text-sm font-semibold text-gray-200 mb-1">{request.title}</h3>
      <p className="text-xs text-gray-400 mb-3">{request.description}</p>

      {/* Metrics preview */}
      <div className="flex flex-wrap gap-2 mb-3">
        {request.metrics.map((m) => (
          <span
            key={m.id}
            className="rounded-lg bg-surface-200 px-2 py-0.5 text-[11px] text-gray-400"
          >
            {m.label} ({m.choices.length} choices)
          </span>
        ))}
      </div>

      {/* Endorsement info + action */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <ThumbsUp size={12} />
          {request.endorsementCount}/{REQUEST_ENDORSEMENTS_NEEDED} endorsements
        </span>

        {onEndorse && request.status === 'pending' && !isExpired && (
          <button
            onClick={onEndorse}
            disabled={alreadyEndorsed}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              alreadyEndorsed
                ? 'bg-surface-200 text-gray-500 cursor-default'
                : 'bg-brand-400/10 text-brand-400 hover:bg-brand-400/20'
            }`}
          >
            <ThumbsUp size={14} />
            {alreadyEndorsed ? (isAuthor ? 'Your proposal' : 'Endorsed') : 'Endorse'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
