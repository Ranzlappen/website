import { Link } from 'react-router-dom';
import type { BlogDraft } from '../types';

interface Props {
  draft: BlogDraft;
  onDelete: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  editing: 'text-yellow-400 bg-yellow-900/30',
  published: 'text-green-400 bg-green-900/30',
  archived: 'text-gray-400 bg-gray-900/30',
};

export default function DraftCard({ draft, onDelete }: Props) {
  const statusClass = STATUS_COLORS[draft.draftStatus] ?? STATUS_COLORS.editing;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-3 hover:border-[var(--accent)]/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words">
            {draft.frontMatter.title || 'Untitled'}
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-0.5 break-all">
            {draft.filename}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${statusClass}`}>
          {draft.draftStatus}
        </span>
      </div>

      {draft.frontMatter.description && (
        <p className="text-sm text-[var(--text-muted)] line-clamp-2">
          {draft.frontMatter.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>{draft.frontMatter.category}</span>
        <span>Status: {draft.frontMatter.status}</span>
        <span>Updated: {new Date(draft.updatedAt).toLocaleDateString()}</span>
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        <Link
          to={`/edit/${draft.id}`}
          className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Edit
        </Link>
        <button
          onClick={() => onDelete(draft.id)}
          className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
