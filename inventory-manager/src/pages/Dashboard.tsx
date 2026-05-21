import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  inventoryCreateFolderFn,
  inventoryDeleteFolderFn,
  inventoryDuplicateFolderFn,
  inventoryListFoldersFn,
  inventoryUpdateFolderFn,
} from '../firebase';
import { useStore } from '../store';
import type { FolderDoc } from '../types';

interface TreeNode {
  folder: FolderDoc;
  children: TreeNode[];
}

function buildTree(folders: FolderDoc[]): TreeNode[] {
  const byParent = new Map<string | null, FolderDoc[]>();
  folders.forEach((f) => {
    const key = f.parentFolderId ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(f);
    byParent.set(key, arr);
  });
  const build = (parentId: string | null): TreeNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({ folder: f, children: build(f.id) }));
  return build(null);
}

interface NodeActions {
  onNewChild: (parent: FolderDoc) => void;
  onDuplicate: (f: FolderDoc) => void;
  onRename: (f: FolderDoc) => void;
  onDelete: (f: FolderDoc) => void;
}

const iconBtnCls =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded text-sm text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-hover)] transition-colors';

function FolderNode({
  node,
  depth,
  actions,
}: {
  node: TreeNode;
  depth: number;
  actions: NodeActions;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1 py-1"
        style={{ paddingLeft: depth * 16 }}
      >
        <Link
          to={`/folder/${node.folder.id}`}
          className="flex-1 min-w-0 truncate hover:text-[var(--accent)] transition-colors py-1.5"
        >
          📁 {node.folder.name}
          <span className="ml-2 text-xs text-[var(--text-muted)]">
            {node.folder.itemCount}
          </span>
        </Link>
        <button
          onClick={() => actions.onNewChild(node.folder)}
          title="New subfolder"
          aria-label="New subfolder"
          className={iconBtnCls}
        >
          ＋
        </button>
        <button
          onClick={() => actions.onDuplicate(node.folder)}
          title="Duplicate folder"
          aria-label="Duplicate folder"
          className={iconBtnCls}
        >
          ⧉
        </button>
        <button
          onClick={() => actions.onRename(node.folder)}
          title="Rename folder"
          aria-label="Rename folder"
          className={iconBtnCls}
        >
          ✎
        </button>
        <button
          onClick={() => actions.onDelete(node.folder)}
          title="Delete folder"
          aria-label="Delete folder"
          className={`${iconBtnCls} hover:text-[var(--danger)]`}
        >
          ✕
        </button>
      </div>
      {node.children.map((c) => (
        <FolderNode
          key={c.folder.id}
          node={c}
          depth={depth + 1}
          actions={actions}
        />
      ))}
    </div>
  );
}

type FolderModal =
  | { mode: 'create'; parent: FolderDoc | null }
  | { mode: 'rename'; folder: FolderDoc }
  | { mode: 'duplicate'; folder: FolderDoc };

