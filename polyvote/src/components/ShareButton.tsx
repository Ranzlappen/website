/*
 * CHANGE: New file – Share button with copy-to-clipboard and native share
 * REASON: Allow users to share topics with others
 * DATE: 2026-04-13
 */
import { Share2 } from 'lucide-react';
import { useStore } from '../hooks/useStore';

interface Props {
  topicId: string;
  topicTitle: string;
  size?: number;
  className?: string;
}

export default function ShareButton({ topicId, topicTitle, size = 14, className = '' }: Props) {
  const addToast = useStore((s) => s.addToast);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = `${window.location.origin}/polyvote/topic/${topicId}`;

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: topicTitle, text: `Vote on: ${topicTitle}`, url });
        return;
      } catch {
        // User cancelled or not supported, fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      addToast('Link copied!', 'success');
    } catch {
      addToast('Failed to copy link.', 'error');
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label={`Share ${topicTitle}`}
      className={`text-gray-500 hover:text-brand-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded ${className}`}
    >
      <Share2 size={size} />
    </button>
  );
}
