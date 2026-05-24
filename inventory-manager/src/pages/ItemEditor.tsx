import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import Header from '../components/Header';
import FieldInput from '../components/FieldInput';
import PhotoGrid from '../components/PhotoGrid';
import PlatformBadges from '../components/PlatformBadges';
import Spinner from '../components/Spinner';
import {
  inventoryCreateItemFn,
  inventoryDuplicateItemFn,
  inventoryGetItemFn,
  inventoryListFoldersFn,
  inventoryUpdateItemFn,
} from '../firebase';
import { useStore } from '../store';
import { EBAY_CONDITION_IDS, EBAY_DURATIONS, EBAY_FORMATS } from '../ebay';
import { missingForPlatform, PLATFORM_BY_ID } from '../platforms';
import {
  defaultEbayBlock,
  type EbayBlock,
  type FolderDoc,
  type ItemDoc,
  type PhotoRef,
} from '../types';

const AUTO_SAVE_DEBOUNCE_MS = 2500;

export default function ItemEditor() {
  const { folderId, itemId } = useParams<{ folderId: string; itemId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const upsertItem = useStore((s) => s.upsertItem);
  const addToast = useStore((s) => s.addToast);

  const [folder, setFolder] = useState<FolderDoc | null>(null);
  const [item, setItem] = useState<ItemDoc | null>(null);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [ebay, setEbay] = useState<EbayBlock>(defaultEbayBlock());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dupBusy, setDupBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  // Load folder + (optionally) existing item.
  useEffect(() => {
    if (!folderId) return;
    let alive = true;
    const work = async () => {
      try {
        let folderDoc = folders.find((f) => f.id === folderId) ?? null;
        if (!folderDoc) {
          const res = await inventoryListFoldersFn({});
          if (!alive) return;
          setFolders(res.data.folders);
          folderDoc = res.data.folders.find((f) => f.id === folderId) ?? null;
        }
        if (alive) setFolder(folderDoc);
        if (itemId) {
          const r = await inventoryGetItemFn({ itemId });
          if (!alive) return;
          setItem(r.data);
          setFields(r.data.fields ?? {});
          setPhotos(r.data.photos ?? []);
          setEbay(r.data.ebay ?? defaultEbayBlock());
        } else if (folderDoc) {
          // Seed empty values for every schema field.
          const seed: Record<string, unknown> = {};
          folderDoc.fieldSchema.forEach((f) => {
            seed[f.key] = f.type === 'boolean' ? false : null;
          });
          // Prefill the first EAN-typed field if `?ean=<code>` came in from
          // the scan-to-find flow.
          const prefillEan = searchParams.get('ean');
          if (prefillEan) {
            const firstEan = folderDoc.fieldSchema.find((f) => f.type === 'ean');
            if (firstEan) seed[firstEan.key] = prefillEan;
          }
          if (alive) setFields(seed);
        }
      } catch (err) {
        if (alive)
          addToast(err instanceof Error ? err.message : 'Load failed', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    };
    work();
    return () => {
      alive = false;
    };
  }, [folderId, itemId, folders, setFolders, addToast, searchParams]);

  function patchField(key: string, value: unknown) {
    setFields((f) => ({ ...f, [key]: value }));
    dirtyRef.current = true;
  }

  function patchEbay(patch: Partial<EbayBlock>) {
    setEbay((e) => ({ ...e, ...patch }));
    dirtyRef.current = true;
  }

  const readiness = useMemo(
    () =>
      (folder?.platformTags ?? []).map((tag) => ({
        tag,
        missing: missingForPlatform({ fields, photos }, tag),
      })),
    [folder, fields, photos],
  );

  async function save(opts: { silent?: boolean } = {}) {
    if (!folder) return;
    if (saving) return;
    setSaving(true);
    try {
      if (item) {
        const res = await inventoryUpdateItemFn({
          itemId: item.id,
          fields,
          ebay,
        });
        setItem(res.data);
        upsertItem(res.data);
      } else {
        const res = await inventoryCreateItemFn({
          folderId: folder.id,
          fields,
          ebay,
        });
        setItem(res.data);
        upsertItem(res.data);
        setPhotos(res.data.photos ?? []);
        navigate(`/folder/${folder.id}/item/${res.data.id}`, { replace: true });
      }
      dirtyRef.current = false;
      setLastSaved(new Date());
      if (!opts.silent) addToast('Saved', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Auto-save: only kicks in once the item has been created (we need an id).
  useEffect(() => {
    if (!item) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      if (dirtyRef.current) {
        save({ silent: true });
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // We only re-arm when the user's edits change `fields`/`ebay`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, ebay, item]);

  // Flush pending edits on unmount.
  useEffect(() => {
    return () => {
      if (dirtyRef.current && item) {
        // Best effort — fire-and-forget save.
        inventoryUpdateItemFn({ itemId: item.id, fields, ebay }).catch(() => {
          /* the auto-save would have surfaced the error via toast */
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            to={`/folder/${folderId}`}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            ← Back to folder
          </Link>
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-3 flex-wrap">
            {saving && <span>Saving…</span>}
            {!saving && lastSaved && (
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            )}
            {item && (
              <button
                onClick={async () => {
                  setDupBusy(true);
                  try {
                    const res = await inventoryDuplicateItemFn({
                      itemId: item.id,
                    });
                    upsertItem(res.data);
                    addToast('Item duplicated', 'success');
                    navigate(`/folder/${item.folderId}/item/${res.data.id}`);
                  } catch (err) {
                    addToast(
                      err instanceof Error ? err.message : 'Duplicate failed',
                      'error',
                    );
                  } finally {
                    setDupBusy(false);
                  }
                }}
                disabled={dupBusy}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text)] text-xs hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
              >
                {dupBusy && <Spinner />}
                Duplicate item
              </button>
            )}
            <button
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--bg)] text-xs font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {saving && <Spinner />}
              Save now
            </button>
          </div>
        </div>

        {loading || !folder ? (
          <p className="text-[var(--text-muted)]">Loading…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-5 space-y-4">
              <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)]">
                {item ? 'Edit item' : 'New item'}
              </h2>
              {folder.fieldSchema.map((f) => (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="text-sm flex items-center gap-2 flex-wrap">
                    {f.label}
                    {f.required && <span className="text-[var(--danger)]">*</span>}
                    {(f.platforms?.length ?? 0) > 0 && (
                      <PlatformBadges fieldKey={f.key} platforms={f.platforms ?? []} />
                    )}
                  </span>
                  <FieldInput
                    def={f}
                    value={fields[f.key]}
                    onChange={(v) => patchField(f.key, v)}
                  />
                </label>
              ))}

              {item && (
                <PhotoGrid
                  itemId={item.id}
                  photos={photos}
                  onChange={(next) => {
                    setPhotos(next);
                    upsertItem({ ...item, photos: next });
                  }}
                />
              )}
              {!item && (
                <p className="text-xs text-[var(--text-muted)] mt-4">
                  Save the item first to upload photos.
                </p>
              )}
            </section>

            <aside className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-5 space-y-4 h-fit lg:sticky lg:top-4">
              <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)]">
                Export
              </h2>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ebay.syncEnabled}
                  onChange={(e) => patchEbay({ syncEnabled: e.target.checked })}
                />
                <span>Include in exports</span>
              </label>

              {ebay.syncEnabled && readiness.length === 0 && (
                <div className="text-xs p-2 rounded border border-[var(--border)] text-[var(--text-muted)]">
                  This folder has no platform tags. Add tags in Edit schema to
                  enable platform exports.
                </div>
              )}
              {ebay.syncEnabled && readiness.length > 0 && (
                <ul className="space-y-1">
                  {readiness.map(({ tag, missing }) => (
                    <li
                      key={tag}
                      className={`text-xs p-2 rounded border ${
                        missing.length
                          ? 'border-[var(--warn)] text-[var(--warn)]'
                          : 'border-[var(--accent)] text-[var(--accent)]'
                      }`}
                    >
                      <strong>{PLATFORM_BY_ID.get(tag)?.name ?? tag}:</strong>{' '}
                      {missing.length ? `missing ${missing.join(', ')}` : 'ready'}
                    </li>
                  ))}
                </ul>
              )}

              {folder.platformTags?.includes('ebay') && (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--text-muted)]">eBay Format</span>
                    <select
                      value={ebay.format}
                      onChange={(e) =>
                        patchEbay({ format: e.target.value as EbayBlock['format'] })
                      }
                      className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2"
                    >
                      {EBAY_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--text-muted)]">eBay Duration</span>
                    <select
                      value={ebay.duration}
                      onChange={(e) => patchEbay({ duration: e.target.value })}
                      className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2"
                    >
                      {EBAY_DURATIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--text-muted)]">eBay Category ID</span>
                    <input
                      value={ebay.categoryId ?? ''}
                      onChange={(e) => patchEbay({ categoryId: e.target.value || null })}
                      placeholder="e.g. 15052"
                      className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--text-muted)]">eBay Condition ID</span>
                    <select
                      value={ebay.conditionId ?? ''}
                      onChange={(e) =>
                        patchEbay({
                          conditionId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2"
                    >
                      <option value="">—</option>
                      {EBAY_CONDITION_IDS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} – {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {ebay.listingStatus !== 'none' && (
                <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                  Status: <strong>{ebay.listingStatus}</strong>
                  {ebay.lastExportedAt && (
                    <> · last exported {new Date(ebay.lastExportedAt).toLocaleString()}</>
                  )}
                  {ebay.listingId && <> · eBay #{ebay.listingId}</>}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
