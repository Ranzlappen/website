import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import {
  inventoryListFoldersFn,
  inventorySearchItemsFn,
} from '../firebase';
import { useStore } from '../store';
import type { FolderDoc, ItemDoc } from '../types';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const folders = useStore((s) => s.folders);
  const setFolders = useStore((s) => s.setFolders);
  const addToast = useStore((s) => s.addToast);

  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync the URL with the visible query so refresh + share-link works.
  useEffect(() => {
    setParams(query ? { q: query } : {}, { replace: true });
  }, [query, setParams]);

  // Debounce 300ms.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch results.
  useEffect(() => {
    if (!debounced) {
      setItems([]);
      setTruncated(false);
      return;
    }
    let alive = true;
    setLoading(true);
    inventorySearchItemsFn({ query: debounced, limit: 200 })
      .then((res) => {
        if (!alive) return;
        setItems(res.data.items);
        setTruncated(res.data.truncated);
      })
      .catch((err) =>
        addToast(err instanceof Error ? err.message : 'Search failed', 'error'),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced, addToast]);

  // Ensure folder cache populated for breadcrumbs.
  useEffect(() => {
    if (folders.length > 0) return;
    let alive = true;
    inventoryListFoldersFn({})
      .then((res) => alive && setFolders(res.data.folders))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [folders.length, setFolders]);

  const folderById = useMemo(() => {
    const m = new Map<string, FolderDoc>();
    folders.forEach((f) => m.set(f.id, f));
    return m;
  }, [folders]);

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-4">Search</h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find items across all folders…"
          autoFocus
          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-3 py-2 mb-4 focus:border-[var(--accent)] focus:outline-none transition-colors"
        />

        {!debounced ? (
          <p className="text-[var(--text-muted)]">Type to search.</p>
        ) : loading ? (
          <p className="text-[var(--text-muted)]">Searching…</p>
        ) : items.length === 0 ? (
          <p className="text-[var(--text-muted)]">
            No items matched “{debounced}”.
          </p>
        ) : (
          <>
            {truncated && (
              <div className="mb-3 text-xs text-[var(--warn)]">
                Scanned the most-recent 1000 items only — older items beyond
                that cap weren't considered.
              </div>
            )}
            <ul className="space-y-2">
              {items.map((it) => {
                const folder = folderById.get(it.folderId);
                const title = String(it.fields?.title ?? it.id);
                return (
                  <li key={it.id}>
                    <Link
                      to={`/folder/${it.folderId}/item/${it.id}`}
                      className="flex items-center gap-3 p-2 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)] transition-colors"
                    >
                      {it.photos?.[0] ? (
                        <img
                          src={it.photos[0].downloadUrl}
                          alt=""
                          className="w-12 h-12 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-[var(--bg)]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{title}</div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {folder?.pathSegments.join(' › ') ?? '—'}
                        </div>
                      </div>
                      {it.ebay?.syncEnabled && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)] shrink-0">
                          eBay
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
