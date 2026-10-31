/**
 * Phase 3 — POST wvw-voiceSamples (from wvw/voice-worker).
 *
 * The worker holds the only Discord gateway connection, tracks voice-channel
 * occupancy in the hub and posts `{ at, channels: [{ channelId, count }] }`
 * once a minute, HMAC-signed with WVW_SECRETS.voiceWorkerSecret. Counts only
 * — no user ids ever leave the worker. Live runs whose voice link points at a
 * sampled channel accumulate peak/avg headcount.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { COL, WVW_SECRETS, db, secrets } from './config';
import { hmacHex, safeEqualHex } from './crypto';
import type { RunPrivate } from './metrics';

interface Payload {
  at: number;
  channels: { channelId: string; count: number }[];
}

export const voiceSamples = onRequest(
  { secrets: [WVW_SECRETS], memory: '256MiB', timeoutSeconds: 30 },
  async (req, res) => {
    const secret = secrets().voiceWorkerSecret;
    if (req.method !== 'POST' || !secret) {
      res.status(404).send('not found');
      return;
    }
    const sig = String(req.get('x-wvw-signature') ?? '');
    const raw = req.rawBody ?? Buffer.from('');
    if (!safeEqualHex(sig, hmacHex(raw, secret))) {
      res.status(401).send('bad signature');
      return;
    }
    let body: Payload;
    try {
      body = JSON.parse(raw.toString('utf8')) as Payload;
    } catch {
      res.status(400).send('bad json');
      return;
    }
    if (!Number.isFinite(body.at) || Math.abs(Date.now() - body.at) > 5 * 60_000 || !Array.isArray(body.channels)) {
      res.status(400).send('stale or malformed');
      return;
    }
    const counts = new Map<string, number>();
    for (const c of body.channels.slice(0, 500)) {
      if (typeof c.channelId === 'string' && /^\d{15,22}$/.test(c.channelId) && Number.isInteger(c.count) && c.count >= 0) {
        counts.set(c.channelId, Math.min(c.count, 999));
      }
    }

    const live = await db().collection(COL.runPrivate).where('status', '==', 'live').get();
    let touched = 0;
    for (const d of live.docs) {
      const priv = d.data() as RunPrivate;
      if (!priv.voiceChannelId || !counts.has(priv.voiceChannelId)) continue;
      const n = counts.get(priv.voiceChannelId)!;
      await db().runTransaction(async (tx) => {
        const cur = ((await tx.get(d.ref)).get('voice') ?? { samples: 0, sum: 0, peak: 0 }) as NonNullable<RunPrivate['voice']>;
        tx.set(d.ref, { voice: { samples: cur.samples + 1, sum: cur.sum + n, peak: Math.max(cur.peak, n) } }, { merge: true });
        tx.set(db().collection(COL.runs).doc(d.id), { voiceNow: n }, { merge: true });
      });
      touched++;
    }
    if (touched) {
      const { rebuildLiveIndex } = await import('./indexes');
      await rebuildLiveIndex();
    }
    res.status(200).json({ ok: true, runs: touched });
  },
);
