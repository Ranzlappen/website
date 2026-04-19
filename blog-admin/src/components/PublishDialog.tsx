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

function isOverwriteConfirmError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; details?: unknown };
  const isPrecondition =
    e.code === 'functions/failed-precondition' ||
    e.code === 'failed-precondition';
  if (!isPrecondition) return false;
  const details = e.details as { code?: unknown } | undefined;
  return details?.code === 'overwrite-confirm-required';
}

export default function PublishDialog({ draftId, filename, open, onClose, onPublished }: Props) {
  const addToast = useStore((s) => s.addToast);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ commitSha: string; commitUrl: string } | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  if (!open) return null;

  async function runPublish(confirmOverwrite: boolean) {
    setPublishing(true);
    try {
      const res = await blogPublishToGitHubFn({ draftId, confirmOverwrite });
      setResult(res.data);
      setNeedsConfirm(false);
      addToast('Published to GitHub!', 'success');
      onPublished();
    } catch (err: unknown) {
      if (isOverwriteConfirmError(err)) {
        setNeedsConfirm(true);
      } else {
        const msg = err instanceof Error ? err.message : 'Publish failed';
        addToast(msg, 'error');
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handlePublish() {
    await runPublish(false);
  }

  async function handleConfirmOverwrite() {
    await runPublish(true);
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
        ) : needsConfirm ? (
          <>
            <h3 className="text-lg font-semibold mb-3 text-amber-400">
              Overwrite existing post?
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-2">
              A post named{' '}
              <code className="text-[var(--text)]">_posts/{filename}</code>{' '}
              already exists on GitHub, and this draft isn't linked to it.
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Publishing will overwrite that file. Cancel and change the slug
              to keep the original post intact.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setNeedsConfirm(false);
                  onClose();
                }}
                disabled={publishing}
                className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--text-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOverwrite}
                disabled={publishing}
                className="px-4 py-2 rounded bg-amber-500 text-[var(--bg)] font-semibold text-sm hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {publishing ? 'Publishing...' : 'Overwrite anyway'}
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
