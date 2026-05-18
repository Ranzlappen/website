import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import {
  inventoryExportEbayCsvFn,
  inventoryListFoldersFn,
  inventoryListItemsFn,
} from '../firebase';
import { useStore } from '../store';
import type { FolderDoc, ItemDoc } from '../types';

function downloadCsv(filename: string, body: string) {
  const blob = new Blob([body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function missingForExport(item: ItemDoc, folder: FolderDoc | undefined): string[] {
  if (!folder) return [];
  return folder.fieldSchema
    .filter((f) => f.ebayRequired)
    .filter((f) => {
      const v = item.fields?.[f.key];
      return v === undefined || v === null || (typeof v === 'string' && !v.trim());
    })
    .map((f) => f.label);
}

export default function EbayExport() {
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const addToast = useStore((s) => s.addToast);
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    const work = async () => {
      try {
        if (folders.length === 0) {
          const f = await inventoryListFoldersFn({});
          if (alive) setFolders(f.data.folders);
        }
        const res = await inventoryListItemsFn({ ebayOnly: true, limit: 500 });
        if (alive) setItems(res.data.items);
      } catch (err) {
        if (alive)
          addToast(err instanceof Error ? err.message : 'Load failed', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    };
    work();
    return () => {
      alive = false;
    };
  }, [folders.length, setFolders, addToast]);

  const folderById = useMemo(() => {
    const m = new Map<string, FolderDoc>();
    folders.forEach((f) => m.set(f.id, f));
    return m;
  }, [folders]);

  const ready = useMemo(
    () => items.filter((it) => missingForExport(it, folderById.get(it.folderId)).length === 0),
    [items, folderById],
  );
  const blocked = items.length - ready.length;

  async function exportAll() {
    setExporting(true);
    try {
      const res = await inventoryExportEbayCsvFn({});
      downloadCsv(res.data.filename, res.data.body);
      addToast(`Exported ${res.data.rowCount} items`, 'success');
      // Refresh to update listingStatus.
      const r = await inventoryListItemsFn({ ebayOnly: true, limit: 500 });
      setItems(r.data.items);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-2">eBay export</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Every item flagged for eBay is listed below. Download a single
          File Exchange CSV and upload it to{' '}
          <a
            href="https://www.ebay.com/sh/lst/active"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            Seller Hub
          </a>
          .
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-xs uppercase text-[var(--text-muted)]">Flagged</div>
            <div className="text-2xl font-bold">{items.length}</div>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--accent)] rounded-lg p-4">
            <div className="text-xs uppercase text-[var(--text-muted)]">Ready</div>
            <div className="text-2xl font-bold text-[var(--accent)]">{ready.length}</div>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-xs uppercase text-[var(--text-muted)]">Blocked</div>
            <div
              className={`text-2xl font-bold ${blocked > 0 ? 'text-[var(--warn)]' : ''}`}
            >
              {blocked}
            </div>
          </div>
        </div>

        <button
          onClick={exportAll}
          disabled={exporting || ready.length === 0}
          className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors mb-6"
        >
          {exporting ? 'Generating CSV…' : `Download eBay CSV (${ready.length} items)`}
        </button>

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-[var(--text-muted)]">
            No items are flagged. Open any item and tick the “Include in eBay
            export” box to add it here.
          </p>
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--bg)] text-xs uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Folder</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Issues</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const folder = folderById.get(it.folderId);
                  const missing = missingForExport(it, folder);
                  const title = String(it.fields?.title ?? '(no title)');
                  return (
                    <tr
                      key={it.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--bg-surface-hover)]"
                    >
                      <td className="px-3 py-2">
                        <Link
                          to={`/folder/${it.folderId}/item/${it.id}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {title}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{folder?.name ?? '—'}</td>
                      <td className="px-3 py-2">{it.ebay.listingStatus}</td>
                      <td className="px-3 py-2">
                        {missing.length === 0 ? (
                          <span className="text-[var(--accent)]">OK</span>
                        ) : (
                          <span className="text-[var(--warn)]">
                            missing: {missing.join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
