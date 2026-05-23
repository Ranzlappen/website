import { useState } from 'react';
import { PLATFORM_BY_ID, platformsForField } from '../platforms';

const badgeCls =
  'inline-block text-[10px] leading-none px-1.5 py-0.5 rounded border';

/**
 * Color-coded platform badges for one schema column + an info button whose
 * popover lists every platform's EXACT export column name for this field.
 */
export default function PlatformBadges({
  fieldKey,
  platforms,
}: {
  fieldKey: string;
  platforms: string[];
}) {
  const [open, setOpen] = useState(false);
  const plats = platforms ?? [];
  const overlaps = platformsForField(fieldKey);
  if (plats.length === 0 && overlaps.length === 0) return null;

  return (
    <span className="relative inline-flex items-center gap-1 flex-wrap normal-case">
      {plats.map((p) => {
        const def = PLATFORM_BY_ID.get(p);
        if (!def) return null;
        return (
          <span key={p} className={`${badgeCls} ${def.badge}`} title={def.name}>
            {def.name}
          </span>
        );
      })}
      {overlaps.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          onBlur={() => setOpen(false)}
          className="w-4 h-4 inline-flex items-center justify-center rounded-full border border-[var(--border)] text-[9px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          title="Exact column name per platform"
          aria-label="Column name per platform"
        >
          i
        </button>
      )}
      {open && (
        <div className="absolute z-20 top-5 left-0 w-60 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 shadow-lg text-[var(--text)]">
          <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
            Exported column name
          </div>
          <ul className="space-y-1">
            {overlaps.map((o) => (
              <li key={o.platform} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[var(--text-muted)]">{o.name}</span>
                <code className="font-mono text-[11px]">
                  {o.column}
                  {o.required && <span className="text-[var(--accent)]"> *</span>}
                </code>
              </li>
            ))}
          </ul>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">* required</div>
        </div>
      )}
    </span>
  );
}
