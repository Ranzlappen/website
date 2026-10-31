/**
 * Seed pipeline — admin CSV import of raids (`wvw-adminImportEvents`).
 *
 * The calendar is only useful once it has raids in it. Before commanders
 * post their own, admins can list raids that guilds already announce publicly
 * (community commander sheets, guild Discord / forum / Reddit posts) from a
 * spreadsheet: export it as CSV (Google Sheets → File → Download → CSV, or
 * copy-paste the cells — tab-separated works too) and paste it into
 * Moderation → Import. Columns: see `shared/csv.ts` (IMPORT_COLUMNS) and
 * wvw/README.md → "Seeding raids".
 *
 *   - `dryRun: true` returns a per-row preview (guild resolved, team, map,
 *     schedule, errors) without writing anything.
 *   - Re-importing the same sheet UPDATES the raids it created (matched by
 *     guild + title + schedule time/days) instead of duplicating them, so the
 *     sheet can stay the source of truth until the guilds post themselves.
 *
 * Seeded raids are marked `seeded: true` (shown as "listed by moderators",
 * never ✓ official), owned by the admin session, and follow their guild's WvW
 * team automatically (`retargetSeededEvents`, from /v2/wvw/guilds/{region}).
 * Any verified member of the guild may edit one — it then becomes theirs.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { COL, db } from './config';
import { AUDIENCES, EVENT_TYPES, LANGUAGES, OPENNESS, isOneOf, type Language, type MapId } from './shared/constants';
import { csvToObjects } from './shared/csv';
import { isTeamId, regionOfTeam, type Region } from './shared/teams';
import { describeSchedule, isValidTimeZone, localParts, type Schedule } from './shared/time';
import type { EventInput, ImportRowResult } from './shared/types';
import { gw2Get, guildPublic, isGuildId } from './gw2';
import { rebuildEventIndex, type EventDoc } from './indexes';
import { validateEventInput } from './events';
import { audit, callableOpts, requireRole, ADMIN_UID } from './util';

const MAX_ROWS = 300;
const MAX_BYTES = 256 * 1024;
const MAX_API_LOOKUPS = 60;

const DAY_ALIASES: Record<string, number> = {
  sun: 0, sunday: 0, so: 0, sonntag: 0,
  mon: 1, monday: 1, mo: 1, montag: 1,
  tue: 2, tues: 2, tuesday: 2, di: 2, dienstag: 2,
  wed: 3, wednesday: 3, mi: 3, mittwoch: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, do: 4, donnerstag: 4,
  fri: 5, friday: 5, fr: 5, freitag: 5,
  sat: 6, saturday: 6, sa: 6, samstag: 6,
};

const MAP_ALIASES: Record<string, MapId> = {
  ebg: 'ebg', eb: 'ebg', 'eternal battlegrounds': 'ebg', center: 'ebg', ews: 'ebg', 'ewige schlachtfelder': 'ebg',
  red: 'red', 'red bl': 'red', 'red borderlands': 'red', redhome: 'red', desert: 'red', 'desert bl': 'red', rot: 'red',
  blue: 'blue', 'blue bl': 'blue', 'blue borderlands': 'blue', bluehome: 'blue', blau: 'blue',
  green: 'green', 'green bl': 'green', 'green borderlands': 'green', greenhome: 'green', 'grün': 'green', gruen: 'green',
  jumper: 'jumper', 'cross-map': 'jumper', crossmap: 'jumper', 'all maps': 'jumper', any: 'jumper',
};

function lc(v: string | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

function splitList(v: string | undefined): string[] {
  return lc(v)
    .split(/[\s,;/|+]+/)
    .filter(Boolean);
}

/** "2026-11-15" | "15.11.2026" | "15/11/2026" → "YYYY-MM-DD" (null when unparseable). */
export function normaliseDate(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** "20:30" | "8:30 pm" | "20.30" | "2030" → "HH:MM". */
export function normaliseTime(v: string | undefined): string | null {
  const s = lc(v).replace(/\s+/g, '');
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? '0');
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** "120" | "2h" | "1h30" | "1:30" | "90m" → minutes. */
export function normaliseDuration(v: string | undefined): number | null {
  const s = lc(v).replace(/\s+/g, '');
  if (!s) return 120;
  let m = /^(\d+)m?(?:in)?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d+)(?:h|:)(\d{1,2})?m?$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? '0');
  return null;
}

function pickOption<T extends { id: string; label: string }>(list: readonly T[], v: string | undefined): T['id'] | null {
  const s = lc(v);
  if (!s) return null;
  return (list.find((o) => o.id === s || o.label.toLowerCase() === s || o.label.toLowerCase().split(/[\s/—-]+/)[0] === s)?.id ?? null) as
    | T['id']
    | null;
}

