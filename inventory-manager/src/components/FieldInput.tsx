import { useState } from 'react';
import type { FieldDef } from '../types';
import BarcodeScanner from './BarcodeScanner';

interface Props {
  def: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  invalid?: boolean;
}

const baseInputCls =
  'w-full bg-[var(--bg)] border rounded px-3 py-2 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors';

export default function FieldInput({ def, value, onChange, invalid }: Props) {
  const [scannerOpen, setScannerOpen] = useState(false);
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
    case 'ean':
      return (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={typeof v === 'string' ? v : ''}
              onChange={(e) =>
                onChange(e.target.value.replace(/\s+/g, ''))
              }
              placeholder="8, 12, 13 or 14 digits"
              className={`${cls} font-mono`}
            />
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="shrink-0 px-3 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
              title="Scan with camera"
            >
              Scan
            </button>
          </div>
          <BarcodeScanner
            open={scannerOpen}
            onCancel={() => setScannerOpen(false)}
            onDetected={(code) => {
              setScannerOpen(false);
              onChange(code);
            }}
          />
        </>
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
