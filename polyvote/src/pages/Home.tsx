/*
 * CHANGE: New file – Homepage with hero, categories, search, and topic grid
 * REASON: Main landing page for the PolyVote app
 * DATE: 2026-04-02
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Sparkles } from 'lucide-react';
import { useTopics } from '../hooks/useTopics';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar, { type SortOption } from '../components/SearchBar';
import TopicCard from '../components/TopicCard';
import { TopicCardSkeleton } from '../components/LoadingSkeleton';
import type { Category, Topic } from '../types';

export default function Home() {
  const { topics, loading, error } = useTopics();
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');

  /** Filtered and sorted topics */
  const filtered = useMemo(() => {
    let result: Topic[] = topics;

    // Category filter
    if (category !== 'All') {
      result = result.filter((t) => t.category === category);
    }

    // Search filter
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      );
    }

    // Sort
    switch (sort) {
      case 'oldest':
        result = [...result].sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'most-votes':
        result = [...result].sort((a, b) => b.totalVotes - a.totalVotes);
        break;
      default: // newest – already ordered from Firestore
        break;
    }

    return result;
  }, [topics, category, query, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* ── Hero Section ── */}
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-400/10 px-4 py-1.5 text-xs font-medium text-brand-400 mb-4">
          <Sparkles size={14} />
          Multi-Metric Community Voting
        </div>
        <h1 className="text-3xl font-bold text-gray-100 sm:text-4xl mb-3">
          <BarChart3 className="inline mr-2 text-brand-400" size={32} />
          PolyVote
        </h1>
        <p className="mx-auto max-w-xl text-gray-400">
          Vote across multiple dimensions on the topics that matter. See real-time
          community consensus visualised with radar charts.
        </p>
      </motion.section>

      {/* ── Filters ── */}
      <div className="space-y-4 mb-8">
        <CategoryFilter active={category} onChange={setCategory} />
        <SearchBar query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} />
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-medium mb-1">Failed to load topics</p>
          <p className="text-red-400/80">{error}</p>
        </div>
      )}

      {/* ── Topics Grid ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TopicCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-20 text-center text-gray-500">
          No topics found. {query && 'Try a different search term.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((topic, i) => (
            <TopicCard key={topic.id} topic={topic} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
