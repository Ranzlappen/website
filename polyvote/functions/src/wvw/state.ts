/**
 * Dirty flags for debounced index rebuilds (consumed by the maintenance job).
 * Rebuilding the guild directory reads every guild doc in a region, so
 * profile edits / claims just flag it and the 10-minute job rebuilds once.
 */
import { COL, db } from './config';

export type DirtyKey = 'guildIndex' | 'guildStats';

export async function markDirty(key: DirtyKey, ids?: string[]): Promise<void> {
  const { FieldValue } = await import('firebase-admin/firestore');
  await db()
    .collection(COL.state)
    .doc('dirty')
    .set(
      { [key]: true, ...(ids?.length ? { [`${key}Ids`]: FieldValue.arrayUnion(...ids.slice(0, 100)) } : {}) },
      { merge: true },
    );
}

/** Atomically read + clear the flags. */
export async function takeDirty(): Promise<{ guildIndex: boolean; guildStatsIds: string[] }> {
  const ref = db().collection(COL.state).doc('dirty');
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data() ?? {};
    tx.set(ref, { guildIndex: false, guildStats: false, guildStatsIds: [] });
    return { guildIndex: d.guildIndex === true, guildStatsIds: (d.guildStatsIds ?? []) as string[] };
  });
}
