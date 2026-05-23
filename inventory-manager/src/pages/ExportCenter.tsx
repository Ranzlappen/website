import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import ExportDialog from '../components/ExportDialog';
import { inventoryListFoldersFn, inventoryListItemsFn } from '../firebase';
import { missingForPlatform, PLATFORM_BY_ID } from '../platforms';
import { useStore } from '../store';
import type { FolderDoc, ItemDoc } from '../types';

export default function ExportCenter() {
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const addToast = useStore((s) => s.addToast);
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);

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
        if (alive) addToast(err instanceof Error ? err.message : 'Load failed', 'error');
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

  // Per-platform tally across every flagged item whose folder carries the tag.
  const summary = useMemo(() => {
    const byPlatform = new Map<string, { ready: number; blocked: number }>();
    for (const it of items) {
      const tags = folderById.get(it.folderId)?.platformTags ?? [];
      for (const tag of tags) {
        const row = byPlatform.get(tag) ?? { ready: 0, blocked: 0 };
        if (missingForPlatform(it, tag).length) row.blocked++;
        else row.ready++;
        byPlatform.set(tag, row);
      }
    }
    return Array.from(byPlatform.entries()).map(([platform, counts]) => ({ platform, ...counts }));
  }, [items, folderById]);

  const platformsInUse = summary.map((s) => s.platform);

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-2">Export</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Every item flagged “Include in exports” is tallied per platform below
          (by the platform tags on its folder). Pick platforms and formats in the
          export dialog — one file each, 2+ zipped.
        </p>

        <button
          onClick={() => setShowExport(true)}
          disabled={platformsInUse.length === 0}
          className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors mb-6"
        >
          Export…
        </button>

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-[var(--text-muted)]">
            No items are flagged. Open any item and tick “Include in exports”, or
            use the bulk bar in a folder.
          </p>
        ) : platformsInUse.length === 0 ? (
          <p className="text-[var(--text-muted)]">
            {items.length} item(s) flagged, but their folders have no platform
            tags yet. Add tags via Edit schema to enable platform exports.
          </p>
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--bg)] text-xs uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Platform</th>
                  <th className="px-3 py-2 text-center">Ready</th>
                  <th className="px-3 py-2 text-center">Blocked</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => {
                  const def = PLATFORM_BY_ID.get(row.platform);
                  return (
                    <tr key={row.platform} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${def?.badge ?? ''}`}>
                          {def?.name ?? row.platform}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-[var(--accent)]">{row.ready}</td>
                      <td
                        className={`px-3 py-2 text-center ${row.blocked ? 'text-[var(--warn)]' : ''}`}
                      >
                        {row.blocked}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm uppercase text-[var(--text-muted)] mb-2">Flagged items</h2>
            <ul className="space-y-1 text-sm">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-2">
                  <Link
                    to={`/folder/${it.folderId}/item/${it.id}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {String(it.fields?.title ?? '(no title)')}
                  </Link>
                  <span className="text-[var(--text-muted)] text-xs">
                    {folderById.get(it.folderId)?.name ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        platforms={platformsInUse}
        request={{ scope: 'global' }}
        onDone={async () => {
          const r = await inventoryListItemsFn({ ebayOnly: true, limit: 500 });
          setItems(r.data.items);
        }}
      />
    </>
  );
}
