/*
 * CHANGE: Rewrote hook with cursor-based pagination
 * REASON: Support "Load more" pagination instead of loading all topics at once
 * DATE: 2026-04-13
 */
import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Topic } from '../types';

const PAGE_SIZE = 12;

/** Subscribes to topics with cursor-based pagination. */
export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Initial page: real-time subscription for first batch
  useEffect(() => {
    const q = query(
      collection(db, 'topics'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Topic[];
        setTopics(data);
        setLoading(false);
        setError(null);
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length >= PAGE_SIZE);
      },
      (err) => {
        console.error('useTopics onSnapshot error:', err);
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // Load more: one-shot fetch for subsequent pages
  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'topics'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Topic[];
      setTopics((prev) => {
        // Deduplicate by ID in case real-time listener already has some
        const existingIds = new Set(prev.map((t) => t.id));
        const newTopics = data.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTopics];
      });
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length >= PAGE_SIZE);
    } catch (err: unknown) {
      console.error('loadMore error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, loadingMore, hasMore]);

  return { topics, loading, loadingMore, hasMore, loadMore, error };
}
