import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import ImportDialog from '../components/ImportDialog';
import {
  inventoryDeleteItemFn,
  inventoryExportEbayCsvFn,
  inventoryExportFn,
  inventoryListFoldersFn,
  inventoryListItemsFn,
  inventoryToggleEbaySyncFn,
} from '../firebase';
import { useStore } from '../store';
import type { FolderDoc, ItemDoc } from '../types';

function downloadFile(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function StatusBadge({ status }: { status: ItemDoc['ebay']['listingStatus'] }) {
  if (status === 'none') return null;
  const cls: Record<string, string> = {
    ready: 'bg-blue-900/40 border-blue-700 text-blue-200',
    exported: 'bg-green-900/40 border-green-700 text-green-200',
    listed: 'bg-emerald-900/40 border-emerald-700 text-emerald-200',
    ended: 'bg-gray-700/40 border-gray-600 text-gray-300',
    error: 'bg-red-900/40 border-red-700 text-red-200',
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded border ${cls[status] ?? ''}`}
    >
      {status}
    </span>
  );
}

export default function FolderTable() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const items = useStore((s) => s.items);
  const setItems = useStore((s) => s.setItems);
  const upsertItem = useStore((s) => s.upsertItem);
  const removeItem = useStore((s) => s.removeItem);
  const selectedItemIds = useStore((s) => s.selectedItemIds);
  const toggleSelected = useStore((s) => s.toggleSelected);
  const setSelected = useStore((s) => s.setSelected);
  const clearSelected = useStore((s) => s.clearSelected);
  const addToast = useStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ItemDoc | null>(null);

  const folder = useMemo(
    () => folders.find((f) => f.id === folderId) ?? null,
    [folders, folderId],
  );

  useEffect(() => {
    if (!folderId) return;
    let alive = true;
    setLoading(true);
    clearSelected();
    const work = async () => {
      try {
        if (folders.length === 0) {
          const res = await inventoryListFoldersFn({});
          if (alive) setFolders(res.data.folders);
        }
        const res = await inventoryListItemsFn({ folderId, limit: 500 });
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
  }, [folderId, folders.length, setFolders, setItems, addToast, clearSelected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((it) =>
      Object.values(it.fields).some((v) =>
        String(v ?? '').toLowerCase().includes(q),
      ),
    );
  }, [items, search]);

  async function toggleEbay(item: ItemDoc, enabled: boolean) {
    try {
      const res = await inventoryToggleEbaySyncFn({ itemId: item.id, enabled });
      upsertItem({ ...item, ebay: res.data.ebay });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Toggle failed', 'error');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await inventoryDeleteItemFn({ itemId: pendingDelete.id });
      removeItem(pendingDelete.id);
      addToast('Item deleted', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setPendingDelete(null);
    }
  }

  async function exportFolder(format: 'csv' | 'json') {
    if (!folderId) return;
    try {
      const res = await inventoryExportFn({ folderId, format });
      downloadFile(
        res.data.filename,
        res.data.body,
        format === 'json' ? 'application/json' : 'text/csv',
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  }

  async function exportEbaySelected() {
    if (!folderId) return;
    const ids = Array.from(selectedItemIds);
    const target =
      ids.length > 0
        ? { itemIds: ids }
        : { folderId };
    try {
      const res = await inventoryExportEbayCsvFn(target);
      downloadFile(res.data.filename, res.data.body, 'text/csv');
      addToast(`eBay CSV ready (${res.data.rowCount} rows)`, 'success');
      // Refresh to pick up listingStatus → 'exported'.
      const r = await inventoryListItemsFn({ folderId, limit: 500 });
      setItems(r.data.items);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  }

  function breadcrumb(folder: FolderDoc): string {
    return folder.pathSegments.join(' › ');
  }

  if (!folderId) return null;

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <Link
              to="/"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              ← All inventories
            </Link>
            <h1 className="text-xl font-bold mt-1">
              {folder ? breadcrumb(folder) : 'Folder'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/folder/${folderId}/schema`}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Edit schema
            </Link>
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Import
            </button>
            <button
              onClick={() => exportFolder('csv')}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => exportFolder('json')}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={exportEbaySelected}
              className="px-3 py-1.5 text-sm rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              eBay CSV {selectedItemIds.size > 0 && `(${selectedItemIds.size} selected)`}
            </button>
            <button
              onClick={() => navigate(`/folder/${folderId}/new`)}
              className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
            >
              + New item
            </button>
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter…"
          className="w-full mb-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded px-3 py-2 text-sm"
        />

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading…</p>
        ) : !folder ? (
          <p className="text-[var(--text-muted)]">Folder not found.</p>
        ) : (
          <div className="overflow-x-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--bg)] text-[var(--text-muted)] text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((it) => selectedItemIds.has(it.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(new Set(filtered.map((it) => it.id)));
                        } else {
                          clearSelected();
                        }
                      }}
                    />
                  </th>
                  <th className="px-3 py-2 text-left w-12">Photo</th>
                  {folder.fieldSchema.slice(0, 5).map((f) => (
                    <th key={f.key} className="px-3 py-2 text-left">
                      {f.label}
                      {f.ebayRequired && (
                        <span title="Required for eBay" className="ml-1 text-[var(--accent)]">
                          ★
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center">eBay</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={folder.fieldSchema.slice(0, 5).length + 5}
                      className="px-3 py-8 text-center text-[var(--text-muted)]"
                    >
                      No items{search ? ' match this filter' : ' yet'}.
                    </td>
                  </tr>
                )}
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    className="border-t border-[var(--border)] hover:bg-[var(--bg-surface-hover)]"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(it.id)}
                        onChange={() => toggleSelected(it.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {it.photos?.[0] ? (
                        <img
                          src={it.photos[0].downloadUrl}
                          alt=""
                          className="w-10 h-10 object-cover rounded border border-[var(--border)]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-[var(--bg)] border border-[var(--border)]" />
                      )}
                    </td>
                    {folder.fieldSchema.slice(0, 5).map((f) => (
                      <td key={f.key} className="px-3 py-2 truncate max-w-xs">
                        {String(it.fields?.[f.key] ?? '')}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!it.ebay?.syncEnabled}
                        onChange={(e) => toggleEbay(it, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={it.ebay?.listingStatus ?? 'none'} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/folder/${folderId}/item/${it.id}`}
                        className="text-xs text-[var(--accent)] hover:underline mr-3"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setPendingDelete(it)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <ImportDialog
        folderId={folderId}
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={async () => {
          const res = await inventoryListItemsFn({ folderId, limit: 500 });
          setItems(res.data.items);
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete item?"
        message="The item will be soft-deleted (recoverable from Firestore for 30 days)."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