export interface ParsedRow {
  /** GUID or exact guild name. */
  guildRef: string;
  team: number | null;
  /** Everything of EventInput except the guild (resolved later). */
  input: Omit<EventInput, 'guildId'>;
}

/**
 * Pure: one CSV row → event fields (throws Error with a readable message).
 * Weekly when `days` is set (starting `date`, default today in the row's zone);
 * one-off when only `date` is set.
 */
export function parseImportRow(raw: Record<string, string>, now = Date.now()): ParsedRow {
  const guildRef = (raw.guild ?? '').trim();
  if (!guildRef) throw new Error('Missing guild (name or GUID).');
  const tz = (raw.timezone ?? raw.tz ?? '').trim() || 'UTC';
  if (!isValidTimeZone(tz)) throw new Error(`Unknown time zone "${tz}" — use an IANA zone like Europe/Berlin.`);
  const time = normaliseTime(raw.time);
  if (!time) throw new Error(`Can't read time "${raw.time ?? ''}" — use HH:MM.`);
  const durationMin = normaliseDuration(raw.duration);
  if (durationMin == null) throw new Error(`Can't read duration "${raw.duration}" — minutes, or e.g. 2h / 1h30.`);

  const dayTokens = splitList(raw.days);
  const days = [...new Set(dayTokens.map((d) => DAY_ALIASES[d]))];
  if (days.some((d) => d === undefined)) throw new Error(`Unknown day in "${raw.days}" — use mon, tue, … (or Mo, Di, …).`);
  const dateRaw = (raw.date ?? '').trim();
  let date = normaliseDate(dateRaw);
  if (dateRaw && !date) throw new Error(`Can't read date "${dateRaw}" — use YYYY-MM-DD or DD.MM.YYYY.`);
  if (!days.length && !date) throw new Error('Give either days (weekly) or a date (one-off).');
  if (!date) {
    const p = localParts(now, tz);
    date = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  }
  let schedule: Schedule;
  if (days.length) {
    schedule = { tz, date, time, durationMin, repeat: 'weekly', days: (days as number[]).sort(), until: normaliseDate(raw.until) };
  } else {
    schedule = { tz, date, time, durationMin, repeat: 'none' };
  }

  const type = raw.type ? pickOption(EVENT_TYPES, raw.type) : 'zerg';
  if (!type) throw new Error(`Unknown type "${raw.type}" — one of ${EVENT_TYPES.map((t) => t.id).join(', ')}.`);
  const map: MapId | null = raw.map ? MAP_ALIASES[lc(raw.map)] ?? null : 'jumper';
  if (!map) throw new Error(`Unknown map "${raw.map}" — ebg, red, blue, green or jumper.`);
  const audience = raw.audience ? pickOption(AUDIENCES, raw.audience) ?? (lc(raw.audience).startsWith('team') ? 'team' : null) : 'everyone';
  if (!audience) throw new Error(`Unknown audience "${raw.audience}" — everyone or team.`);
  const openness = raw.openness ? pickOption(OPENNESS, raw.openness) : 'open';
  if (!openness) throw new Error(`Unknown openness "${raw.openness}" — open, guild or invite.`);
  const langs = splitList(raw.languages || 'en');
  const bad = langs.filter((l) => !isOneOf(LANGUAGES, l));
  if (bad.length) throw new Error(`Unknown language ${bad.join(', ')} — use ${LANGUAGES.map((l) => l.id).join(', ')}.`);
  const team = raw.team ? Number(raw.team) : null;
  if (raw.team && !isTeamId(team)) throw new Error(`"${raw.team}" is not a team id (11xxx NA / 12xxx EU).`);
  const title = (raw.title ?? '').trim() || EVENT_TYPES.find((t) => t.id === type)!.label;

  return {
    guildRef,
    team,
    input: {
      title,
      type,
      audience,
      openness,
      languages: [...new Set(langs)].slice(0, 4) as Language[],
      schedule,
      map,
      goals: (raw.goals ?? '').trim(),
      expectedSize: null,
      voice: null,
      buildsUrl: null,
      notes: (raw.notes ?? '').trim(),
    },
  };
}

/** Stable identity of an imported raid — re-importing the sheet updates instead of duplicating. */
export function importKey(guildId: string, input: Pick<EventInput, 'title' | 'schedule'>): string {
  const s = input.schedule;
  const when = s.repeat === 'weekly' ? `w${(s.days ?? []).join('')}` : s.date;
  return `${guildId}|${input.title.trim().toLowerCase()}|${when}|${s.time}`;
}

