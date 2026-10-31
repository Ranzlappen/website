/**
 * Phase 1 — guild pages.
 *
 * No claims, no invite codes: the GW2 API tells us who leads a guild
 * (`/v2/account` → `guild_leader`). Any verified member of a guild can post
 * raids for it; raids by the guild's leader carry the ✓ official badge. The
 * leader can edit the guild's public profile (description, playstyles,
 * languages, recruiting, links).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COL, db } from './config';
import { isGuildId } from './gw2';
import { LANGUAGES, LIMITS, PLAYSTYLES, type Language, type Playstyle } from './shared/constants';
import { isValidTimeZone } from './shared/time';
import type { GuildProfile } from './shared/types';
import { audit, callableOpts, cleanList, cleanText, cleanUrl, requireVerified } from './util';
import { markDirty } from './state';

export const updateGuildProfile = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const d = (request.data ?? {}) as { guildId?: unknown; profile?: Record<string, unknown> };
  if (!isGuildId(d.guildId)) throw new HttpsError('invalid-argument', 'Unknown guild.');
  const guildId = d.guildId;
  if (!member.guilds.some((g) => g.id === guildId && g.leader)) {
    throw new HttpsError('permission-denied', 'Only the guild leader can edit the guild page (re-verify if you just became leader).');
  }
  const p = d.profile ?? {};
  if (p.timezone != null && !isValidTimeZone(p.timezone)) throw new HttpsError('invalid-argument', 'Unknown time zone.');
  const profile: GuildProfile = {
    description: cleanText(p.description, LIMITS.descriptionMax, 'Description'),
    languages: cleanList<Language>(p.languages, LANGUAGES, 'languages', 6),
    playstyles: cleanList<Playstyle>(p.playstyles, PLAYSTYLES, 'playstyles', 8),
    timezone: (p.timezone as string | null) ?? null,
    recruiting: p.recruiting === true,
    discordInvite: cleanUrl(p.discordInvite, 'Discord invite', /(^|\.)discord(app)?\.(gg|com)$/),
    website: cleanUrl(p.website, 'Website'),
  };
  await db().collection(COL.guildDir).doc(guildId).set({ profile, claimed: true, updatedAt: Date.now() }, { merge: true });
  await markDirty('guildIndex');
  await audit(member.uid, 'guild.profile', { guildId });
  return { profile };
});
