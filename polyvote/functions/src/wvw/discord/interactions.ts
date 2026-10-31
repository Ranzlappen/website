/**
 * Phase 2 — Discord interactions endpoint (HTTP, no gateway).
 *
 * Discord requires an answer within 3 s, and a Cloud Functions cold start can
 * exceed that, so the endpoint only (a) verifies the Ed25519 signature,
 * (b) answers PING + autocomplete inline, and (c) for commands/buttons writes
 * a job doc and returns a *deferred* ephemeral reply. The `discordJobs`
 * Firestore trigger then does the real work (same core functions as the
 * website callables) and edits the deferred reply through the interaction
 * webhook (valid 15 min). No CPU-after-response tricks, no min instances.
 */
import { onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { COL, WVW_SECRETS, db, getSettings, requireSecret, siteLink, type Settings } from '../config';
import { verifyDiscordSignature } from '../crypto';
import { COMMON_TIMEZONES, EVENT_TYPES, LANGUAGES, MAPS, labelOf } from '../shared/constants';
import { teamName } from '../shared/teams';
import { isValidTimeZone, nextOccurrence, parseDate, civilToDays, weekdayOfDays } from '../shared/time';
import type { MemberDoc, PublicEvent, PublicMatches } from '../shared/types';
import { COLORS as SIDE } from '../shared/types';
import { effectiveRole, uidForDiscord } from '../util';
import { cancelEventCore, createEventCore, detailsFor, validateEventInput } from '../events';
import { checkInCore, endRunCore, startRunCore } from '../runs';
import { rebuildLiveIndex, type EventDoc } from '../indexes';
import { DISCORD_API, COLORS, ts, type Embed } from './api';
import { flattenOptions, parseDays, parseLanguages, parseLogLinks, type InteractionOption } from './commands';

const JOBS = 'wvwDiscordJobs';
const EPHEMERAL = 64;

interface Interaction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  data?: { name?: string; options?: InteractionOption[]; custom_id?: string };
  member?: { user?: { id: string } };
  user?: { id: string };
  guild_id?: string;
}

interface Reply {
  content?: string;
  embeds?: Embed[];
  components?: unknown[];
}

function userId(i: Interaction): string | null {
  return i.member?.user?.id ?? i.user?.id ?? null;
}

async function loadMember(discordId: string): Promise<MemberDoc | null> {
  const snap = await db().collection(COL.members).doc(uidForDiscord(discordId)).get();
  if (!snap.exists) return null;
  const m = snap.data() as MemberDoc;
  return { ...m, role: effectiveRole(m) };
}

// ── Autocomplete (inline, must be fast) ─────────────────────────────────

