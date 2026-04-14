/*
 * CHANGE: New file – Topic detail page with voting, radar chart, and request modal
 * REASON: Core voting experience – shows all metrics with live updates
 * DATE: 2026-04-02
 */
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageSquarePlus, Users, Radar, BarChart3 } from 'lucide-react';
import { castVoteFn } from '../firebase';
import { useTopic } from '../hooks/useTopic';
import { useStore } from '../hooks/useStore';
import VotingCard from '../components/VotingCard';
import RadarChart from '../components/RadarChart';
import BarChart from '../components/BarChart';
import RequestModal from '../components/RequestModal';
import CommentSection from '../components/CommentSection';
import ShareButton from '../components/ShareButton';
import BookmarkButton from '../components/BookmarkButton';
import TopicStats from '../components/TopicStats';
import { TopicDetailSkeleton } from '../components/LoadingSkeleton';
import { categoryColor } from '../components/CategoryFilter';

type ChartView = 'radar' | 'bar';

export default function TopicDetail() {
  const { topicId } = useParams<{ topicId: string }>();
  const { topic, loading, error } = useTopic(topicId);
  const { hasVoted, recordVote, addToast, user } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [chartView, setChartView] = useState<ChartView>(() => {
    try { return (localStorage.getItem('polyvote_chart_view') as ChartView) || 'radar'; }
    catch { return 'radar'; }
  });

  if (loading) return <TopicDetailSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-400">
          <ArrowLeft size={14} /> Back to topics
        </Link>
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-medium mb-1">Failed to load topic</p>
          <p className="text-red-400/80">{error}</p>
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

  /** Cast or change a vote via Cloud Function (server-validated) */
  const handleVote = async (metricId: string, choiceId: string) => {
    if (!topicId) return;
    const previousChoiceId = useStore.getState().votedMap[topicId]?.[metricId];
    // If clicking the same choice they already voted for, do nothing
    if (previousChoiceId === choiceId) return;

    const isChange = !!previousChoiceId;

    try {
      const result = await castVoteFn({ topicId, metricId, choiceId });
      if (result.data.changed) {
        // Update local state for optimistic UI
        recordVote(topicId, metricId, choiceId);
        addToast(isChange ? 'Vote changed!' : 'Vote recorded!', 'success');
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to vote. Try again.';
      addToast(message, 'error');
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={14} />
            ~{participants} participant{participants !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setModalOpen(true)}
            aria-label={`Request changes to ${topic.title}`}
            className="flex items-center gap-1 text-brand-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
          >
            <MessageSquarePlus size={14} aria-hidden="true" />
            Request changes
          </button>
          <ShareButton topicId={topic.id} topicTitle={topic.title} size={16} />
          <BookmarkButton topicId={topic.id} size={16} />
        </div>
      </motion.div>

      {/* Metrics: per-metric radar chart + voting cards */}
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
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-200">{metric.label}</h2>
                <div className="flex items-center gap-2">
                  {voted && (
                    <span className="text-xs text-gray-500 hidden sm:inline">Click another to change vote</span>
                  )}
                  <div className="flex rounded-lg border border-surface-200 overflow-hidden">
                    <button
                      onClick={() => { setChartView('radar'); localStorage.setItem('polyvote_chart_view', 'radar'); }}
                      aria-label="Radar chart view"
                      aria-pressed={chartView === 'radar'}
                      className={`p-1.5 transition-colors ${chartView === 'radar' ? 'bg-brand-400/20 text-brand-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <Radar size={14} />
                    </button>
                    <button
                      onClick={() => { setChartView('bar'); localStorage.setItem('polyvote_chart_view', 'bar'); }}
                      aria-label="Bar chart view"
                      aria-pressed={chartView === 'bar'}
                      className={`p-1.5 transition-colors ${chartView === 'bar' ? 'bg-brand-400/20 text-brand-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <BarChart3 size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                {chartView === 'radar' ? <RadarChart metric={metric} /> : <BarChart metric={metric} />}
              </div>
              <div role="radiogroup" aria-label={`Vote on ${metric.label}`} className="grid gap-3 sm:grid-cols-2">
                {metric.choices.map((choice) => {
                  const isSelected = topicId
                    ? useStore.getState().votedMap[topicId]?.[metric.id] === choice.id
                    : false;
                  return (
                    <VotingCard
                      key={choice.id}
                      label={choice.label}
                      color={choice.color}
                      votes={choice.votes}
                      totalMetricVotes={totalMetricVotes}
                      selected={isSelected}
                      disabled={false}
                      onVote={() => handleVote(metric.id, choice.id)}
                    />
                  );
                })}
              </div>
            </motion.section>
          );
        })}
      </div>

      {/* Statistics */}
      <TopicStats topic={topic} />

      {/* Comments */}
      <CommentSection topicId={topic.id} />

      {/* Request modal */}
      <RequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        topic={topic}
      />
    </div>
  );
}
