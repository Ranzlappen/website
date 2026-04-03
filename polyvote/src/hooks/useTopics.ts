/*
 * CHANGE: New file – Hook for real-time topics list
 * REASON: Subscribes to the Firestore `topics` collection with onSnapshot
 * DATE: 2026-04-02
 */
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Topic } from '../types';

/** Subscribes to all topics in real time, ordered by creation date (newest first). */
export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'topics'), orderBy('createdAt', 'desc'));
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
      },
      (err) => {
        console.error('useTopics onSnapshot error:', err);
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { topics, loading, error };
}
