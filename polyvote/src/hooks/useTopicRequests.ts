/*
 * CHANGE: New file – Hook for real-time topic requests list
 * REASON: Subscribes to the Firestore `topicRequests` collection with onSnapshot
 * DATE: 2026-04-03
 */
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TopicRequest } from '../types';

/** Subscribes to all topic requests in real time, ordered by creation date (newest first). */
export function useTopicRequests() {
  const [requests, setRequests] = useState<TopicRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'topicRequests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TopicRequest[];
        setRequests(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useTopicRequests onSnapshot error:', err);
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { requests, loading, error };
}
