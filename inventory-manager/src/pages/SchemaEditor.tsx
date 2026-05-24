import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import PlatformBadges from '../components/PlatformBadges';
import PlatformTagSelector from '../components/PlatformTagSelector';
import Spinner from '../components/Spinner';
import { inventoryListFoldersFn, inventoryUpdateFolderFn } from '../firebase';
import { ensureTagColumns } from '../platforms';
import { useStore } from '../store';
import { FIELD_TYPES, type FieldDef, type FolderDoc } from '../types';

function emptyField(order: number): FieldDef {
  return {
    key: '',
    label: '',
    type: 'text',
    required: false,
    platforms: [],
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
  const [tags, setTags] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const apply = (f: FolderDoc) => {
      setFolder(f);
      setSchema(f.fieldSchema);
      setTags(f.platformTags ?? []);
      setName(f.name);
    };
    const fromCache = folders.find((f) => f.id === folderId);
    if (fromCache) {
      apply(fromCache);
      return;
    }
    inventoryListFoldersFn({})
      .then((res) => {
        if (!alive) return;
        setFolders(res.data.folders);
        const f = res.data.folders.find((x) => x.id === folderId);
        if (f) apply(f);
      })
      .catch((err) => addToast(err instanceof Error ? err.message : 'Load failed', 'error'));
    return () => {
      alive = false;
    };
  }, [folderId, folders, setFolders, addToast]);

  function updateField(idx: number, patch: Partial<FieldDef>) {
    setSchema((s) => s.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
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

  // Applying/stripping a tag regenerates the columns it owns (badges refresh,
  // missing columns appear; stripping keeps columns + data, drops badges).
  function onTagsChange(next: string[]) {
    setTags(next);
    setSchema((s) => ensureTagColumns(s, next));
  }

  async function save() {
    if (!folderId) return;
    setSaving(true);
    try {
      const res = await inventoryUpdateFolderFn({
        folderId,
        name: name.trim() || undefined,
        fieldSchema: schema,
        platformTags: tags,
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

        <section className="mb-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-1">Platform tags</h2>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Tags decide which columns this folder's items need. Adding a tag
            generates its required columns; removing a tag keeps the columns and
            your data — only the badges disappear.
          </p>
          <PlatformTagSelector value={tags} onChange={onTagsChange} />
        </section>

        <div className="space-y-3">
          {schema.map((f, idx) => (
            <div
              key={idx}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-3 space-y-3 lg:grid lg:grid-cols-[1fr_1fr_150px_80px_1fr_100px] lg:gap-2 lg:items-center lg:space-y-0"
            >
              <label className="flex flex-col gap-1 lg:gap-0">
                <span className="text-[10px] uppercase text-[var(--text-muted)] lg:hidden">
                  Key
                </span>
                <input
                  value={f.key}
                  onChange={(e) =>
                    updateField(idx, {
                      key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    })
                  }
                  placeholder="snake_case"
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono w-full"
                />
              </label>

              <label className="flex flex-col gap-1 lg:gap-0">
                <span className="text-[10px] uppercase text-[var(--text-muted)] lg:hidden">
                  Label
                </span>
                <input
                  value={f.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })}
                  placeholder="Display label"
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm w-full"
                />
              </label>

              <label className="flex flex-col gap-1 lg:gap-0">
                <span className="text-[10px] uppercase text-[var(--text-muted)] lg:hidden">
                  Type
                </span>
                <select
                  value={f.type}
                  onChange={(e) => updateField(idx, { type: e.target.value as FieldDef['type'] })}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm w-full"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 lg:justify-center">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => updateField(idx, { required: e.target.checked })}
                />
                <span className="text-xs lg:hidden">Required</span>
              </label>

              <div className="flex flex-col gap-1 lg:gap-0">
                <span className="text-[10px] uppercase text-[var(--text-muted)] lg:hidden">
                  Platforms
                </span>
                <PlatformBadges fieldKey={f.key} platforms={f.platforms} />
              </div>

              <div className="flex gap-2 lg:justify-end">
                <button
                  onClick={() => move(idx, -1)}
                  className="flex-1 lg:flex-none px-2 py-1 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)]"
                  title="Move up"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  className="flex-1 lg:flex-none px-2 py-1 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)]"
                  title="Move down"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeAt(idx)}
                  className="flex-1 lg:flex-none px-2 py-1 text-sm rounded border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  title="Remove"
                  aria-label="Remove field"
                >
                  ×
                </button>
              </div>

              {f.type === 'select' && (
                <label className="flex flex-col gap-1 lg:col-span-6">
                  <span className="text-[10px] uppercase text-[var(--text-muted)]">
                    Options (comma-separated)
                  </span>
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
                </label>
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
          >
            {saving && <Spinner />}
            {saving ? 'Saving…' : 'Save schema'}
          </button>
        </div>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Colored badges show which platforms use a column; the ⓘ button lists
          each platform's exact exported column name. Existing items keep any
          values for keys you remove from the schema (they just stop showing in
          the table), so removing a key is not destructive.
        </p>
      </main>
    </>
  );
}
