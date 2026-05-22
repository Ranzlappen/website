import { useRef, useState } from 'react';
import { inventoryImportFn } from '../firebase';
import { useStore } from '../store';

interface Props {
  folderId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Summary = {
  toCreate: number;
  toUpdate: number;
  skipped: { row: number; reason: string }[];
};

export default function ImportDialog({ folderId, open, onClose, onImported }: Props) {
  const addToast = useStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState('');
  const [format, setFormat] = useState<'csv' | 'json' | 'ebay-csv'>('csv');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function reset() {
    setData('');
    setSummary(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setData(text);
    setSummary(null);
    if (file.name.toLowerCase().endsWith('.json')) setFormat('json');
    else setFormat('csv');
  }

  async function runDryRun() {
    if (!data.trim()) {
      addToast('Paste data or pick a file first.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await inventoryImportFn({ folderId, format, data, dryRun: true });
      setSummary(res.data.summary);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Dry-run failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const res = await inventoryImportFn({ folderId, format, data, dryRun: false });
      addToast(
        `Imported: created ${res.data.summary.toCreate}, updated ${res.data.summary.toUpdate}, skipped ${res.data.summary.skipped.length}`,
        'success',
      );
      reset();
      onImported();
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-start justify-center px-4 py-8 overflow-auto">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import items</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <label className="text-sm flex items-center gap-1">
            <input
              type="radio"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
            />
            CSV
          </label>
          <label className="text-sm flex items-center gap-1">
            <input
              type="radio"
              checked={format === 'json'}
              onChange={() => setFormat('json')}
            />
            JSON
          </label>
          <label className="text-sm flex items-center gap-1">
            <input
              type="radio"
              checked={format === 'ebay-csv'}
              onChange={() => setFormat('ebay-csv')}
            />
            eBay CSV
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-xs text-[var(--text-muted)]"
          />
        </div>

        <textarea
          value={data}
          onChange={(e) => {
            setData(e.target.value);
            setSummary(null);
          }}
          placeholder={
            format === 'csv'
              ? 'Header row required. Column names must match your folder schema field keys or labels.'
              : format === 'ebay-csv'
                ? 'Paste an eBay File Exchange CSV. Title / Description / StartPrice / CustomLabel etc. map back via each field’s ebayMapping. PicURL / Action / Country / Currency are ignored.'
                : 'Either an array of { fields: {...} } objects, or { items: [...] }.'
          }
          rows={10}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded p-2 font-mono text-xs"
        />

        {summary && (
          <div className="mt-4 p-3 rounded bg-[var(--bg)] border border-[var(--border)] text-sm">
            <p>
              <strong>{summary.toCreate}</strong> will be created,{' '}
              <strong>{summary.toUpdate}</strong> will be updated (matched by
              SKU),{' '}
              <strong className={summary.skipped.length ? 'text-[var(--warn)]' : ''}>
                {summary.skipped.length}
              </strong>{' '}
              will be skipped.
            </p>
            {summary.skipped.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[var(--text-muted)]">
                  Show skipped rows
                </summary>
                <ul className="mt-2 list-disc list-inside text-xs">
                  {summary.skipped.slice(0, 20).map((s, i) => (
                    <li key={i}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-[var(--border)] hover:border-[var(--accent)] text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={runDryRun}
            disabled={busy || !data.trim()}
            className="px-4 py-2 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--bg)] text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {busy ? 'Working…' : 'Preview'}
          </button>
          <button
            onClick={commit}
            disabled={busy || !summary}
            className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            Commit
          </button>
        </div>
      </div>
    </div>
  );
}
