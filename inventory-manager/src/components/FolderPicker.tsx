import { useMemo } from 'react';
import type { FolderDoc } from '../types';

interface Props {
  folders: FolderDoc[];
  excludeId?: string;
  value: string | null;
  onChange: (folderId: string | null) => void;
}

/**
 * Flat select that lists every non-deleted folder with its breadcrumb path
 * as the option label. Used by the bulk-move action.
 */
export default function FolderPicker({
  folders,
  excludeId,
  value,
  onChange,
}: Props) {
  const sorted = useMemo(
    () =>
      folders
        .filter((f) => !f.deletedAt && f.id !== excludeId)
        .slice()
        .sort((a, b) =>
          a.pathSegments.join('/').localeCompare(b.pathSegments.join('/')),
        ),
    [folders, excludeId],
  );

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm"
    >
      <option value="">— pick a folder —</option>
      {sorted.map((f) => (
        <option key={f.id} value={f.id}>
          {f.pathSegments.join(' › ')}
        </option>
      ))}
    </select>
  );
}
