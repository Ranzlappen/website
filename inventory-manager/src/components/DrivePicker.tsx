import { useEffect, useState } from 'react';
import {
  inventoryImportPhotoFromUrlFn,
  inventoryListDriveFolderFn,
  type DriveFileInfo,
} from '../firebase';
import { useStore } from '../store';
import type { PhotoRef } from '../types';

interface Props {
  open: boolean;
  itemId: string;
  onClose: () => void;
  onImported: (photos: PhotoRef[]) => void;
}

const LS_KEY = 'inventory.drivePicker.lastUrl';

export default function DrivePicker({ open, itemId, onClose, onImported }: Props) {
  const addToast = useStore((s) => s.addToast);
  const [folderUrl, setFolderUrl] = useState('');
  const [files, setFiles] = useState<DriveFileInfo[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setFolderUrl(saved);
    } catch {
      /* localStorage may be disabled */
    }
    setFiles([]);
    setNextToken(null);
    setSelected(new Set());
    setProgress(null);
  }, [open]);

  if (!open) return null;

  async function load(url: string, append: boolean, token?: string) {
    setLoading(true);
    try {
      const res = await inventoryListDriveFolderFn({
        folderUrl: url.trim(),
        pageToken: token,
      });
      setFiles((cur) => (append ? [...cur, ...res.data.files] : res.data.files));
      setNextToken(res.data.nextPageToken);
      try {
        localStorage.setItem(LS_KEY, url.trim());
      } catch {
        /* ignore */
      }
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : 'Could not list folder',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: ids.length });
    const newPhotos: PhotoRef[] = [];
    for (const id of ids) {
      try {
        const res = await inventoryImportPhotoFromUrlFn({ itemId, url: id });
        newPhotos.push(res.data);
      } catch (err) {
        addToast(
          `${id}: ${err instanceof Error ? err.message : 'import failed'}`,
          'error',
        );
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : null));
    }
    setImporting(false);
    setProgress(null);
    if (newPhotos.length > 0) {
      onImported(newPhotos);
      addToast(`Imported ${newPhotos.length} of ${ids.length}`, 'success');
    }
    onClose();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-5 max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Pick from Google Drive folder</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            type="url"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            placeholder="Paste a Drive folder share URL"
            className="flex-1 min-w-[200px] bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => load(folderUrl, false)}
            disabled={loading || !folderUrl.trim()}
            className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
          >
            {loading ? 'Loading…' : 'Open'}
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] mb-3">
          Folder must be shared “Anyone with the link → Viewer”. Only image
          files are listed.
        </p>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {files.length === 0 && !loading ? (
            <p className="text-[var(--text-muted)] py-8 text-center text-sm">
              No files yet. Paste a folder URL and click Open.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {files.map((f) => {
                const checked = selected.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle(f.id)}
                    className={`relative rounded border overflow-hidden transition-colors ${
                      checked
                        ? 'border-[var(--accent)] outline outline-2 outline-[var(--accent)]'
                        : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    {f.thumbnailUrl ? (
                      <img
                        src={f.thumbnailUrl}
                        alt={f.name}
                        className="block w-full aspect-square object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-xs text-[var(--text-muted)] bg-[var(--bg)]">
                        no preview
                      </div>
                    )}
                    <div className="absolute top-1 left-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="pointer-events-none"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 text-[10px] text-white bg-black/60 px-1 py-0.5 truncate">
                      {f.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {nextToken && (
            <div className="text-center mt-3">
              <button
                onClick={() => load(folderUrl, true, nextToken)}
                disabled={loading}
                className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">
            {selected.size} selected
            {progress &&
              ` · importing ${progress.done} / ${progress.total}`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-3 py-2 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={importSelected}
              disabled={importing || selected.size === 0}
              className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
            >
              {importing
                ? 'Importing…'
                : `Import ${selected.size} photo${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
