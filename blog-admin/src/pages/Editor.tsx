import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import type { EditorView } from '@codemirror/view';
import { blogSaveDraftFn, blogGetDraftFn, blogFetchExistingPostFn } from '../firebase';
import { useStore } from '../store';
import { createEmptyFrontMatter } from '../types';
import type { FrontMatter } from '../types';
import FrontMatterForm from '../components/FrontMatterForm';
import MarkdownEditor from '../components/MarkdownEditor';
import PostPreview from '../components/PostPreview';
import EditorToolbar from '../components/EditorToolbar';
import ImageUploader from '../components/ImageUploader';
import PublishDialog from '../components/PublishDialog';

export default function Editor() {
  const { draftId, filename } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const addToast = useStore((s) => s.addToast);

  // `/copy/:filename` means "fork this GitHub post into a new draft". We seed
  // a `-copy` slug so the user notices they need to change it before publish,
  // and (unlike /import/) leave `currentDraftId` null so saving creates a
  // fresh, unlinked draft.
  const isCopyMode = location.pathname.startsWith('/copy/');

  const [frontMatter, setFrontMatter] = useState<FrontMatter>(createEmptyFrontMatter);
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId ?? null);
  const [loading, setLoading] = useState(!!draftId || !!filename);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [fmCollapsed, setFmCollapsed] = useState(false);

  // Auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  // Load existing draft or import from GitHub
  useEffect(() => {
    async function loadDraft() {
      if (!draftId) return;
      try {
        const result = await blogGetDraftFn({ draftId });
        const data = result.data;
        setFrontMatter(data.frontMatter);
        setSlug(data.slug);
        setBody(data.body);
        setCurrentDraftId(data.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load draft';
        addToast(msg, 'error');
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    }

    async function importPost() {
      if (!filename) return;
      try {
        const result = await blogFetchExistingPostFn({ filename: decodeURIComponent(filename) });
        const data = result.data;
        if (isCopyMode) {
          // Seed a distinct slug so publish won't silently collide with the
          // source file, and apply the author override passed by the dialog.
          const authorParam = searchParams.get('author');
          const nextAuthor =
            authorParam === null
              ? data.frontMatter.author
              : authorParam.trim() || null;
          setFrontMatter({ ...data.frontMatter, author: nextAuthor });
          setSlug(`${data.slug}-copy`);
        } else {
          setFrontMatter(data.frontMatter);
          setSlug(data.slug);
        }
        setBody(data.body);
        // Don't set currentDraftId — this is a new draft from an import
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to import post';
        addToast(msg, 'error');
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    }

    if (draftId) loadDraft();
    else if (filename) importPost();
  }, [draftId, filename, isCopyMode, searchParams, addToast, navigate]);

  // Mark dirty on changes
  const handleFrontMatterChange = useCallback((fm: FrontMatter) => {
    setFrontMatter(fm);
    isDirtyRef.current = true;
  }, []);

  const handleSlugChange = useCallback((s: string) => {
    setSlug(s);
    isDirtyRef.current = true;
  }, []);

  const handleBodyChange = useCallback((b: string) => {
    setBody(b);
    isDirtyRef.current = true;
  }, []);

  // Auto-save every 30 seconds when dirty
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (isDirtyRef.current && slug && frontMatter.title) {
        saveDraft();
      }
    }, 30000);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, frontMatter, body, currentDraftId]);

  async function saveDraft() {
    if (!slug || !frontMatter.title || !frontMatter.category) {
      addToast('Title, slug, and category are required to save', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await blogSaveDraftFn({
        draftId: currentDraftId ?? undefined,
        slug,
        frontMatter,
        body,
      });
      setCurrentDraftId(result.data.id);
      setLastSaved(new Date());
      isDirtyRef.current = false;
      // Update URL to edit mode if it was a new post
      if (!draftId && !currentDraftId) {
        navigate(`/edit/${result.data.id}`, { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleImageUploaded(markdownImg: string) {
    if (editorView) {
      const { from } = editorView.state.selection.main;
      editorView.dispatch({
        changes: { from, insert: `\n${markdownImg}\n` },
      });
      editorView.focus();
      isDirtyRef.current = true;
    } else {
      setBody((prev) => prev + `\n${markdownImg}\n`);
      isDirtyRef.current = true;
    }
  }

  async function handlePublish() {
    // Save first to ensure latest content is persisted
    if (!currentDraftId) {
      await saveDraft();
    }
    if (!currentDraftId && !slug) return;
    setShowPublishDialog(true);
  }

  const computedFilename = `${frontMatter.date}-${slug || 'untitled'}.md`;
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              &larr; Dashboard
            </Link>
            <span className="text-xs text-[var(--text-muted)]">
              {computedFilename}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-[var(--text-muted)]">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={saveDraft}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handlePublish}
              disabled={!slug || !frontMatter.title || !frontMatter.category}
              className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              Publish
            </button>
          </div>
        </div>
      </header>

      {/* Front matter form (collapsible) */}
      <div className="shrink-0 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setFmCollapsed(!fmCollapsed)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors bg-[var(--bg-surface)]"
        >
          <span className="flex items-center gap-2">
            <span>{fmCollapsed ? '\u25B6' : '\u25BC'}</span>
            <span className="font-medium">Post Fields</span>
          </span>
          <span>{fmCollapsed ? 'Show' : 'Hide'}</span>
        </button>
        {!fmCollapsed && (
          <div className="px-4 py-3 overflow-auto max-h-[40vh]">
            <FrontMatterForm
              frontMatter={frontMatter}
              slug={slug}
              onChange={handleFrontMatterChange}
              onSlugChange={handleSlugChange}
            />
          </div>
        )}
      </div>

      {/* Editor toolbar */}
      <EditorToolbar
        editorView={editorView}
        onImageUpload={() => setShowImageUploader(true)}
      />

      {/* Editor / Preview toggle (visible below lg) */}
      <div className="flex lg:hidden border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex-1 px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === 'editor' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
        >
          Editor
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === 'preview' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
        >
          Preview
        </button>
      </div>

      {/* Split pane: Editor + Preview */}
      <div className="flex-1 flex min-h-0">
        {/* Markdown editor */}
        <div className={`flex-1 min-w-0 border-r border-[var(--border)] ${activeTab === 'preview' ? 'hidden lg:block' : ''}`}>
          <MarkdownEditor
            value={body}
            onChange={handleBodyChange}
            onViewReady={setEditorView}
          />
        </div>

        {/* Preview */}
        <div className={`flex-1 min-w-0 ${activeTab === 'editor' ? 'hidden lg:block' : ''}`}>
          <PostPreview frontMatter={frontMatter} body={body} />
        </div>
      </div>

      {/* Status bar */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{wordCount} words</span>
        <span>{body.length} characters</span>
      </div>

      {/* Modals */}
      <ImageUploader
        slug={slug}
        open={showImageUploader}
        onClose={() => setShowImageUploader(false)}
        onUploaded={handleImageUploaded}
      />

      {currentDraftId && (
        <PublishDialog
          draftId={currentDraftId}
          filename={computedFilename}
          open={showPublishDialog}
          onClose={() => setShowPublishDialog(false)}
          onPublished={() => {
            isDirtyRef.current = false;
            setLastSaved(new Date());
          }}
        />
      )}
    </div>
  );
}
