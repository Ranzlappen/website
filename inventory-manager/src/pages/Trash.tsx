import { useEffect, useState } from 'react';
import Header from '../components/Header';
import {
  inventoryListDeletedFn,
  inventoryRestoreFolderFn,
  inventoryRestoreItemFn,
} from '../firebase';
import { useStore } from '../store';
import type { FolderDoc, ItemDoc } from '../types';

function ageDays(ms: number): number {
  return Math.floor((Date.now() - ms) / 86400000);
}

function daysUntilPurge(deletedAt: number, purgeAfterMs: number): number {
  return Math.max(0, Math.ceil((deletedAt + purgeAfterMs - Date.now()) / 86400000));
}

export default function Trash() {
  const addToast = useStore((s) => s.addToast);
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [folders, setFolders] = useState<FolderDoc[]>([]);
  const [purgeAfterMs, setPurgeAfterMs] = useState(30 * 86400 * 1000);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'items' | 'folders'>('items');

  async function refresh() {
    try {
      const res = await inventoryListDeletedFn({ limit: 200 });
      setItems(res.data.items);
      setFolders(res.data.folders);
      setPurgeAfterMs(res.data.purgeAfterMs);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restoreItem(it: ItemDoc & { id: string }) {
    try {
      await inventoryRestoreItemFn({ itemId: it.id });
      addToast('Item restored', 'success');
      setItems((s) => s.filter((x) => x.id !== it.id));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Restore failed', 'error');
    }
  }

  async function restoreFolder(f: FolderDoc & { id: string }, cascade: boolean) {
    try {
      const res = await inventoryRestoreFolderFn({
        folderId: f.id,
        cascade,
      });
      addToast(
        cascade
          ? `Restored ${res.data.folderCount} folder(s) and ${res.data.itemCount} item(s)`
          : 'Folder restored',
        'success',
      );
      refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Restore failed', 'error');
    }
  }

  const purgeDays = Math.round(purgeAfterMs / 86400000);

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-2">Trash</h1>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Soft-deleted items and folders. Auto-purged after {purgeDays} days
          (a scheduled function hard-deletes Firestore docs and Storage
          photos at that point).
        </p>

        <div className="flex gap-2 mb-4 border-b border-[var(--border)]">
          <button
            onClick={() => setTab('items')}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${
              tab === 'items'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Items ({items.length})
          </button>
          <button
            onClick={() => setTab('folders')}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${
              tab === 'folders'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Folders ({folders.length})
          </button>
        </div>

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading…</p>
        ) : tab === 'items' ? (
          items.length === 0 ? (
            <p className="text-[var(--text-muted)]">No deleted items.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => {
                const title = String(it.fields?.title ?? it.id);
                const dDel = it.deletedAt ? ageDays(it.deletedAt) : 0;
                const dLeft = it.deletedAt
                  ? daysUntilPurge(it.deletedAt, purgeAfterMs)
                  : purgeDays;
                return (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 p-2 rounded border border-[var(--border)] bg-[var(--bg-surface)]"
                  >
                    {it.photos?.[0] ? (
                      <img
                        src={it.photos[0].downloadUrl}
                        alt=""
                        className="w-12 h-12 object-cover rounded"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-[var(--bg)]" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{title}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Deleted {dDel}d ago · purges in {dLeft}d
                      </div>
                    </div>
                    <button
                      onClick={() => restoreItem(it as ItemDoc & { id: string })}
                      className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      Restore
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : folders.length === 0 ? (
          <p className="text-[var(--text-muted)]">No deleted folders.</p>
        ) : (
          <ul className="space-y-2">
            {folders.map((f) => {
              const dDel = f.deletedAt ? ageDays(f.deletedAt) : 0;
              const dLeft = f.deletedAt
                ? daysUntilPurge(f.deletedAt, purgeAfterMs)
                : purgeDays;
              return (
                <li
                  key={f.id}
                  className="flex items-center gap-3 p-2 rounded border border-[var(--border)] bg-[var(--bg-surface)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      📁 {f.pathSegments.join(' › ')}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Deleted {dDel}d ago · purges in {dLeft}d
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      restoreFolder(f as FolderDoc & { id: string }, false)
                    }
                    className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                    title="Restore this folder only"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() =>
                      restoreFolder(f as FolderDoc & { id: string }, true)
                    }
                    className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
                    title="Restore this folder and every descendant + item"
                  >
                    Restore + cascade
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
