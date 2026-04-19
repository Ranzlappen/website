import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import {
  blogListDraftsFn,
  blogDeleteDraftFn,
  blogListExistingPostsFn,
} from '../firebase';
import { useStore } from '../store';
import DraftCard from '../components/DraftCard';
import ImportDialog from '../components/ImportDialog';
import type { ExistingPost } from '../types';

type Tab = 'drafts' | 'github';

export default function Dashboard() {
  const drafts = useStore((s) => s.drafts);
  const setDrafts = useStore((s) => s.setDrafts);
  const addToast = useStore((s) => s.addToast);

  const [tab, setTab] = useState<Tab>('drafts');
  const [loading, setLoading] = useState(true);
  const [ghPosts, setGhPosts] = useState<ExistingPost[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [importingFilename, setImportingFilename] = useState<string | null>(null);

  // Filenames that already have a draft linked to them — surfaced as a badge
  // on the GitHub Posts tab so the user knows re-importing will reopen their
  // draft instead of creating a duplicate.
  const linkedFilenames = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) {
      if (d.sourceFilename) set.add(d.sourceFilename);
    }
    return set;
  }, [drafts]);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await blogListDraftsFn({});
      setDrafts(result.data.drafts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load drafts';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [setDrafts, addToast]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  async function loadGitHubPosts() {
    setGhLoading(true);
    try {
      const result = await blogListExistingPostsFn({});
      setGhPosts(result.data.posts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load posts';
      addToast(msg, 'error');
    } finally {
      setGhLoading(false);
    }
  }

  async function handleDelete(draftId: string) {
    if (!confirm('Delete this draft?')) return;
    try {
      await blogDeleteDraftFn({ draftId });
      setDrafts(drafts.filter((d) => d.id !== draftId));
      addToast('Draft deleted', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete draft';
      addToast(msg, 'error');
    }
  }

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    if (newTab === 'github' && ghPosts.length === 0) {
      loadGitHubPosts();
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Blog Admin</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/new"
              className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors"
            >
              New Post
            </Link>
            <button
              onClick={() => auth.signOut()}
              className="px-3 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex gap-1 border-b border-[var(--border)]">
          <button
            onClick={() => handleTabChange('drafts')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'drafts'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            My Drafts ({drafts.length})
          </button>
          <button
            onClick={() => handleTabChange('github')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'github'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            GitHub Posts
          </button>
        </div>

        {/* Drafts tab */}
        {tab === 'drafts' && (
          <div className="py-6">
            {loading ? (
              <p className="text-[var(--text-muted)]">Loading drafts...</p>
            ) : drafts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[var(--text-muted)] mb-4">No drafts yet</p>
                <Link
                  to="/new"
                  className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Create your first post
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* GitHub posts tab */}
        {tab === 'github' && (
          <div className="py-6">
            {ghLoading ? (
              <p className="text-[var(--text-muted)]">Loading posts from GitHub...</p>
            ) : ghPosts.length === 0 ? (
              <p className="text-[var(--text-muted)]">No posts found in repository.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {ghPosts.map((post) => {
                  const isLinked = linkedFilenames.has(post.name);
                  return (
                    <div
                      key={post.name}
                      className="flex items-center justify-between gap-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="break-all">{post.name}</span>
                          {isLinked && (
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 shrink-0">
                              Linked draft
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {(post.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => setImportingFilename(post.name)}
                        className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors shrink-0"
                      >
                        Import…
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {importingFilename && (
        <ImportDialog
          filename={importingFilename}
          hasLinkedDraft={linkedFilenames.has(importingFilename)}
          onClose={() => setImportingFilename(null)}
        />
      )}
    </div>
  );
}
