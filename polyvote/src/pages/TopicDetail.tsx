/*
 * CHANGE: New file – Topic detail page with voting, radar chart, and request modal
 * REASON: Core voting experience – shows all metrics with live updates
 * DATE: 2026-04-02
 */
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageSquarePlus, Users } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { useTopic } from '../hooks/useTopic';
import { useStore } from '../hooks/useStore';
import VotingCard from '../components/VotingCard';
import RadarChart from '../components/RadarChart';
import RequestModal from '../components/RequestModal';
import { TopicDetailSkeleton } from '../components/LoadingSkeleton';
import { categoryColor } from '../components/CategoryFilter';

export default function TopicDetail() {
  const { topicId } = useParams<{ topicId: string }>();
  const { topic, loading, error } = useTopic(topicId);
  const { hasVoted, recordVote, addToast, user } = useStore();
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) return <TopicDetailSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-red-400 font-medium mb-1">Failed to load topic</p>
          <p className="text-sm text-red-400/70">{error}</p>
        </div>
      </div>
    );
  }
  if (!topic) {
    return (
      <div className="py-20 text-center text-gray-500">
        Topic not found.{' '}
        <Link to="/" className="text-brand-400 underline">
          Go home
        </Link>
      </div>
    );
  }

  /** Cast a vote: Firestore transaction to increment the chosen choice */
  const handleVote = async (metricId: string, choiceId: string) => {
    if (!topicId || hasVoted(topicId, metricId)) return;

    try {
      const topicRef = doc(db, 'topics', topicId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(topicRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const metrics = (data.metrics ?? []).map((m: any) => {
          if (m.id !== metricId) return m;
          return {
            ...m,
            choices: m.choices.map((c: any) =>
              c.id === choiceId ? { ...c, votes: (c.votes || 0) + 1 } : c,
            ),
          };
        });
        tx.update(topicRef, {
          metrics,
          totalVotes: (data.totalVotes || 0) + 1,
        });
      });
      recordVote(topicId, metricId, choiceId);
      addToast('Vote recorded!', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to vote. Try again.', 'error');
    }
  };

  // Compute total unique participants (approximate: max votes across any single metric)
  const participants = Math.max(
    ...topic.metrics.map((m) => m.choices.reduce((sum, c) => sum + c.votes, 0)),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-400">
        <ArrowLeft size={14} /> Back to topics
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium mb-3 ${
            categoryColor[topic.category] || categoryColor.Other
          }`}
        >
          {topic.category}
        </span>
        <h1 className="text-2xl font-bold text-gray-100 sm:text-3xl mb-2">{topic.title}</h1>
        <p className="text-gray-400 mb-4">{topic.description}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={14} />
            ~{participants} participant{participants !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 text-brand-400 hover:underline"
          >
            <MessageSquarePlus size={14} />
            Request changes
          </button>
        </div>
      </motion.div>

      {/* Radar chart */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <RadarChart metrics={topic.metrics} />
      </motion.section>

      {/* Metrics + voting cards */}
      <div className="space-y-8">
        {topic.metrics.map((metric, mi) => {
          const totalMetricVotes = metric.choices.reduce((s, c) => s + c.votes, 0);
          const voted = topicId ? hasVoted(topicId, metric.id) : false;

          return (
            <motion.section
              key={metric.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + mi * 0.05 }}
            >
              <h2 className="mb-3 text-lg font-semibold text-gray-200">{metric.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {metric.choices.map((choice) => (
                  <VotingCard
                    key={choice.id}
                    label={choice.label}
                    color={choice.color}
                    votes={choice.votes}
                    totalMetricVotes={totalMetricVotes}
                    selected={
                      topicId
                        ? useStore.getState().votedMap[topicId]?.[metric.id] === choice.id
                        : false
                    }
                    disabled={voted}
                    onVote={() => handleVote(metric.id, choice.id)}
                  />
                ))}
              </div>
            </motion.section>
          );
        })}
      </div>

      {/* Request modal */}
      <RequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        topicId={topic.id}
        topicTitle={topic.title}
      />
    </div>
  );
}