interface GuildHit {
  id: string;
  tag: string;
  name: string;
  teamId: number | null;
}

async function resolveGuilds(refs: string[], budget: { left: number }): Promise<Map<string, GuildHit | string>> {
  const out = new Map<string, GuildHit | string>();
  const unique = [...new Set(refs)];
  const dir = db().collection(COL.guildDir);
  for (const ref of unique) {
    try {
      let id: string | null = isGuildId(ref) ? ref.toUpperCase() : null;
      let hit: GuildHit | null = null;
      if (!id) {
        const q = await dir.where('name', '==', ref).limit(1).get();
        if (!q.empty) {
          const d = q.docs[0].data();
          hit = { id: d.id, tag: d.tag, name: d.name, teamId: d.teamId ?? null };
        } else if (budget.left-- > 0) {
          const ids = await gw2Get<string[]>('/guild/search', { query: { name: ref } });
          id = ids[0] ?? null;
          if (!id) {
            out.set(ref, `No guild named "${ref}" (names are case-sensitive in the GW2 API).`);
            continue;
          }
        } else {
          out.set(ref, 'Too many new guilds in one import — import the rest in a second run.');
          continue;
        }
      }
      if (!hit && id) {
        const d = await dir.doc(id).get();
        if (d.exists && d.get('name')) hit = { id, tag: d.get('tag'), name: d.get('name'), teamId: d.get('teamId') ?? null };
        else if (budget.left-- > 0) {
          const g = await guildPublic(id);
          hit = { id, tag: g.tag, name: g.name, teamId: null };
        } else {
          out.set(ref, 'Too many new guilds in one import — import the rest in a second run.');
          continue;
        }
      }
      out.set(ref, hit!);
    } catch (e) {
      out.set(ref, `Guild lookup failed: ${String((e as Error).message ?? e)}`);
    }
  }
  return out;
}

async function guildTeamMaps(): Promise<Record<string, number>> {
  const [na, eu] = await Promise.all([
    db().collection(COL.state).doc('guildMap_na').get(),
    db().collection(COL.state).doc('guildMap_eu').get(),
  ]);
  return { ...((na.get('map') as Record<string, number>) ?? {}), ...((eu.get('map') as Record<string, number>) ?? {}) };
}

