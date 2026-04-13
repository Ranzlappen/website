/*
 * CHANGE: New file – Bookmark toggle button for saving topics
 * REASON: Allow users to save topics for quick access later
 * DATE: 2026-04-13
 */
import { motion } from 'framer-motion';
import { Bookmark } from 'lucide-react';
import { useStore } from '../hooks/useStore';

interface Props {
  topicId: string;
  size?: number;
  className?: string;
}

export default function BookmarkButton({ topicId, size = 14, className = '' }: Props) {
  const isBookmarked = useStore((s) => s.bookmarks.has(topicId));
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const addToast = useStore((s) => s.addToast);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmark(topicId);
    addToast(isBookmarked ? 'Bookmark removed' : 'Topic bookmarked!', 'info');
  };

  return (
    <motion.button
      onClick={handleClick}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this topic'}
      aria-pressed={isBookmarked}
      whileTap={{ scale: 0.85 }}
      className={`transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded ${
        isBookmarked ? 'text-brand-400' : 'text-gray-500 hover:text-brand-400'
      } ${className}`}
    >
      <Bookmark size={size} fill={isBookmarked ? 'currentColor' : 'none'} />
    </motion.button>
  );
}
