/*
 * CHANGE: New file – Real-time comments hook
 * REASON: Subscribe to topic comments subcollection with live updates
 * DATE: 2026-04-13
 */
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Comment } from '../types';

/** Subscribes to comments for a specific topic in real time. */
export function useComments(topicId: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!topicId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'topics', topicId, 'comments'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Comment[];
        setComments(data);
        setLoading(false);
      },
      (err) => {
        console.error('useComments onSnapshot error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [topicId]);

  return { comments, loading };
}
