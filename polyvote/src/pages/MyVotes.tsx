/*
 * CHANGE: New file – Personal voting history page
 * REASON: Allow users to see topics they've voted on and their choices
 * DATE: 2026-04-13
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Vote, CheckCircle2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../hooks/useStore';
import { categoryColor } from '../components/CategoryFilter';
import type { Topic } from '../types';

export default function MyVotes() {
  const votedMap = useStore((s) => s.votedMap);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const topicIds = Object.keys(votedMap);

  // Fetch topic data for all voted topics
  useEffect(() => {
    if (topicIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchTopics = async () => {
      try {
        const results = await Promise.all(
          topicIds.map(async (id) => {
            const snap = await getDoc(doc(db, 'topics', id));
            if (snap.exists()) return { id: snap.id, ...snap.data() } as Topic;
            return null;
          }),
        );
        setTopics(results.filter((t): t is Topic => t !== null));
      } catch (err) {
        console.error('Failed to fetch voted topics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, [topicIds.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-400">
        <ArrowLeft size={14} /> Back to topics
      </Link>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100 mb-2">
          <Vote size={24} className="text-brand-400" />
          My Votes
        </h1>
        <p className="text-gray-500 mb-8">
          {topicIds.length > 0
            ? `You've voted on ${topicIds.length} topic${topicIds.length !== 1 ? 's' : ''}`
            : 'You haven\'t voted on any topics yet'}
        </p>
      </motion.div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500 mb-4">No voting history yet.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-surface hover:bg-brand-500 transition-colors"
          >
            Browse topics
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic, i) => {
            const myVotes = votedMap[topic.id] || {};
            return (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/topic/${topic.id}`}
                  className="block rounded-xl border border-surface-200 bg-surface-50 p-5 hover:border-brand-400/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium mb-1 ${categoryColor[topic.category] || categoryColor.Other}`}>
                        {topic.category}
                      </span>
                      <h3 className="text-base font-semibold text-gray-100">{topic.title}</h3>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {Object.keys(myVotes).length}/{topic.metrics.length} metrics
                    </span>
                  </div>

                  {/* My choices */}
                  <div className="space-y-1.5">
                    {topic.metrics.map((metric) => {
                      const choiceId = myVotes[metric.id];
                      const choice = choiceId
                        ? metric.choices.find((c) => c.id === choiceId)
                        : null;

                      return (
                        <div key={metric.id} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500 w-28 truncate">{metric.label}:</span>
                          {choice ? (
                            <span className="flex items-center gap-1.5 text-gray-300">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: choice.color }}
                              />
                              {choice.label}
                              <CheckCircle2 size={12} className="text-brand-400" />
                            </span>
                          ) : (
                            <span className="text-gray-600 italic">Not voted</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
