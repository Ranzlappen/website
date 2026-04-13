/*
 * CHANGE: New file – Search, filter, and sort controls
 * REASON: Advanced search/filter/sort for the topics grid on the homepage
 * DATE: 2026-04-02
 */
import { Search, ArrowUpDown } from 'lucide-react';

export type SortOption = 'newest' | 'oldest' | 'most-votes' | 'trending';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
}

export default function SearchBar({ query, onQueryChange, sort, onSortChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search input */}
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <label htmlFor="topic-search" className="sr-only">Search topics</label>
        <input
          id="topic-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search topics…"
          className="w-full rounded-lg border border-surface-200 bg-surface-100 py-2 pl-9 pr-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30"
        />
      </div>

      {/* Sort dropdown */}
      <div className="flex items-center gap-2">
        <ArrowUpDown size={14} className="text-gray-500" aria-hidden="true" />
        <label htmlFor="topic-sort" className="sr-only">Sort topics</label>
        <select
          id="topic-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="rounded-lg border border-surface-200 bg-surface-100 py-2 pl-2 pr-8 text-sm text-gray-300 focus:border-brand-400 focus:outline-none"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="most-votes">Most votes</option>
          <option value="trending">Trending</option>
        </select>
      </div>
    </div>
  );
}
