/*
 * CHANGE: Added share and bookmark buttons to topic card
 * REASON: Social engagement features on the homepage grid
 * DATE: 2026-04-13
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Vote, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { categoryColor } from './CategoryFilter';
import MiniRadar from './MiniRadar';
import ShareButton from './ShareButton';
import BookmarkButton from './BookmarkButton';
import type { Topic } from '../types';

interface Props {
  topic: Topic;
  index: number;
}

export default function TopicCard({ topic, index }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link
        to={`/topic/${topic.id}`}
        className="group block rounded-xl border border-surface-200 bg-surface-50 p-5 transition-all hover:border-brand-400/40 hover:shadow-lg hover:shadow-brand-400/5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            {/* Category badge */}
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                categoryColor[topic.category] || categoryColor.Other
              }`}
            >
              {topic.category}
            </span>

            {/* Title */}
            <h3 className="text-base font-semibold text-gray-100 group-hover:text-brand-400 transition-colors line-clamp-2 break-words">
              {topic.title}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-500 line-clamp-2 break-words">{topic.description}</p>
          </div>

          {/* Mini radar preview */}
          <MiniRadar metrics={topic.metrics} />
        </div>

        {/* Footer: votes + time + actions */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Vote size={13} />
            {topic.totalVotes} vote{topic.totalVotes !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <ShareButton topicId={topic.id} topicTitle={topic.title} size={13} />
            <BookmarkButton topicId={topic.id} size={13} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
