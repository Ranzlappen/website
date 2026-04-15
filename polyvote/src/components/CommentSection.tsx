/*
 * CHANGE: New file – Comment section for topic discussions
 * REASON: Allow users to discuss topics with threaded replies
 * DATE: 2026-04-13
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Reply, ChevronDown, Flag, ThumbsUp, ThumbsDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { postCommentFn, reportContentFn, voteOnCommentFn } from '../firebase';
import { useStore } from '../hooks/useStore';
import { useComments } from '../hooks/useComments';
import type { Comment } from '../types';

type CommentSort = 'best' | 'newest' | 'oldest';

interface Props {
  topicId: string;
}

export default function CommentSection({ topicId }: Props) {
  const { comments, loading } = useComments(topicId);
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<CommentSort>('best');

  // Organize comments into threads
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'best') return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
    if (sortBy === 'oldest') return a.createdAt - b.createdAt;
    return b.createdAt - a.createdAt; // newest
  });
  const topLevel = sortedComments.filter((c) => !c.parentId);
  const replies = sortedComments.filter((c) => c.parentId);
  const repliesMap = new Map<string, Comment[]>();
  for (const r of replies) {
    const existing = repliesMap.get(r.parentId!) || [];
    existing.push(r);
    repliesMap.set(r.parentId!, existing);
  }

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    setSubmitting(true);
    try {
      await postCommentFn({
        topicId,
        text: text.trim(),
        ...(replyTo ? { parentId: replyTo } : {}),
      });
      setText('');
      setReplyTo(null);
      addToast('Comment posted!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to post comment.';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-10 border-t border-surface-200 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-200 hover:text-brand-400 transition-colors"
        >
          <MessageCircle size={20} />
          Discussion ({comments.length})
          <ChevronDown
            size={16}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        {expanded && comments.length > 1 && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CommentSort)}
            aria-label="Sort comments"
            className="rounded-lg border border-surface-200 bg-surface-100 px-2 py-1 text-xs text-gray-400 focus:border-brand-400 focus:outline-none"
          >
            <option value="best">Best</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Comment input */}
            <div className="mb-6 space-y-2">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Reply size={12} />
                  Replying to a comment
                  <button
                    onClick={() => setReplyTo(null)}
                    className="text-brand-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                  placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
                  disabled={!user}
                  aria-label="Write a comment"
                  className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 disabled:opacity-50"
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !text.trim() || !user}
                  aria-label="Post comment"
                  className="rounded-lg bg-brand-400 px-3 py-2 text-surface disabled:opacity-50 hover:bg-brand-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {/* Comments list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
              </div>
            ) : topLevel.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                No comments yet. Be the first to share your thoughts!
              </p>
            ) : (
              <div className="space-y-3">
                {topLevel.map((comment, i) => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    replies={repliesMap.get(comment.id) || []}
                    index={i}
                    onReply={() => setReplyTo(comment.id)}
                    currentUserId={user?.uid}
                    topicId={topicId}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CommentThread({
  comment,
  replies,
  index,
  onReply,
  currentUserId,
  topicId,
}: {
  comment: Comment;
  replies: Comment[];
  index: number;
  onReply: () => void;
  currentUserId?: string;
  topicId: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <CommentBubble comment={comment} onReply={onReply} isOwn={comment.authorId === currentUserId} topicId={topicId} />
      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-surface-200 pl-4">
          {replies.map((reply) => (
            <CommentBubble key={reply.id} comment={reply} isOwn={reply.authorId === currentUserId} topicId={topicId} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

const REPORT_REASONS = ['spam', 'harassment', 'misinformation', 'inappropriate', 'other'] as const;

function CommentBubble({
  comment,
  onReply,
  isOwn,
  topicId,
}: {
  comment: Comment;
  onReply?: () => void;
  isOwn: boolean;
  topicId: string;
}) {
  const addToast = useStore((s) => s.addToast);
  const [reporting, setReporting] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [voting, setVoting] = useState(false);

  const handleReport = async (reason: (typeof REPORT_REASONS)[number]) => {
    setShowReportMenu(false);
    setReporting(true);
    try {
      await reportContentFn({
        type: 'comment',
        targetId: comment.id,
        parentId: topicId,
        reason,
      });
      addToast('Report submitted. Thank you!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to report.';
      addToast(message, 'error');
    } finally {
      setReporting(false);
    }
  };

  const handleVote = async (direction: 'up' | 'down') => {
    if (voting) return;
    setVoting(true);
    try {
      await voteOnCommentFn({ topicId, commentId: comment.id, direction });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to vote.';
      addToast(message, 'error');
    } finally {
      setVoting(false);
    }
  };

  const netVotes = (comment.upvotes || 0) - (comment.downvotes || 0);

  return (
    <div className={`rounded-xl border bg-surface-50 p-3 ${netVotes >= 3 ? 'border-brand-400/30' : 'border-surface-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${isOwn ? 'text-brand-400' : 'text-gray-400'}`}>
          {comment.displayName} {isOwn && '(you)'}
        </span>
        <span className="text-xs text-gray-600">
          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-gray-300">{comment.text}</p>
      <div className="mt-1.5 flex items-center gap-3">
        {/* Vote buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleVote('up')}
            disabled={voting}
            className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-brand-400 transition-colors disabled:opacity-50"
            title="Upvote"
          >
            <ThumbsUp size={12} />
          </button>
          <span className={`text-xs font-medium min-w-[1.2em] text-center ${netVotes > 0 ? 'text-brand-400' : netVotes < 0 ? 'text-red-400' : 'text-gray-600'}`}>
            {netVotes !== 0 ? netVotes : ''}
          </span>
          <button
            onClick={() => handleVote('down')}
            disabled={voting}
            className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Downvote"
          >
            <ThumbsDown size={12} />
          </button>
        </div>
        {onReply && (
          <button
            onClick={onReply}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-400 transition-colors"
          >
            <Reply size={12} /> Reply
          </button>
        )}
        {!isOwn && (
          <div className="relative">
            <button
              onClick={() => setShowReportMenu(!showReportMenu)}
              disabled={reporting}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Report comment"
            >
              <Flag size={12} /> {reporting ? 'Reporting...' : 'Report'}
            </button>
            {showReportMenu && (
              <div className="absolute bottom-full left-0 mb-1 w-40 rounded-lg border border-surface-200 bg-surface py-1 shadow-lg z-10">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleReport(reason)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-gray-300 capitalize hover:bg-surface-100 hover:text-gray-100 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
