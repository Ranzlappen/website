import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import PlatformTagSelector from '../components/PlatformTagSelector';
import Spinner from '../components/Spinner';
import {
  inventoryCreateFolderFn,
  inventoryDeleteFolderFn,
  inventoryDuplicateFolderFn,
  inventoryListFoldersFn,
  inventoryUpdateFolderFn,
} from '../firebase';

/** True if `targetId` is `srcId` itself or any descendant — used to reject
 * drops that would create a cycle. */
function isSelfOrDescendant(
  srcId: string,
  targetId: string | null,
  folders: FolderDoc[],
): boolean {
  if (!targetId) return false;
  if (srcId === targetId) return true;
  const childrenOf = new Map<string, string[]>();
  folders.forEach((f) => {
    const key = f.parentFolderId ?? '__root__';
    const arr = childrenOf.get(key) ?? [];
    arr.push(f.id);
    childrenOf.set(key, arr);
  });
  const stack = [srcId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === targetId) return true;
    (childrenOf.get(cur) ?? []).forEach((c) => stack.push(c));
  }
  return false;
}
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
  onDragStart: (f: FolderDoc) => void;
  onDragEnd: () => void;
  onDrop: (target: FolderDoc | null) => void;
  draggingFolderId: string | null;
  movingFolderId: string | null;
  hoverFolderId: string | null;
  setHoverFolderId: (id: string | null) => void;
}

const iconBtnCls =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded text-sm text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-hover)] transition-colors';

function FolderNode({
  node,
  depth,
  actions,
  folders,
}: {
  node: TreeNode;
  depth: number;
  actions: NodeActions;
  folders: FolderDoc[];
}) {
  const isDragging = actions.draggingFolderId === node.folder.id;
  const isHover = actions.hoverFolderId === node.folder.id;
  const dropLegal =
    !!actions.draggingFolderId &&
    !isSelfOrDescendant(actions.draggingFolderId, node.folder.id, folders);

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          actions.onDragStart(node.folder);
        }}
        onDragEnd={actions.onDragEnd}
        onDragOver={(e) => {
          if (dropLegal) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            actions.setHoverFolderId(node.folder.id);
          }
        }}
        onDragLeave={() => {
          if (isHover) actions.setHoverFolderId(null);
        }}
        onDrop={(e) => {
          if (dropLegal) {
            e.preventDefault();
            actions.onDrop(node.folder);
          }
        }}
        className={`flex items-center gap-1 py-1 rounded transition-colors ${
          isDragging ? 'opacity-50' : ''
        } ${isHover && dropLegal ? 'bg-[var(--bg-surface-hover)] outline outline-1 outline-[var(--accent)]' : ''}`}
        style={{ paddingLeft: depth * 16 }}
      >
        <span className="text-[var(--text-muted)] cursor-grab select-none" title="Drag to move">⋮⋮</span>
        <Link
          to={`/folder/${node.folder.id}`}
          className="flex-1 min-w-0 truncate hover:text-[var(--accent)] transition-colors py-1.5"
        >
          📁 {node.folder.name}
          <span className="ml-2 text-xs text-[var(--text-muted)]">
            {node.folder.itemCount}
          </span>
        </Link>
        {actions.movingFolderId === node.folder.id && (
          <Spinner className="text-[var(--text-muted)]" />
        )}
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
          folders={folders}
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
  const [modalTags, setModalTags] = useState<string[]>([]);
  const [modalBusy, setModalBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FolderDoc | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [hoverFolderId, setHoverFolderId] = useState<string | null>(null);
  const [rootHover, setRootHover] = useState(false);

  async function moveFolder(source: FolderDoc, targetParentId: string | null) {
    if (source.parentFolderId === targetParentId) return;
    setMovingFolderId(source.id);
    try {
      await inventoryUpdateFolderFn({
        folderId: source.id,
        parentFolderId: targetParentId,
      });
      // Re-fetch the full tree — pathSegments on descendants need updating.
      const res = await inventoryListFoldersFn({});
      setFolders(res.data.folders);
      addToast(
        targetParentId
          ? `Moved “${source.name}” into a new parent`
          : `Moved “${source.name}” to root`,
        'success',
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Move failed', 'error');
    } finally {
      setMovingFolderId(null);
    }
  }

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
    setModalTags([]);
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
    setModalTags([]);
  }

  async function submitModal() {
    if (!modal || !modalName.trim()) return;
    setModalBusy(true);
    try {
      if (modal.mode === 'create') {
        const res = await inventoryCreateFolderFn({
          name: modalName.trim(),
          parentFolderId: modal.parent?.id ?? null,
          platformTags: modalTags,
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
      setPendingDelete(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  }

  const tree = buildTree(folders);
  const actions: NodeActions = {
    onNewChild: openCreate,
    onDuplicate: openDuplicate,
    onRename: openRename,
    onDelete: setPendingDelete,
    onDragStart: (f) => setDraggingFolderId(f.id),
    onDragEnd: () => {
      setDraggingFolderId(null);
      setHoverFolderId(null);
      setRootHover(false);
    },
    onDrop: (target) => {
      const src = folders.find((f) => f.id === draggingFolderId);
      setDraggingFolderId(null);
      setHoverFolderId(null);
      setRootHover(false);
      if (src) moveFolder(src, target?.id ?? null);
    },
    draggingFolderId,
    movingFolderId,
    hoverFolderId,
    setHoverFolderId,
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
              {draggingFolderId && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setRootHover(true);
                  }}
                  onDragLeave={() => setRootHover(false)}
                  onDrop={() => {
                    const src = folders.find((f) => f.id === draggingFolderId);
                    setDraggingFolderId(null);
                    setHoverFolderId(null);
                    setRootHover(false);
                    if (src) moveFolder(src, null);
                  }}
                  className={`mb-2 px-3 py-2 text-xs text-center border-2 border-dashed rounded transition-colors ${
                    rootHover
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--bg-surface-hover)]'
                      : 'border-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  Drop here to move to root
                </div>
              )}
              {tree.map((node) => (
                <FolderNode
                  key={node.folder.id}
                  node={node}
                  depth={0}
                  actions={actions}
                  folders={folders}
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
            {modal.mode === 'create' && (
              <div className="mt-4">
                <div className="text-xs uppercase text-[var(--text-muted)] mb-2">
                  Platform tags
                </div>
                <PlatformTagSelector value={modalTags} onChange={setModalTags} />
                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                  Each tag adds the columns that platform's export requires.
                </p>
              </div>
            )}
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
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
              >
                {modalBusy && <Spinner />}
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
