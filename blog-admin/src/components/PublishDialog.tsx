import { useState } from 'react';
import { blogPublishToGitHubFn } from '../firebase';
import { useStore } from '../store';

interface Props {
  draftId: string;
  filename: string;
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
}

export default function PublishDialog({ draftId, filename, open, onClose, onPublished }: Props) {
  const addToast = useStore((s) => s.addToast);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ commitSha: string; commitUrl: string } | null>(null);

  if (!open) return null;

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await blogPublishToGitHubFn({ draftId });
      setResult(res.data);
      addToast('Published to GitHub!', 'success');
      onPublished();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      addToast(msg, 'error');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <>
            <h3 className="text-lg font-semibold mb-3 text-green-400">Published!</h3>
            <p className="text-sm text-[var(--text-muted)] mb-2">
              File <code className="text-[var(--text)]">_posts/{filename}</code> has been committed.
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-1">
              Commit: <code className="text-xs">{result.commitSha.slice(0, 8)}</code>
            </p>
            {result.commitUrl && (
              <a
                href={result.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                View commit on GitHub
              </a>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-3">
              GitHub Actions will now build and deploy the site.
            </p>
            <div className="flex justify-end mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-3">Publish to GitHub</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              This will create or update the file{' '}
              <code className="text-[var(--text)]">_posts/{filename}</code>{' '}
              in the repository. A GitHub Actions build will be triggered automatically.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={publishing}
                className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--text-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
