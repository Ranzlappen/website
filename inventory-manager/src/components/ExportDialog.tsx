import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { inventoryExportPlatformsFn, type PlatformExportFile } from '../firebase';
import { getPlatform, type ExportFormatId } from '../platforms';
import { useStore } from '../store';

function mimeFor(ext: string): string {
  if (ext === 'xml') return 'application/xml';
  if (ext === 'txt') return 'text/tab-separated-values';
  return 'text/csv';
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Platform tag ids to offer as checkboxes. */
  platforms: string[];
  request: { folderId?: string; itemIds?: string[]; scope: 'folder' | 'global' };
  onDone?: () => void;
}

export default function ExportDialog({ open, onClose, platforms, request, onDone }: Props) {
  const addToast = useStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [formatById, setFormatById] = useState<Record<string, ExportFormatId>>({});

  const offered = useMemo(
    () => platforms.map((id) => getPlatform(id)).filter((p): p is NonNullable<typeof p> => !!p),
    [platforms],
  );

  if (!open) return null;

  const formatFor = (id: string): ExportFormatId => {
    if (formatById[id]) return formatById[id];
    const def = getPlatform(id);
    return (def?.formats.find((f) => f.default) ?? def?.formats[0])?.id ?? 'csv';
  };

  const selected = offered.filter((p) => checked[p.id]);

  async function runExport() {
    const selections = selected.map((p) => ({ platform: p.id, format: formatFor(p.id) }));
    if (selections.length === 0) return;
    setBusy(true);
    try {
      const res = await inventoryExportPlatformsFn({ ...request, selections });
      const files: PlatformExportFile[] = res.data.files;
      if (files.length === 1) {
        const f = files[0];
        downloadBlob(f.filename, new Blob([f.body], { type: mimeFor(f.fileExt) }));
      } else {
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.filename, f.body));
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(`inventory-export-${new Date().toISOString().slice(0, 10)}.zip`, blob);
      }
      const total = files.reduce((n, f) => n + f.rowCount, 0);
      const blockedCount = Object.values(res.data.blocked).reduce((n, b) => n + b.length, 0);
      addToast(
        `Exported ${files.length} file(s), ${total} item-rows` +
          (blockedCount ? ` · ${blockedCount} blocked (missing required)` : ''),
        blockedCount ? 'info' : 'success',
      );
      res.data.skipped.forEach((s) =>
        addToast(`${getPlatform(s.platform)?.name ?? s.platform}: ${s.reason}`, 'info'),
      );
      onDone?.();
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Export for platforms</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {offered.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No platform tags here yet. Add tags to a folder (Edit schema → Platform
            tags) to enable platform exports.
          </p>
        ) : (
          <>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Pick platforms to export. One file each; 2 or more are zipped.
            </p>
            <div className="space-y-2 max-h-80 overflow-auto">
              {offered.map((p) => {
                const on = !!checked[p.id];
                const fmt = formatFor(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-2 rounded border border-[var(--border)]"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setChecked((c) => ({ ...c, [p.id]: e.target.checked }))
                        }
                      />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${p.badge}`}>
                        {p.name}
                      </span>
                    </label>
                    {p.formats.length > 1 && (
                      <div className="flex gap-1">
                        {p.formats.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setFormatById((m) => ({ ...m, [p.id]: f.id }))}
                            disabled={!on}
                            className={`text-[11px] px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
                              fmt === f.id
                                ? 'border-[var(--accent)] text-[var(--accent)]'
                                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={runExport}
            disabled={busy || selected.length === 0}
            className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
          >
            {busy ? 'Generating…' : `Export ${selected.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
