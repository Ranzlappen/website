import { useState } from 'react';
import { inventoryBulkUpdateFn, type BulkAction } from '../firebase';
import { useStore } from '../store';
import type { FieldDef, FolderDoc } from '../types';
import FieldInput from './FieldInput';
import FolderPicker from './FolderPicker';
import Spinner from './Spinner';

interface Props {
  folder: FolderDoc;
  folders: FolderDoc[];
  selectedIds: string[];
  onClear: () => void;
  onCompleted: () => void;
}

type Mode = null | 'move' | 'setField';

export default function BulkActionBar({
  folder,
  folders,
  selectedIds,
  onClear,
  onCompleted,
}: Props) {
  const addToast = useStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const [runKey, setRunKey] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [fieldKey, setFieldKey] = useState<string>(folder.fieldSchema[0]?.key ?? '');
  const [fieldValue, setFieldValue] = useState<unknown>(null);

  async function run(
    action: BulkAction,
    payload?: Record<string, unknown>,
    key?: string,
  ) {
    setBusy(true);
    setRunKey(key ?? action);
    try {
      const res = await inventoryBulkUpdateFn({
        itemIds: selectedIds,
        action,
        payload,
      });
      const skip = res.data.skipped.length;
      addToast(
        `${res.data.updated} updated${skip ? `, ${skip} skipped` : ''}`,
        skip ? 'info' : 'success',
      );
      onCompleted();
      onClear();
      setMode(null);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : 'Bulk action failed',
        'error',
      );
    } finally {
      setBusy(false);
      setRunKey(null);
    }
  }

  const fieldDef: FieldDef | undefined = folder.fieldSchema.find(
    (f) => f.key === fieldKey,
  );

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-[var(--bg-surface)] border-t border-[var(--border)] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          {selectedIds.length} selected
        </span>
        <button
          onClick={onClear}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] mr-3"
        >
          Clear
        </button>

        {mode === null && (
          <>
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Delete ${selectedIds.length} item(s)?`)) return;
                run('delete', undefined, 'delete');
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50 transition-colors"
            >
              {runKey === 'delete' && <Spinner />}
              Delete
            </button>
            <button
              disabled={busy}
              onClick={() => run('toggleEbay', { enabled: true }, 'include')}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              {runKey === 'include' && <Spinner />}
              Include in export
            </button>
            <button
              disabled={busy}
              onClick={() => run('toggleEbay', { enabled: false }, 'exclude')}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              {runKey === 'exclude' && <Spinner />}
              Exclude from export
            </button>
            <button
              disabled={busy}
              onClick={() => setMode('move')}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              Move…
            </button>
            <button
              disabled={busy}
              onClick={() => setMode('setField')}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              Set field…
            </button>
          </>
        )}

        {mode === 'move' && (
          <>
            <div className="flex-1 min-w-[200px]">
              <FolderPicker
                folders={folders}
                excludeId={folder.id}
                value={moveTarget}
                onChange={setMoveTarget}
              />
            </div>
            <button
              onClick={() => setMode(null)}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={busy || !moveTarget}
              onClick={() =>
                moveTarget &&
                run('move', { targetFolderId: moveTarget }, 'move')
              }
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
            >
              {runKey === 'move' && <Spinner />}
              Move
            </button>
          </>
        )}

        {mode === 'setField' && (
          <>
            <select
              value={fieldKey}
              onChange={(e) => {
                setFieldKey(e.target.value);
                setFieldValue(null);
              }}
              className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-sm"
            >
              {folder.fieldSchema.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className="flex-1 min-w-[180px]">
              {fieldDef && (
                <FieldInput
                  def={fieldDef}
                  value={fieldValue}
                  onChange={setFieldValue}
                />
              )}
            </div>
            <button
              onClick={() => setMode(null)}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run('setField', { fieldKey, value: fieldValue }, 'setField')
              }
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
            >
              {runKey === 'setField' && <Spinner />}
              Apply
            </button>
          </>
        )}
      </div>
    </div>
  );
}
