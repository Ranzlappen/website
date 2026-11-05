/**
 * Phase 1 — guild pages.
 *
 * No claims, no invite codes: the GW2 API tells us who leads a guild
 * (`/v2/account` → `guild_leader`). Any verified member of a guild can post
 * raids for it; raids by the guild's leader carry the ✓ official badge. The
 * leader can edit the guild's public profile (description, playstyles,
 * languages, recruiting, links). Recruiting requires a contact GW2 account
 * name — the one account name the leader deliberately makes public.
 * Hub admins can edit (or clear) every profile field of any guild page —
 * that doesn't make the guild "leader verified".
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COL, db } from './config';
import { isGuildId } from './gw2';
import { ACCOUNT_NAME_RE, LANGUAGES, LIMITS, PLAYSTYLES, type Language, type Playstyle } from './shared/constants';
import { isValidTimeZone } from './shared/time';
import type { GuildProfile } from './shared/types';
import { audit, callableOpts, cleanList, cleanText, cleanUrl, requireMember } from './util';
import { markDirty } from './state';

export const updateGuildProfile = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const d = (request.data ?? {}) as { guildId?: unknown; profile?: Record<string, unknown> };
  if (!isGuildId(d.guildId)) throw new HttpsError('invalid-argument', 'Unknown guild.');
  const guildId = d.guildId;
  const leader = member.verified && !member.stale && member.guilds.some((g) => g.id === guildId && g.leader);
  const asAdmin = !leader && member.role === 'admin';
  if (!leader && !asAdmin) {
    throw new HttpsError('permission-denied', 'Only the guild leader can edit the guild page (re-verify if you just became leader).');
  }
  if (asAdmin && !(await db().collection(COL.guildDir).doc(guildId).get()).exists) {
    throw new HttpsError('not-found', 'Guild not found.');
  }
  const p = d.profile ?? {};
  if (p.timezone != null && !isValidTimeZone(p.timezone)) throw new HttpsError('invalid-argument', 'Unknown time zone.');
  const recruiting = p.recruiting === true;
  const recruitContact = recruiting ? cleanText(p.recruitContact, 45, 'Recruitment contact') : '';
  if (recruiting && !ACCOUNT_NAME_RE.test(recruitContact)) {
    throw new HttpsError('invalid-argument', 'While recruiting, add a contact GW2 account name like Name.1234 so applicants know whom to whisper.');
  }
  const profile: GuildProfile = {
    description: cleanText(p.description, LIMITS.descriptionMax, 'Description'),
    languages: cleanList<Language>(p.languages, LANGUAGES, 'languages', 6),
    playstyles: cleanList<Playstyle>(p.playstyles, PLAYSTYLES, 'playstyles', 8),
    timezone: (p.timezone as string | null) ?? null,
    recruiting,
    recruitContact: recruiting ? recruitContact : null,

    discordInvite: cleanUrl(p.discordInvite, 'Discord invite', /(^|\.)discord(app)?\.(gg|com)$/),
    website: cleanUrl(p.website, 'Website'),
  };
  // An admin edit doesn't make the guild "leader verified".
  await db()
    .collection(COL.guildDir)
    .doc(guildId)
    .set({ profile, ...(leader ? { claimed: true } : {}), updatedAt: Date.now() }, { merge: true });
  await markDirty('guildIndex');
  await audit(member.uid, asAdmin ? 'admin.guildProfile' : 'guild.profile', { guildId });
  return { profile };
});
