import { useEffect, useRef, useState } from 'react';
import type { FieldDef } from '../types';
import { formatFieldValue } from '../fieldFormat';
import FieldInput from './FieldInput';
import Spinner from './Spinner';

interface Props {
  def: FieldDef;
  value: unknown;
  /** Persist the new value. Rejects on failure so the cell can revert. */
  onSave: (next: unknown) => Promise<void>;
}

/** Inline-editable table cell. Click (or Enter/Space) to edit; commit on
 * Enter/blur, cancel on Escape. Booleans toggle in place. */
export default function EditableCell({ def, value, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(value);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    containerRef.current
      ?.querySelector<HTMLElement>('input, select, textarea')
      ?.focus();
  }, [editing]);

  async function persist(next: unknown): Promise<boolean> {
    setSaving(true);
    try {
      await onSave(next);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    if (saving) return;
    setDraft(value);
    setEditing(true);
  }

  async function commit() {
    const unchanged =
      draft === value || ((draft === null || draft === undefined) && (value === null || value === undefined));
    if (unchanged) {
      setEditing(false);
      return;
    }
    const ok = await persist(draft);
    if (!ok) setDraft(value);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  // Booleans toggle directly in display mode — no edit round-trip.
  if (def.type === 'boolean') {
    return (
      <div className="flex items-center gap-2" aria-busy={saving}>
        <input
          type="checkbox"
          checked={value === true}
          disabled={saving}
          onChange={(e) => persist(e.target.checked)}
        />
        <span className="text-xs text-[var(--text-muted)]">
          {value === true ? 'Yes' : 'No'}
        </span>
        {saving && <Spinner className="text-[var(--text-muted)]" />}
      </div>
    );
  }

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-busy={saving}
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startEdit();
          }
        }}
        title="Click to edit"
        className="group flex items-center gap-1 min-h-[1.75rem] cursor-text rounded px-1 -mx-1 hover:bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      >
        <span className="truncate flex-1">{formatFieldValue(def, value)}</span>
        {saving ? (
          <Spinner className="text-[var(--text-muted)]" />
        ) : (
          <span
            aria-hidden="true"
            className="opacity-0 group-hover:opacity-60 text-xs"
          >
            ✎
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-busy={saving}
      onBlur={(e) => {
        if (!saving && !containerRef.current?.contains(e.relatedTarget as Node)) {
          commit();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && def.type !== 'longtext') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      }}
      className="relative min-w-[8rem]"
    >
      <FieldInput def={def} value={draft} onChange={setDraft} />
      {saving && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <Spinner />
        </span>
      )}
    </div>
  );
}
