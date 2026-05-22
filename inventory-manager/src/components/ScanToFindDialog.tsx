import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BarcodeScanner from './BarcodeScanner';
import { inventoryFindByEanFn } from '../firebase';
import { useStore } from '../store';
import type { ItemDoc } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Stage =
  | { kind: 'scanning' }
  | { kind: 'searching'; code: string }
  | { kind: 'results'; code: string; matches: ItemDoc[] };

export default function ScanToFindDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const folders = useStore((s) => s.folders);
  const addToast = useStore((s) => s.addToast);
  const [stage, setStage] = useState<Stage>({ kind: 'scanning' });

  if (!open) return null;

  function close() {
    setStage({ kind: 'scanning' });
    onClose();
  }

  async function onDetected(code: string) {
    setStage({ kind: 'searching', code });
    try {
      const res = await inventoryFindByEanFn({ code });
      const matches = res.data.matches;
      if (matches.length === 1) {
        const m = matches[0];
        close();
        navigate(`/folder/${m.folderId}/item/${m.id}`);
      } else {
        setStage({ kind: 'results', code, matches });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Lookup failed', 'error');
      close();
    }
  }

  function createNew() {
    if (stage.kind !== 'results') return;
    // Pick a target folder: prefer the most recently-used (top of list), else nothing.
    const target = folders[0];
    if (!target) {
      addToast('Create a folder first.', 'error');
      close();
      return;
    }
    const code = stage.code;
    close();
    navigate(`/folder/${target.id}/new?ean=${encodeURIComponent(code)}`);
  }

  if (stage.kind === 'scanning') {
    return (
      <BarcodeScanner
        open
        onCancel={close}
        onDetected={onDetected}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4"
      onClick={close}
    >
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">
            {stage.kind === 'searching' ? 'Searching…' : `Scanned: ${stage.code}`}
          </h2>
          <button
            onClick={close}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {stage.kind === 'searching' && (
          <p className="text-[var(--text-muted)] py-4">Looking up “{stage.code}”…</p>
        )}

        {stage.kind === 'results' && stage.matches.length === 0 && (
          <>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              No item with this barcode exists yet.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={close}
                className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
              >
                Close
              </button>
              <button
                onClick={createNew}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
              >
                Create new item
              </button>
            </div>
          </>
        )}

        {stage.kind === 'results' && stage.matches.length > 1 && (
          <>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              {stage.matches.length} matches for this barcode. Pick one:
            </p>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {stage.matches.map((m) => {
                const folder = folders.find((f) => f.id === m.folderId);
                const title = String(m.fields?.title ?? m.id);
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => {
                        close();
                        navigate(`/folder/${m.folderId}/item/${m.id}`);
                      }}
                      className="w-full text-left flex items-center gap-3 p-2 rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                    >
                      {m.photos?.[0] ? (
                        <img
                          src={m.photos[0].downloadUrl}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-[var(--bg)]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{title}</div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {folder?.pathSegments.join(' › ') ?? '—'}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