export default function Dashboard() {
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const upsertFolder = useStore((s) => s.upsertFolder);
  const removeFolders = useStore((s) => s.removeFolders);
  const addToast = useStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<FolderModal | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalCopyItems, setModalCopyItems] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FolderDoc | null>(null);

  useEffect(() => {
    let alive = true;
    inventoryListFoldersFn({})
      .then((res) => {
        if (!alive) return;
        setFolders(res.data.folders);
      })
      .catch((err) => {
        addToast(err instanceof Error ? err.message : 'Failed to load', 'error');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [setFolders, addToast]);

  function openCreate(parent: FolderDoc | null) {
    setModal({ mode: 'create', parent });
    setModalName('');
    setModalCopyItems(false);
  }
  function openRename(folder: FolderDoc) {
    setModal({ mode: 'rename', folder });
    setModalName(folder.name);
  }
  function openDuplicate(folder: FolderDoc) {
    setModal({ mode: 'duplicate', folder });
    setModalName(`${folder.name} (copy)`);
    setModalCopyItems(false);
  }
  function closeModal() {
    setModal(null);
    setModalName('');
    setModalCopyItems(false);
  }

  async function submitModal() {
    if (!modal || !modalName.trim()) return;
    setModalBusy(true);
    try {
      if (modal.mode === 'create') {
        const res = await inventoryCreateFolderFn({
          name: modalName.trim(),
          parentFolderId: modal.parent?.id ?? null,
        });
        upsertFolder(res.data);
        addToast(`Created “${res.data.name}”`, 'success');
      } else if (modal.mode === 'rename') {
        const res = await inventoryUpdateFolderFn({
          folderId: modal.folder.id,
          name: modalName.trim(),
        });
        upsertFolder(res.data);
        addToast('Renamed', 'success');
      } else {
        const res = await inventoryDuplicateFolderFn({
          folderId: modal.folder.id,
          newName: modalName.trim(),
          copyItems: modalCopyItems,
        });
        upsertFolder(res.data);
        addToast(
          modalCopyItems
            ? `Duplicated with ${res.data.itemCount} items and ${res.data.photoCount} photos`
            : 'Duplicated (schema only)',
          'success',
        );
      }
      closeModal();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setModalBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      const res = await inventoryDeleteFolderFn({ folderId: pendingDelete.id });
      const allIds = new Set<string>();
      const walk = (id: string) => {
        allIds.add(id);
        folders
          .filter((f) => f.parentFolderId === id)
          .forEach((c) => walk(c.id));
      };
      walk(pendingDelete.id);
      removeFolders(Array.from(allIds));
      addToast(`Deleted ${res.data.deletedFolderCount} folder(s)`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setPendingDelete(null);
    }
  }

  const tree = buildTree(folders);
  const actions: NodeActions = {
    onNewChild: openCreate,
    onDuplicate: openDuplicate,
    onRename: openRename,
    onDelete: setPendingDelete,
  };

  const modalTitle =
    modal?.mode === 'create'
      ? `New folder${modal.parent ? ` inside “${modal.parent.name}”` : ''}`
      : modal?.mode === 'rename'
        ? `Rename “${modal.folder.name}”`
        : modal?.mode === 'duplicate'
          ? `Duplicate “${modal.folder.name}”`
          : '';

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 gap-3">
          <h1 className="text-xl font-bold">Inventories</h1>
          <button
            onClick={() => openCreate(null)}
            className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] transition-colors shrink-0"
          >
            + New folder
          </button>
        </div>

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading…</p>
        ) : folders.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <p>No inventories yet.</p>
            <p className="text-sm mt-2">
              Click <strong>+ New folder</strong> to create your first one.
            </p>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 overflow-x-auto">
            <div className="min-w-fit">
              {tree.map((node) => (
                <FolderNode
                  key={node.folder.id}
                  node={node}
                  depth={0}
                  actions={actions}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {modal && (
        <div
          className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4"
          onClick={closeModal}
        >
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold mb-3">{modalTitle}</h2>
            <input
              autoFocus
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !modalBusy) submitModal();
              }}
              placeholder="Folder name"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2"
            />
            {modal.mode === 'duplicate' && (
              <label className="flex items-start gap-2 mt-3 text-sm">
                <input
                  type="checkbox"
                  checked={modalCopyItems}
                  onChange={(e) => setModalCopyItems(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Also copy <strong>{modal.folder.itemCount}</strong> item(s) and
                  re-upload their photos to fresh Storage paths. Slower; deletes
                  on either side won't touch the other.
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitModal}
                disabled={!modalName.trim() || modalBusy}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
              >
                {modalBusy
                  ? 'Working…'
                  : modal.mode === 'create'
                    ? 'Create'
                    : modal.mode === 'rename'
                      ? 'Rename'
                      : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        message="This folder and every subfolder + item inside it will be soft-deleted. Items can be recovered from Firestore for 30 days."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