export const adminImportEvents = onCall({ ...callableOpts, timeoutSeconds: 120 }, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { csv?: unknown; dryRun?: unknown };
  const csv = typeof d.csv === 'string' ? d.csv : '';
  const dryRun = d.dryRun !== false;
  if (!csv.trim()) throw new HttpsError('invalid-argument', 'Paste a CSV first.');
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) throw new HttpsError('invalid-argument', 'CSV too large (max 256 KB).');
  const rawRows = csvToObjects(csv);
  if (!rawRows.length) throw new HttpsError('invalid-argument', 'No rows found — the first line must be the header.');
  if (!('guild' in rawRows[0]) || !('time' in rawRows[0])) {
    throw new HttpsError('invalid-argument', 'The header needs at least the columns "guild" and "time" (see the template).');
  }
  if (rawRows.length > MAX_ROWS) throw new HttpsError('invalid-argument', `At most ${MAX_ROWS} rows per import.`);

  const now = Date.now();
  const parsed = rawRows.map((raw, i) => {
    try {
      return { line: i + 2, row: parseImportRow(raw, now), error: null as string | null, raw };
    } catch (e) {
      return { line: i + 2, row: null, error: (e as Error).message, raw };
    }
  });
  const guilds = await resolveGuilds(
    parsed.filter((p) => p.row).map((p) => p.row!.guildRef),
    { left: MAX_API_LOOKUPS },
  );
  const teamMap = await guildTeamMaps();
  const existingSnap = await db().collection(COL.events).where('seeded', '==', true).where('archived', '==', false).get();
  const existing = new Map(existingSnap.docs.map((s) => [s.get('importKey') as string, s.data() as EventDoc & { importKey: string }]));

  const results: ImportRowResult[] = [];
  const writes: { doc: EventDoc & { importKey: string }; isNew: boolean }[] = [];
  const seenKeys = new Set<string>();
  for (const p of parsed) {
    const base: ImportRowResult = {
      line: p.line,
      status: 'error',
      error: p.error,
      guildTag: null,
      guildName: null,
      teamId: null,
      title: p.row?.input.title ?? (p.raw.title ?? ''),
      type: p.row?.input.type ?? null,
      map: p.row?.input.map ?? null,
      when: p.row ? describeSchedule(p.row.input.schedule) : '',
      audience: p.row?.input.audience ?? null,
    };
    if (!p.row) {
      results.push(base);
      continue;
    }
    const g = guilds.get(p.row.guildRef);
    if (!g || typeof g === 'string') {
      results.push({ ...base, error: (g as string) ?? 'Guild not found.' });
      continue;
    }
    base.guildTag = g.tag;
    base.guildName = g.name;
    const teamId = p.row.team ?? teamMap[g.id] ?? teamMap[g.id.toLowerCase()] ?? g.teamId ?? null;
    base.teamId = teamId;
    if (!teamId || !isTeamId(teamId)) {
      results.push({ ...base, error: 'Can’t tell this guild’s WvW team (it hasn’t selected one in-game) — add a "team" column.' });
      continue;
    }
    let input: EventInput;
    try {
      input = validateEventInput({ ...p.row.input, guildId: g.id }, now);
    } catch (e) {
      results.push({ ...base, error: (e as Error).message });
      continue;
    }
    const key = importKey(g.id, input);
    if (seenKeys.has(key)) {
      results.push({ ...base, error: 'Duplicate of an earlier row (same guild, title, days and time).' });
      continue;
    }
    seenKeys.add(key);
    const prev = existing.get(key);
    const region = regionOfTeam(teamId) as Region;
    const ref = prev ? db().collection(COL.events).doc(prev.id) : db().collection(COL.events).doc();
    writes.push({
      isNew: !prev,
      doc: {
        ...(prev ?? {}),
        id: ref.id,
        guildId: g.id,
        guildTag: g.tag,
        guildName: g.name,
        official: false,
        region,
        teamId,
        title: input.title,
        type: input.type,
        map: input.map,
        audience: input.audience,
        openness: input.openness,
        languages: input.languages,
        schedule: input.schedule,
        status: prev?.status === 'suspended' ? 'suspended' : 'scheduled',
        liveRunId: prev?.liveRunId ?? null,
        seeded: true,
        importKey: key,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        commanderUid: ADMIN_UID,
        archived: false,
        visibility: prev?.visibility ?? 'public',
      },
    });
    results.push({ ...base, status: prev ? 'update' : 'create', error: null });
  }

  if (!dryRun && writes.length) {
    for (let i = 0; i < writes.length; i += 200) {
      const batch = db().batch();
      for (const w of writes.slice(i, i + 200)) {
        batch.set(db().collection(COL.events).doc(w.doc.id), w.doc);
        if (w.isNew) {
          batch.set(db().collection(COL.eventDetails).doc(w.doc.id), {
            eventId: w.doc.id,
            commanderUid: ADMIN_UID,
            goals: '',
            expectedSize: null,
            voice: null,
            buildsUrl: null,
            notes: '',
          });
        }
      }
      await batch.commit();
    }
    for (const r of new Set(writes.map((w) => w.doc.region))) await rebuildEventIndex(r);
    await audit(admin.uid, 'admin.import', {
      created: writes.filter((w) => w.isNew).length,
      updated: writes.filter((w) => !w.isNew).length,
      errors: results.filter((r) => r.status === 'error').length,
    });
  }

  return {
    dryRun,
    rows: results,
    created: results.filter((r) => r.status === 'create').length,
    updated: results.filter((r) => r.status === 'update').length,
    errors: results.filter((r) => r.status === 'error').length,
  };
});

/**
 * Seeded raids have no verified poster to re-check after a relink — they
 * follow their guild's team in the public guild→team map instead (refreshed
 * by the poller every 30 min, and right after a relink). Cheap: one query.
 */
export async function retargetSeededEvents(): Promise<number> {
  const [snap, teamMap] = await Promise.all([
    db().collection(COL.events).where('seeded', '==', true).where('archived', '==', false).get(),
    guildTeamMaps(),
  ]);
  if (snap.empty || !Object.keys(teamMap).length) return 0;
  const regions = new Set<Region>();
  const batch = db().batch();
  let moved = 0;
  for (const d of snap.docs) {
    const e = d.data() as EventDoc;
    const t = teamMap[e.guildId] ?? teamMap[e.guildId.toLowerCase()];
    if (!t || t === e.teamId) continue;
    const region = regionOfTeam(t) as Region;
    regions.add(e.region);
    regions.add(region);
    batch.update(d.ref, { teamId: t, region, updatedAt: Date.now() });
    moved++;
  }
  if (!moved) return 0;
  await batch.commit();
  for (const r of regions) await rebuildEventIndex(r).catch((err) => logger.warn('rebuild after seeded retarget', { r, err: String(err) }));
  return moved;
}
