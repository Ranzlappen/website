import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import BulkActionBar from '../components/BulkActionBar';
import ConfirmDialog from '../components/ConfirmDialog';
import ImportDialog from '../components/ImportDialog';
import PhotoLightbox from '../components/PhotoLightbox';
import {
  inventoryDeleteFolderFn,
  inventoryDeleteItemFn,
  inventoryDuplicateFolderFn,
  inventoryDuplicateItemFn,
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
  const upsertFolder = useStore((s) => s.upsertFolder);
  const removeFolders = useStore((s) => s.removeFolders);
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
  const [pendingFolderDelete, setPendingFolderDelete] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [dupName, setDupName] = useState('');
  const [dupCopyItems, setDupCopyItems] = useState(false);
  const [dupBusy, setDupBusy] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<ItemDoc | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    null,
  );

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
    const base = !search.trim()
      ? items
      : items.filter((it) =>
          Object.values(it.fields).some((v) =>
            String(v ?? '').toLowerCase().includes(search.toLowerCase()),
          ),
        );
    if (!sort) return base;
    const def = folder?.fieldSchema.find((f) => f.key === sort.key);
    const sorted = base.slice().sort((a, b) => {
      const av = a.fields?.[sort.key];
      const bv = b.fields?.[sort.key];
      // Empties always sink to the bottom regardless of direction.
      const aEmpty = av === null || av === undefined || av === '';
      const bEmpty = bv === null || bv === undefined || bv === '';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      const cmp =
        def?.type === 'number'
          ? Number(av) - Number(bv)
          : def?.type === 'date'
            ? String(av).localeCompare(String(bv))
            : String(av).localeCompare(String(bv), undefined, {
                numeric: true,
                sensitivity: 'base',
              });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, search, sort, folder]);

  function toggleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null; // back to default (updatedAt desc from the server)
    });
  }

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

  async function duplicateItem(it: ItemDoc) {
    try {
      const res = await inventoryDuplicateItemFn({ itemId: it.id });
      upsertItem(res.data);
      addToast(
        res.data.photoCount > 0
          ? `Duplicated (with ${res.data.photoCount} photo${res.data.photoCount === 1 ? '' : 's'})`
          : 'Duplicated',
        'success',
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Duplicate failed', 'error');
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

  async function deleteFolder() {
    if (!folder) return;
    try {
      const res = await inventoryDeleteFolderFn({ folderId: folder.id });
      const allIds = new Set<string>();
      const walk = (id: string) => {
        allIds.add(id);
        folders
          .filter((f) => f.parentFolderId === id)
          .forEach((c) => walk(c.id));
      };
      walk(folder.id);
      removeFolders(Array.from(allIds));
      addToast(`Deleted ${res.data.deletedFolderCount} folder(s)`, 'success');
      navigate('/');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setPendingFolderDelete(false);
    }
  }

  function openDuplicate() {
    if (!folder) return;
    setDupName(`${folder.name} (copy)`);
    setDupCopyItems(false);
    setDuplicateOpen(true);
  }

  async function submitDuplicate() {
    if (!folder || !dupName.trim()) return;
    setDupBusy(true);
    try {
      const res = await inventoryDuplicateFolderFn({
        folderId: folder.id,
        newName: dupName.trim(),
        copyItems: dupCopyItems,
      });
      upsertFolder(res.data);
      addToast(
        dupCopyItems
          ? `Duplicated with ${res.data.itemCount} items and ${res.data.photoCount} photos`
          : 'Duplicated (schema only)',
        'success',
      );
      setDuplicateOpen(false);
      navigate(`/folder/${res.data.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Duplicate failed', 'error');
    } finally {
      setDupBusy(false);
    }
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
              onClick={openDuplicate}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Duplicate
            </button>
            <button
              onClick={() => setPendingFolderDelete(true)}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
            >
              Delete folder
            </button>
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
                  {folder.fieldSchema.slice(0, 5).map((f) => {
                    const active = sort?.key === f.key;
                    return (
                      <th key={f.key} className="px-3 py-2 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort(f.key)}
                          className={`inline-flex items-center gap-1 uppercase text-xs hover:text-[var(--accent)] transition-colors ${
                            active ? 'text-[var(--accent)]' : ''
                          }`}
                          title="Click to sort"
                        >
                          {f.label}
                          {f.ebayRequired && (
                            <span title="Required for eBay" className="text-[var(--accent)]">
                              ★
                            </span>
                          )}
                          <span aria-hidden="true">
                            {active ? (sort?.dir === 'asc' ? '▲' : '▼') : ''}
                          </span>
                        </button>
                      </th>
                    );
                  })}
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
                        <button
                          type="button"
                          onClick={() => setLightboxItem(it)}
                          className="block p-0 m-0 bg-transparent"
                          aria-label="Open photos"
                        >
                          <img
                            src={it.photos[0].downloadUrl}
                            alt=""
                            className="w-10 h-10 object-cover rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                            loading="lazy"
                          />
                        </button>
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
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link
                        to={`/folder/${folderId}/item/${it.id}`}
                        className="text-xs text-[var(--accent)] hover:underline mr-3"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => duplicateItem(it)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] mr-3"
                      >
                        Duplicate
                      </button>
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

      {folder && selectedItemIds.size > 0 && (
        <BulkActionBar
          folder={folder}
          folders={folders}
          selectedIds={Array.from(selectedItemIds)}
          onClear={clearSelected}
          onCompleted={async () => {
            if (!folderId) return;
            const res = await inventoryListItemsFn({ folderId, limit: 500 });
            setItems(res.data.items);
          }}
        />
      )}

      <ImportDialog
        folderId={folderId}
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={async () => {
          const res = await inventoryListItemsFn({ folderId, limit: 500 });
          setItems(res.data.items);
        }}
      />

      {lightboxItem && (lightboxItem.photos?.length ?? 0) > 0 && (
        <PhotoLightbox
          photos={lightboxItem.photos}
          startIndex={0}
          onClose={() => setLightboxItem(null)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete item?"
        message="The item will be soft-deleted (recoverable from Firestore for 30 days)."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingFolderDelete}
        title={`Delete “${folder?.name ?? ''}”?`}
        message="This folder, every subfolder, and every item inside will be soft-deleted. Recoverable from Firestore for 30 days."
        confirmLabel="Delete folder"
        destructive
        onConfirm={deleteFolder}
        onCancel={() => setPendingFolderDelete(false)}
      />

      {duplicateOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4"
          onClick={() => setDuplicateOpen(false)}
        >
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold mb-3">
              Duplicate “{folder?.name ?? ''}”
            </h2>
            <input
              autoFocus
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !dupBusy) submitDuplicate();
              }}
              placeholder="New folder name"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2"
            />
            <label className="flex items-start gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={dupCopyItems}
                onChange={(e) => setDupCopyItems(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Also copy <strong>{folder?.itemCount ?? 0}</strong> item(s) and
                re-upload their photos to fresh Storage paths.
              </span>
            </label>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setDuplicateOpen(false)}
                className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDuplicate}
                disabled={!dupName.trim() || dupBusy}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
              >
                {dupBusy ? 'Working…' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
