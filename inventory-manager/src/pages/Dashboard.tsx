import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  inventoryCreateFolderFn,
  inventoryDeleteFolderFn,
  inventoryListFoldersFn,
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

function FolderNode({
  node,
  depth,
  onDelete,
  onNewChild,
}: {
  node: TreeNode;
  depth: number;
  onDelete: (f: FolderDoc) => void;
  onNewChild: (parent: FolderDoc) => void;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 group"
        style={{ paddingLeft: depth * 18 }}
      >
        <Link
          to={`/folder/${node.folder.id}`}
          className="flex-1 truncate hover:text-[var(--accent)] transition-colors"
        >
          📁 {node.folder.name}
        </Link>
        <span className="text-xs text-[var(--text-muted)]">
          {node.folder.itemCount} items
        </span>
        <button
          onClick={() => onNewChild(node.folder)}
          title="New subfolder"
          className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-all"
        >
          + sub
        </button>
        <button
          onClick={() => onDelete(node.folder)}
          title="Delete folder"
          className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-all"
        >
          delete
        </button>
      </div>
      {node.children.map((c) => (
        <FolderNode
          key={c.folder.id}
          node={c}
          depth={depth + 1}
          onDelete={onDelete}
          onNewChild={onNewChild}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const upsertFolder = useStore((s) => s.upsertFolder);
  const removeFolders = useStore((s) => s.removeFolders);
  const addToast = useStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<{ parent: FolderDoc | null } | null>(
    null,
  );
  const [newName, setNewName] = useState('');
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

  async function createFolder() {
    if (!newName.trim()) return;
    try {
      const res = await inventoryCreateFolderFn({
        name: newName.trim(),
        parentFolderId: creating?.parent?.id ?? null,
      });
      upsertFolder(res.data);
      addToast(`Created “${res.data.name}”`, 'success');
      setCreating(null);
      setNewName('');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Create failed', 'error');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      const res = await inventoryDeleteFolderFn({ folderId: pendingDelete.id });
      // Cascade: remove this folder + every descendant from cache.
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

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Inventories</h1>
          <button
            onClick={() => {
              setCreating({ parent: null });
              setNewName('');
            }}
            className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
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
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-3">
            {tree.map((node) => (
              <FolderNode
                key={node.folder.id}
                node={node}
                depth={0}
                onDelete={setPendingDelete}
                onNewChild={(parent) => {
                  setCreating({ parent });
                  setNewName('');
                }}
              />
            ))}
          </div>
        )}
      </main>

      {creating && (
        <div
          className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4"
          onClick={() => setCreating(null)}
        >
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold mb-3">
              New folder{creating.parent ? ` inside “${creating.parent.name}”` : ''}
            </h2>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
              }}
              placeholder="e.g. Vintage cameras"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setCreating(null)}
                className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newName.trim()}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
              >
                Create
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
