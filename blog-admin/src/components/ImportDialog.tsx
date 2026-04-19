import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  blogFetchExistingPostFn,
  blogImportPostForEditFn,
  type ImportAuthorChoice,
} from '../firebase';
import { useStore } from '../store';

type Mode = 'edit' | 'copy';

interface Props {
  filename: string;
  hasLinkedDraft: boolean;
  onClose: () => void;
}

type AuthorOption = 'default' | 'keep' | 'me';

export default function ImportDialog({ filename, hasLinkedDraft, onClose }: Props) {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const addToast = useStore((s) => s.addToast);

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [existingAuthor, setExistingAuthor] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState<string>('');
  const [mode, setMode] = useState<Mode>('edit');
  const defaultDisplayName = useMemo(
    () =>
      user?.displayName?.trim() ||
      user?.email?.split('@')[0] ||
      '',
    [user],
  );
  const [authorOption, setAuthorOption] = useState<AuthorOption>('default');
  const [myName, setMyName] = useState<string>(defaultDisplayName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await blogFetchExistingPostFn({ filename });
        if (cancelled) return;
        setExistingAuthor(res.data.frontMatter.author ?? null);
        setPostTitle(res.data.frontMatter.title ?? '');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to preview post';
        addToast(msg, 'error');
        onClose();
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filename, addToast, onClose]);

  function resolveAuthorChoice(): ImportAuthorChoice {
    if (authorOption === 'default') return 'default';
    if (authorOption === 'keep') return 'keep';
    return { value: myName.trim() };
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      if (mode === 'edit') {
        const res = await blogImportPostForEditFn({
          filename,
          authorChoice: resolveAuthorChoice(),
        });
        addToast(
          res.data.created
            ? 'Imported as a linked draft'
            : 'Reopened your existing draft for this post',
          'success',
        );
        navigate(`/edit/${res.data.draftId}`);
      } else {
        const params = new URLSearchParams();
        if (authorOption === 'keep' && existingAuthor) {
          params.set('author', existingAuthor);
        } else if (authorOption === 'me' && myName.trim()) {
          params.set('author', myName.trim());
        } else {
          params.set('author', '');
        }
        navigate(`/copy/${encodeURIComponent(filename)}?${params.toString()}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const authorInputDisabled = authorOption !== 'me';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Import post</h3>
        <p className="text-xs text-[var(--text-muted)] mb-4 break-all">
          <code className="text-[var(--text)]">{filename}</code>
          {postTitle && <span className="ml-2 break-words">— {postTitle}</span>}
        </p>

        {loadingPreview ? (
          <p className="text-sm text-[var(--text-muted)] py-6">Loading post…</p>
        ) : (
          <>
            {/* Mode */}
            <fieldset className="mb-4">
              <legend className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                What do you want to do?
              </legend>
              <label className="flex items-start gap-2 mb-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="edit"
                  checked={mode === 'edit'}
                  onChange={() => setMode('edit')}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">
                    Edit this post
                    {hasLinkedDraft && (
                      <span className="ml-2 text-xs text-[var(--accent)]">
                        (linked draft exists — will reopen)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Reuse or create a draft bound to this file. Publishing updates the same GitHub post.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="copy"
                  checked={mode === 'copy'}
                  onChange={() => setMode('copy')}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">Create a copy as a new post</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Fresh draft seeded with a “-copy” slug. Publishing creates a new GitHub file.
                  </div>
                </div>
              </label>
            </fieldset>

            {/* Author */}
            <fieldset className="mb-4">
              <legend className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                Author (optional)
              </legend>
              <label className="flex items-start gap-2 mb-2 cursor-pointer">
                <input
                  type="radio"
                  name="author"
                  checked={authorOption === 'default'}
                  onChange={() => setAuthorOption('default')}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">Site default</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    No <code>author</code> in YAML; Jekyll falls back to the site-level author.
                  </div>
                </div>
              </label>
              {existingAuthor && (
                <label className="flex items-start gap-2 mb-2 cursor-pointer">
                  <input
                    type="radio"
                    name="author"
                    checked={authorOption === 'keep'}
                    onChange={() => setAuthorOption('keep')}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium break-words">
                      Keep existing: <span className="text-[var(--accent)]">{existingAuthor}</span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Preserve the author the post already has on GitHub.
                    </div>
                  </div>
                </label>
              )}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="author"
                  checked={authorOption === 'me'}
                  onChange={() => setAuthorOption('me')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Use my name</div>
                  <input
                    type="text"
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    onFocus={() => setAuthorOption('me')}
                    disabled={authorInputDisabled}
                    placeholder={defaultDisplayName || 'Your name'}
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm disabled:opacity-50"
                  />
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    Leave blank to fall back to the site default.
                  </div>
                </div>
              </label>
            </fieldset>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--text-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Working…'
                  : mode === 'edit'
                    ? hasLinkedDraft
                      ? 'Open linked draft'
                      : 'Import for editing'
                    : 'Create a copy'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
