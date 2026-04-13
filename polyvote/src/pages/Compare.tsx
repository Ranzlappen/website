/*
 * CHANGE: New file – Topic comparison page
 * REASON: Allow side-by-side radar chart comparison of 2-3 topics
 * DATE: 2026-04-13
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, GitCompareArrows, X, Search } from 'lucide-react';
import { useTopics } from '../hooks/useTopics';
import RadarChart from '../components/RadarChart';
import { categoryColor } from '../components/CategoryFilter';
import type { Topic } from '../types';

const MAX_COMPARE = 3;

export default function Compare() {
  const { topics, loading } = useTopics();
  const [selected, setSelected] = useState<Topic[]>([]);
  const [search, setSearch] = useState('');

  const addTopic = (topic: Topic) => {
    if (selected.length >= MAX_COMPARE) return;
    if (selected.find((t) => t.id === topic.id)) return;
    setSelected([...selected, topic]);
  };

  const removeTopic = (topicId: string) => {
    setSelected(selected.filter((t) => t.id !== topicId));
  };

  const filteredTopics = search.trim()
    ? topics.filter(
        (t) =>
          !selected.find((s) => s.id === t.id) &&
          (t.title.toLowerCase().includes(search.toLowerCase()) ||
            t.category.toLowerCase().includes(search.toLowerCase())),
      )
    : topics.filter((t) => !selected.find((s) => s.id === t.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-400">
        <ArrowLeft size={14} /> Back to topics
      </Link>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100 mb-2">
          <GitCompareArrows size={24} className="text-brand-400" />
          Compare Topics
        </h1>
        <p className="text-gray-500 mb-6">
          Select up to {MAX_COMPARE} topics to compare side by side.
        </p>
      </motion.div>

      {/* Selected topics for comparison */}
      {selected.length > 0 && (
        <div className="mb-8">
          <div className={`grid gap-4 ${selected.length === 1 ? 'grid-cols-1 max-w-md' : selected.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            {selected.map((topic) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-surface-200 bg-surface-50 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mb-1 ${categoryColor[topic.category] || categoryColor.Other}`}>
                      {topic.category}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-100 line-clamp-2">
                      <Link to={`/topic/${topic.id}`} className="hover:text-brand-400">
                        {topic.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {topic.totalVotes} vote{topic.totalVotes !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTopic(topic.id)}
                    aria-label={`Remove ${topic.title} from comparison`}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Show radar charts for each metric */}
                <div className="space-y-3">
                  {topic.metrics.map((metric) => (
                    <div key={metric.id}>
                      <p className="text-xs text-gray-400 mb-1 text-center">{metric.label}</p>
                      <RadarChart metric={metric} />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Topic selector */}
      {selected.length < MAX_COMPARE && (
        <div>
          <h2 className="text-sm font-medium text-gray-300 mb-3">
            {selected.length === 0 ? 'Select topics to compare' : `Add more (${selected.length}/${MAX_COMPARE})`}
          </h2>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics to compare…"
              aria-label="Search topics to compare"
              className="w-full rounded-lg border border-surface-200 bg-surface-100 py-2 pl-9 pr-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredTopics.slice(0, 20).map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => addTopic(topic)}
                  className="flex w-full items-center gap-3 rounded-lg border border-surface-200 bg-surface-50 p-3 text-left hover:border-brand-400/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor[topic.category] || categoryColor.Other}`}>
                    {topic.category}
                  </span>
                  <span className="flex-1 text-sm text-gray-200 truncate">{topic.title}</span>
                  <span className="text-xs text-gray-500">{topic.totalVotes} votes</span>
                </button>
              ))}
              {filteredTopics.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-500">No matching topics found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
