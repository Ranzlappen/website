/*
 * CHANGE: New file – Hook for single topic real-time subscription
 * REASON: Provides live-updating topic data on the detail page
 * DATE: 2026-04-02
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Topic } from '../types';

/** Subscribes to a single topic document by ID. */
export function useTopic(topicId: string | undefined) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) return;
    const unsub = onSnapshot(
      doc(db, 'topics', topicId),
      (snap) => {
        if (snap.exists()) {
          setTopic({ id: snap.id, ...snap.data() } as Topic);
        } else {
          setTopic(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useTopic onSnapshot error:', err);
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [topicId]);

  return { topic, loading, error };
}
