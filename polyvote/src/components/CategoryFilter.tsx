/*
 * CHANGE: New file – Collapsible/tabbed category filter
 * REASON: Lets users browse topics by category on the homepage
 * DATE: 2026-04-02
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { Category } from '../types';

const CATEGORIES: (Category | 'All')[] = [
  'All',
  'Politics',
  'Technology',
  'Science',
  'Culture',
  'Environment',
  'Health',
  'Sports',
  'Other',
];

/** Color badge mapping per category */
export const categoryColor: Record<string, string> = {
  Politics: 'bg-red-500/20 text-red-400',
  Technology: 'bg-blue-500/20 text-blue-400',
  Science: 'bg-purple-500/20 text-purple-400',
  Culture: 'bg-yellow-500/20 text-yellow-400',
  Environment: 'bg-brand-500/20 text-brand-400',
  Health: 'bg-pink-500/20 text-pink-400',
  Sports: 'bg-orange-500/20 text-orange-400',
  Other: 'bg-gray-500/20 text-gray-400',
};

interface Props {
  active: Category | 'All';
  onChange: (cat: Category | 'All') => void;
}

export default function CategoryFilter({ active, onChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50">
      {/* Header – click to collapse/expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="category-filter-list"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 rounded-xl"
      >
        Categories
        <ChevronDown
          size={16}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div id="category-filter-list" role="radiogroup" aria-label="Filter by category" className="flex flex-wrap gap-2 px-4 pb-4">
              {CATEGORIES.map((cat) => {
                const isActive = active === cat;
                return (
                  <button
                    key={cat}
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => onChange(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                      isActive
                        ? 'bg-brand-400 text-surface'
                        : 'bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