async function autocomplete(i: Interaction): Promise<{ name: string; value: string }[]> {
  const { focused, opts } = flattenOptions(i.data?.options);
  const typed = String(opts[focused ?? ''] ?? '').toLowerCase();
  const uid = userId(i);
  if (!uid || !focused) return [];
  if (focused === 'timezone') {
    const m = await loadMember(uid);
    const list = [...new Set([m?.prefs?.timezone, ...COMMON_TIMEZONES].filter((x): x is string => !!x))];
    if (typed && isValidTimeZone(opts.timezone) && !list.includes(String(opts.timezone))) list.unshift(String(opts.timezone));
    return list.filter((z) => z.toLowerCase().includes(typed)).slice(0, 25).map((z) => ({ name: z, value: z }));
  }
  const m = await loadMember(uid);
  if (!m) return [];
  if (focused === 'guild') {
    return m.guilds
      .filter((g) => `${g.tag} ${g.name}`.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((g) => ({ name: `[${g.tag}] ${g.name}`.slice(0, 100), value: g.id }));
  }
  if (focused === 'event') {
    const snap = await db()
      .collection(COL.events)
      .where('commanderUid', '==', m.uid)
      .where('archived', '==', false)
      .get();
    return snap.docs
      .map((d) => d.data() as EventDoc)
      .filter((e) => e.status === 'scheduled' && `${e.title} ${e.guildTag}`.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((e) => ({ name: `[${e.guildTag}] ${e.title}`.slice(0, 100), value: e.id }));
  }
  return [];
}

// ── Endpoint ─────────────────────────────────────────────────────────────

export const discordInteractions = onRequest(
  { secrets: [WVW_SECRETS], memory: '256MiB', timeoutSeconds: 10, concurrency: 40 },
  async (req, res) => {
    const raw = req.rawBody ?? Buffer.from('');
    let publicKey: string;
    try {
      publicKey = requireSecret('discordPublicKey');
    } catch {
      res.status(503).send('not configured');
      return;
    }
    const ok = verifyDiscordSignature(
      raw,
      req.get('x-signature-ed25519') ?? undefined,
      req.get('x-signature-timestamp') ?? undefined,
      publicKey,
    );
    if (!ok) {
      res.status(401).send('invalid request signature');
      return;
    }
    const i = JSON.parse(raw.toString('utf8')) as Interaction;
    if (i.type === 1) {
      res.json({ type: 1 });
      return;
    }
    if (i.type === 4) {
      const choices = await autocomplete(i).catch(() => []);
      res.json({ type: 8, data: { choices } });
      return;
    }
    if (i.type === 2 || i.type === 3) {
      await db()
        .collection(JOBS)
        .doc(i.id)
        .set({
          id: i.id,
          applicationId: i.application_id,
          token: i.token,
          type: i.type,
          data: JSON.parse(JSON.stringify(i.data ?? {})),
          userId: userId(i),
          guildId: i.guild_id ?? null,
          at: Date.now(),
        });
      res.json({ type: 5, data: { flags: EPHEMERAL } });
      return;
    }
    res.status(400).send('unsupported');
  },
);

// ── Job processor ────────────────────────────────────────────────────────

interface Job {
  id: string;
  applicationId: string;
  token: string;
  type: number;
  data: Interaction['data'];
  userId: string | null;
}

async function editReply(job: Job, reply: Reply): Promise<void> {
  const res = await fetch(`${DISCORD_API}/webhooks/${job.applicationId}/${job.token}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...reply, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) logger.warn('wvw interaction edit failed', { status: res.status, body: await res.text() });
}

const notSignedIn = (s: Settings): Reply => ({
  content: `You haven't linked this Discord account yet. Sign in at ${siteLink(s, 'account')} and verify your GW2 account (takes a minute).`,
});

function needVerified(m: MemberDoc | null, s: Settings): Reply | null {
  if (!m) return notSignedIn(s);
  if (m.status === 'suspended') return { content: 'Your WvW Hub account is suspended.' };
  if (!m.verified || m.teamId == null) return { content: `Verify your GW2 account first: ${siteLink(s, 'account')}` };
  if (m.stale) return { content: `A relink happened — re-verify so we know your new team: ${siteLink(s, 'account')}` };
  return null;
}

function eventLine(e: PublicEvent, s: Settings): string {
  const next = nextOccurrence(e.schedule, Date.now());
  const when = next ? `${ts(next.start, 'f')} (${ts(next.start, 'R')})` : '—';
  return `**[${e.guildTag}] ${e.title}** · ${labelOf(EVENT_TYPES, e.type)} · ${teamName(e.teamId, s.teamNames)}\n${when}${e.liveRunId ? ' · 🟢 live' : ''}`;
}

async function runCommand(job: Job, m: MemberDoc | null, s: Settings): Promise<Reply> {
  const name = job.data?.name;
  const { sub, opts } = flattenOptions(job.data?.options);
  const str = (k: string) => (opts[k] === undefined ? undefined : String(opts[k]));
  const num = (k: string) => (opts[k] === undefined ? null : Number(opts[k]));

  if (name === 'wvw') {
    if (sub === 'verify') {
      return {
        embeds: [
          {
            title: 'Verify your GW2 account',
            color: COLORS.gold,
            description: [
              `1. Sign in with Discord at ${siteLink(s, 'account')}`,
              '2. Create an API key at https://account.arena.net/applications with **account**, **guilds** and **wvw** permissions, and put your personal code (shown on the page) in the key name.',
              '3. Paste the key on the page. Done — your hub roles update automatically, also after every relink.',
              '',
              '🔒 Never paste an API key into Discord.',
            ].join('\n'),
          },
        ],
      };
    }
    if (sub === 'relink') {
      const pub = (await db().collection(COL.public).doc('matches').get()).data() as PublicMatches | undefined;
      const fmt = (iso: string | null | undefined) => (iso ? `${ts(Date.parse(iso))} (${ts(Date.parse(iso), 'R')})` : '—');
      return {
        embeds: [
          {
            title: 'Relink & reset',
            color: COLORS.blue,
            fields: [
              { name: 'EU team assignment', value: fmt(pub?.timers.teamAssignment.eu), inline: false },
              { name: 'NA team assignment', value: fmt(pub?.timers.teamAssignment.na), inline: false },
              { name: 'EU guild lockout', value: fmt(pub?.timers.lockout.eu), inline: true },
              { name: 'NA guild lockout', value: fmt(pub?.timers.lockout.na), inline: true },
            ],
          },
        ],
      };
    }
    if (!m) return notSignedIn(s);
    if (sub === 'me') {
      return {
        embeds: [
          {
            title: 'Your WvW Hub status',
            color: m.verified && !m.stale ? COLORS.green : COLORS.grey,
            fields: [
              { name: 'Verified', value: m.verified ? (m.stale ? '⚠️ needs re-verify (relink)' : '✅') : '❌', inline: true },
              { name: 'Commander tag', value: m.commander ? '✅' : '—', inline: true },
              { name: 'Team', value: m.teamId ? `${teamName(m.teamId, s.teamNames)} (${m.region?.toUpperCase()})` : '—', inline: true },
              { name: 'Guilds', value: m.guilds.map((g) => `[${g.tag}]${g.leader ? ' 👑' : g.appointed ? ' ⭐' : ''}`).join(' ') || '—' },
            ],
            footer: { text: '👑 leader · ⭐ appointed commander' },
          },
        ],
      };
    }
    if (sub === 'matchup') {
      const bad = needVerified(m, s);
      if (bad) return bad;
      const pub = (await db().collection(COL.public).doc('matches').get()).data() as PublicMatches | undefined;
      const match = pub?.matches.find((x) => SIDE.some((c) => x.sides[c].teamId === m.teamId));
      if (!match) return { content: 'No current matchup found for your team.' };
      return {
        embeds: [
          {
            title: `Matchup ${match.id} · ends ${new Date(match.end).toUTCString().slice(0, 22)}`,
            url: siteLink(s, 'matchups'),
            color: COLORS.gold,
            fields: SIDE.map((c) => {
              const side = match.sides[c];
              const kd = side.deaths ? (side.kills / side.deaths).toFixed(2) : '—';
              return {
                name: `${c === 'red' ? '🔴' : c === 'blue' ? '🔵' : '🟢'} ${teamName(side.teamId, s.teamNames)}${side.teamId === m.teamId ? ' (you)' : ''}`,
                value: `VP **${side.victoryPoints}** · score ${side.score}\nK/D ${kd} · ${side.claimingGuilds} claiming guilds`,
                inline: true,
              };
            }),
          },
        ],
      };
    }
  }

  if (name === 'raid') {
    if (sub === 'list') {
      const region = (str('region') as 'eu' | 'na' | undefined) ?? m?.region ?? 'eu';
      const idx = await db().collection(COL.public).doc(`events_${region}`).get();
      let events = ((idx.data()?.events ?? []) as PublicEvent[]).filter((e) => e.status === 'scheduled');
      if (!str('region') && m?.teamId) events = events.filter((e) => e.teamId === m.teamId);
      if (opts.mine && m) {
        const mine = await db().collection(COL.events).where('commanderUid', '==', m.uid).where('archived', '==', false).get();
        const ids = new Set(mine.docs.map((d) => d.id));
        events = events.filter((e) => ids.has(e.id));
      }
      const now = Date.now();
      events.sort((a, b) => (nextOccurrence(a.schedule, now)?.start ?? Infinity) - (nextOccurrence(b.schedule, now)?.start ?? Infinity));
      return {
        embeds: [
          {
            title: `Upcoming raids — ${!str('region') && m?.teamId ? teamName(m.teamId, s.teamNames) : region.toUpperCase()}`,
            url: siteLink(s, 'calendar'),
            color: COLORS.gold,
            description: events.slice(0, 10).map((e) => eventLine(e, s)).join('\n\n') || 'Nothing scheduled yet.',
          },
        ],
      };
    }
    const bad = needVerified(m, s);
    if (bad) return bad;
    const member = m!;

    if (sub === 'schedule') {
      const date = str('date') ?? '';
      const parsed = parseDate(date);
      const tz = str('timezone') ?? member.prefs?.timezone ?? 'UTC';
      const repeat = str('repeat') === 'weekly' ? 'weekly' : 'none';
      let days = parseDays(str('days'));
      if (repeat === 'weekly' && !days.length && parsed) days = [weekdayOfDays(civilToDays(parsed.y, parsed.m, parsed.d))];
      const languages = parseLanguages(str('languages')).filter((l) => LANGUAGES.some((x) => x.id === l));
      const voiceUrl = str('voice');
      const input = validateEventInput({
        guildId: str('guild'),
        title: str('title'),
        type: str('type'),
        openness: str('openness') ?? 'open',
        languages: languages.length ? languages : ['en'],
        schedule: { tz, date, time: str('time'), durationMin: num('duration') ?? 120, repeat, days, until: null },
        map: str('map') ?? 'any',
        goals: str('goals') ?? '',
        expectedSize: num('expected'),
        voice: voiceUrl ? { kind: /discord/i.test(voiceUrl) ? 'discord' : /ts3|teamspeak/i.test(voiceUrl) ? 'teamspeak' : 'other', url: voiceUrl } : null,
        buildsUrl: null,
        notes: '',
      });
      const e = await createEventCore(member, input);
      return {
        content: `✅ Scheduled and announced. Edit it any time: ${siteLink(s, `events/${e.id}`)}`,
        embeds: [{ description: eventLine(e, s), color: COLORS.gold }],
      };
    }
    if (sub === 'cancel') {
      await cancelEventCore(member, str('event') ?? '');
      return { content: '🗑️ Raid cancelled — the announcement was updated.' };
    }
    if (sub === 'live') {
      const run = await startRunCore(member, {
        eventId: str('event') ?? null,
        guildId: str('guild') ?? null,
        type: str('type') ?? null,
        map: str('map') ?? null,
        voiceUrl: str('voice') ?? null,
      });
      return { content: `🟢 You're live with [${run.guildTag}]. End with \`/raid end\` (add dps.report links for real squad stats). ${siteLink(s, `runs/${run.id}`)}` };
    }
    if (sub === 'end') {
      const run = await endRunCore(member, { peak: num('peak'), logs: parseLogLinks(str('log')) });
      const mt = run.metrics;
      return {
        content: `⚪ Run ended after ${mt?.durationMin ?? '?'} min.${mt?.peak ? ` Peak ${mt.peak} (${mt.peakSource}).` : ''} Attendees can rate it for 72h: ${siteLink(s, `runs/${run.id}`)}`,
      };
    }
  }
  return { content: 'Unknown command.' };
}

async function runComponent(job: Job, m: MemberDoc | null, s: Settings): Promise<Reply> {
  const [kind, id] = String(job.data?.custom_id ?? '').split(':');
  if (kind === 'details') {
    if (!m) return notSignedIn(s);
    const [d] = await detailsFor(m, [id]);
    if (!d) {
      return { content: `🔒 Map, voice and goals are only shown to verified members of this raid's team. ${m.verified ? '' : `Verify: ${siteLink(s, 'account')}`}` };
    }
    return {
      embeds: [
        {
          title: '🔒 Raid details (team only — please do not share)',
          color: COLORS.gold,
          fields: [
            { name: 'Map', value: labelOf(MAPS, d.map), inline: true },
            { name: 'Expected', value: d.expectedSize ? String(d.expectedSize) : '—', inline: true },
            { name: 'Voice', value: d.voice ? d.voice.url : '—', inline: false },
            ...(d.goals ? [{ name: 'Goals', value: d.goals.slice(0, 1000) }] : []),
            ...(d.buildsUrl ? [{ name: 'Builds', value: d.buildsUrl }] : []),
            ...(d.notes ? [{ name: 'Notes', value: d.notes.slice(0, 1000) }] : []),
          ],
          footer: { text: d.voice?.url.includes('discord.gg/') ? 'Your voice invite is single-use and expires in 1 hour.' : 'WvW Hub' },
        },
      ],
    };
  }
  if (kind === 'checkin') {
    const bad = needVerified(m, s);
    if (bad) return bad;
    const r = await checkInCore(m!, id);
    if (!r.already) await rebuildLiveIndex();
    return { content: r.already ? 'You are already checked in ✋' : `Checked in ✋ — you can rate this raid after it ends: ${siteLink(s, `runs/${id}`)}` };
  }
  return { content: 'Unknown button.' };
}

export const discordJobs = onDocumentCreated(
  { document: `${JOBS}/{jobId}`, secrets: [WVW_SECRETS], memory: '512MiB', timeoutSeconds: 180, retry: false },
  async (event) => {
    const job = event.data?.data() as Job | undefined;
    if (!job) return;
    const s = await getSettings();
    let reply: Reply;
    try {
      const m = job.userId ? await loadMember(job.userId) : null;
      reply = job.type === 3 ? await runComponent(job, m, s) : await runCommand(job, m, s);
    } catch (e) {
      if (e instanceof HttpsError) {
        reply = { content: `⚠️ ${e.message}` };
      } else {
        logger.error('wvw interaction failed', { error: String(e), stack: (e as Error)?.stack });
        reply = { content: '⚠️ Something went wrong — please try again or use the website.' };
      }
    }
    await editReply(job, reply);
    await event.data?.ref.delete().catch(() => {});
  },
);

