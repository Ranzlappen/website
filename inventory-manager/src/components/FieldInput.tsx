import type { FieldDef } from '../types';

interface Props {
  def: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  invalid?: boolean;
}

const baseInputCls =
  'w-full bg-[var(--bg)] border rounded px-3 py-2 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors';

export default function FieldInput({ def, value, onChange, invalid }: Props) {
  const borderCls = invalid
    ? 'border-[var(--danger)]'
    : 'border-[var(--border)]';

  const cls = `${baseInputCls} ${borderCls}`;
  const v = value;

  switch (def.type) {
    case 'longtext':
      return (
        <textarea
          value={typeof v === 'string' ? v : ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className={cls}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          step="any"
          value={v === null || v === undefined ? '' : String(v)}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
          className={cls}
        />
      );
    case 'boolean':
      return (
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={v === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-[var(--text-muted)]">
            {v === true ? 'Yes' : 'No'}
          </span>
        </label>
      );
    case 'select':
      return (
        <select
          value={typeof v === 'string' ? v : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={cls}
        >
          <option value="">—</option>
          {def.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case 'date':
      return (
        <input
          type="date"
          value={typeof v === 'string' ? v : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={cls}
        />
      );
    case 'url':
      return (
        <input
          type="url"
          value={typeof v === 'string' ? v : ''}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      );
    case 'text':
    default:
      return (
        <input
          type="text"
          value={typeof v === 'string' ? v : ''}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      );
  }
}
