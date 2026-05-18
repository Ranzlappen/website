import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import {
  inventoryListFoldersFn,
  inventoryUpdateFolderFn,
} from '../firebase';
import { useStore } from '../store';
import {
  EBAY_MAPPING_OPTIONS,
  FIELD_TYPES,
  type FieldDef,
  type FolderDoc,
} from '../types';

function emptyField(order: number): FieldDef {
  return {
    key: '',
    label: '',
    type: 'text',
    required: false,
    ebayRequired: false,
    ebayMapping: null,
    order,
  };
}

export default function SchemaEditor() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const upsertFolder = useStore((s) => s.upsertFolder);
  const addToast = useStore((s) => s.addToast);

  const [folder, setFolder] = useState<FolderDoc | null>(null);
  const [schema, setSchema] = useState<FieldDef[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const fromCache = folders.find((f) => f.id === folderId);
    if (fromCache) {
      setFolder(fromCache);
      setSchema(fromCache.fieldSchema);
      setName(fromCache.name);
      return;
    }
    inventoryListFoldersFn({})
      .then((res) => {
        if (!alive) return;
        setFolders(res.data.folders);
        const f = res.data.folders.find((x) => x.id === folderId);
        if (f) {
          setFolder(f);
          setSchema(f.fieldSchema);
          setName(f.name);
        }
      })
      .catch((err) => addToast(err instanceof Error ? err.message : 'Load failed', 'error'));
    return () => {
      alive = false;
    };
  }, [folderId, folders, setFolders, addToast]);

  function updateField(idx: number, patch: Partial<FieldDef>) {
    setSchema((s) =>
      s.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    );
  }

  function move(idx: number, dir: -1 | 1) {
    setSchema((s) => {
      const next = s.slice();
      const target = idx + dir;
      if (target < 0 || target >= next.length) return s;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, order: i }));
    });
  }

  function removeAt(idx: number) {
    setSchema((s) => s.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i })));
  }

  function addField() {
    setSchema((s) => [...s, emptyField(s.length)]);
  }

  async function save() {
    if (!folderId) return;
    setSaving(true);
    try {
      const res = await inventoryUpdateFolderFn({
        folderId,
        name: name.trim() || undefined,
        fieldSchema: schema,
      });
      upsertFolder(res.data);
      addToast('Schema saved', 'success');
      navigate(`/folder/${folderId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Link
          to={folderId ? `/folder/${folderId}` : '/'}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-bold mt-1 mb-4">
          {folder ? `Schema: ${folder.name}` : 'Schema'}
        </h1>

        <label className="block mb-6">
          <span className="text-sm text-[var(--text-muted)]">Folder name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-3 py-2"
          />
        </label>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_140px_80px_100px_180px_80px] gap-2 px-3 py-2 text-xs uppercase text-[var(--text-muted)] border-b border-[var(--border)]">
            <span>Key</span>
            <span>Label</span>
            <span>Type</span>
            <span title="Required to save">Req.</span>
            <span title="Required for eBay">eBay Req.</span>
            <span>eBay mapping</span>
            <span>Order</span>
          </div>
          {schema.map((f, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_1fr_140px_80px_100px_180px_80px] gap-2 px-3 py-2 items-center border-b border-[var(--border)] last:border-b-0"
            >
              <input
                value={f.key}
                onChange={(e) =>
                  updateField(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
                }
                placeholder="snake_case"
                className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono"
              />
              <input
                value={f.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                placeholder="Display label"
                className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm"
              />
              <select
                value={f.type}
                onChange={(e) =>
                  updateField(idx, {
                    type: e.target.value as FieldDef['type'],
                  })
                }
                className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => updateField(idx, { required: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={f.ebayRequired}
                  onChange={(e) => updateField(idx, { ebayRequired: e.target.checked })}
                />
              </label>
              <select
                value={f.ebayMapping ?? ''}
                onChange={(e) =>
                  updateField(idx, { ebayMapping: e.target.value || null })
                }
                className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm"
              >
                {EBAY_MAPPING_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt || '(custom item-specific)'}
                  </option>
                ))}
              </select>
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => move(idx, -1)}
                  className="text-xs px-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)]"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  className="text-xs px-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)]"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeAt(idx)}
                  className="text-xs px-1.5 rounded border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  title="Remove"
                >
                  ×
                </button>
              </div>
              {f.type === 'select' && (
                <div className="col-span-full pl-2">
                  <input
                    value={(f.options ?? []).join(', ')}
                    onChange={(e) =>
                      updateField(idx, {
                        options: e.target.value
                          .split(',')
                          .map((o) => o.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Comma-separated options"
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-4">
          <button
            onClick={addField}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
          >
            + Add field
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
          >
            {saving ? 'Saving…' : 'Save schema'}
          </button>
        </div>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          ★ marks fields required for eBay export. Existing items keep any
          values for keys you remove from the schema (they just stop showing
          in the table view), so removing a key is not destructive.
        </p>
      </main>
    </>
  );
}
