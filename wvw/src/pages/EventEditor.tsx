import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChipToggle, ErrorBox, Notice, PageHeader, Segmented, Skeleton } from '../components/ui';
import { useDocumentTitle, useEventIndex, useMySides, useMyTeamIndex, useNow, useTeamNames } from '../lib/hooks';
import { MapPicker, mapLabel } from '../components/MapPicker';
import { SquadJoin, TagPicker } from '../components/CommanderTag';
import { useT } from '../i18n';
import { fmtRange } from '../lib/format';
import { call, errorMessage } from '../firebase';
import { isMod, isVerified, useStore } from '../store';
import {
  AUDIENCES,
  COMMON_TIMEZONES,
  EVENT_TYPES,
  LANGUAGES,
  LIMITS,
  OPENNESS,
  VOICE_KINDS,
  type Audience,
  type EventType,
  type Language,
  type MapId,
  type Openness,
  type VoiceKind,
} from '../shared/constants';
import { WEEKDAY_SHORT, civilToDays, localParts, occurrencesBetween, parseDate, validateSchedule, weekdayOfDays, type Schedule } from '../shared/time';
import type { AdminEventRow, EventDetails, EventInput, PublicEvent } from '../shared/types';

function todayIn(tz: string): string {
  const p = localParts(Date.now(), tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" date. */
function weekdayOfDate(date: string): number {
  const p = parseDate(date);
  return p ? weekdayOfDays(civilToDays(p.y, p.m, p.d)) : 1;
}

function blank(tz: string, guildId: string | null): EventInput {
  const date = todayIn(tz);
  return {
    guildId,
    title: '',
    type: 'zerg',
    audience: 'everyone',
    openness: 'open',
    languages: ['en'],
    // One-off by default; "Weekly" pre-selects the date's weekday.
    schedule: { tz, date, time: '20:00', durationMin: 120, repeat: 'none' },
    map: 'ebg',
    tag: { color: 'blue', shape: 'commander' },
    goals: '',
    expectedSize: null,
    voice: null,
    buildsUrl: null,
    notes: '',
    squadJoin: null,
  };
}

export default function EventEditor() {
  const t = useT();
  const { id } = useParams();
  const editing = !!id;
  useDocumentTitle(t(editing ? 'Edit raid' : 'Post a raid'));
  const navigate = useNavigate();
  const { member, memberReady, displayTz, toast } = useStore();
  const eu = useEventIndex('eu');
  const na = useEventIndex('na');
  const [form, setForm] = useState<EventInput | null>(null);
  const [voiceKind, setVoiceKind] = useState<VoiceKind>('discord');
  const [voiceUrl, setVoiceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** New raids: the title follows the raid type until the poster types their own. */
  const [titleTouched, setTitleTouched] = useState(false);
  const now = useNow(60_000);
  const { sides, myColor } = useMySides();
  const names = useTeamNames();

  const teamIdx = useMyTeamIndex();
  const mod = isMod(member);
  // Past or hidden raids are in no index — moderators load them directly.
  const [modLoaded, setModLoaded] = useState<{ event: AdminEventRow; details: EventDetails } | null>(null);
  const indexed: PublicEvent | null = useMemo(
    () =>
      id
        ? [...(eu.data?.events ?? []), ...(na.data?.events ?? []), ...(teamIdx?.events ?? [])].find((e) => e.id === id) ?? null
        : null,
    [eu.data, na.data, teamIdx, id],
  );
  const existing: PublicEvent | null = indexed ?? modLoaded?.event ?? null;
  const indexesLoaded = !eu.loading && !na.loading;

  useEffect(() => {
    if (!id || !mod || indexed || modLoaded || !indexesLoaded) return;
    call<{ event: AdminEventRow; details: EventDetails }>('modGetEvent', { eventId: id })
      .then(setModLoaded)
      .catch((e) => setError(errorMessage(e)));
  }, [id, mod, indexed, modLoaded, indexesLoaded]);

  useEffect(() => {
    if (!member || form) return;
    const tz = member.prefs?.timezone || displayTz;
    if (!editing) {
      // Pre-filled with the raid type as title (editable, follows the type until changed).
      setForm({ ...blank(tz, member.guilds[0]?.id ?? null), title: t(EVENT_TYPES[0].label) });
      return;
    }
    if (!existing) return;
    const detailsP = modLoaded
      ? Promise.resolve({ details: [modLoaded.details] })
      : call<{ details: EventDetails[] }>('getEventDetails', { eventIds: [existing.id] });
    detailsP
      .then(({ details }) => {
        const d = details[0];
        setForm({
          guildId: existing.guildId ?? null,
          title: existing.title,
          type: existing.type,
          audience: existing.audience ?? 'everyone',
          openness: existing.openness,
          languages: existing.languages,
          schedule: existing.schedule,
          map: existing.map ?? 'jumper',
          tag: existing.tag ?? null,
          goals: d?.goals ?? '',
          expectedSize: d?.expectedSize ?? null,
          voice: d?.voice ?? null,
          buildsUrl: d?.buildsUrl ?? null,
          notes: d?.notes ?? '',
          squadJoin: d?.squadJoin ?? null,
        });
        setTitleTouched(true);
        if (d?.voice) {
          setVoiceKind(d.voice.kind);
          setVoiceUrl(d.voice.url);
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [member, existing, editing, form, displayTz, modLoaded, t]);

  if (!memberReady) return <Skeleton h={400} />;
  // Moderators (incl. the admin session, which has no team) may edit any raid, also past ones.
  if (!isVerified(member) && !(editing && mod)) {
    return (
      <Notice tone="warn">
        {t('Sign in with your GW2 API key to post raids.')} <Link to="/account" className="underline">{t('Sign in →')}</Link>
      </Notice>
    );
  }
  if (!form) return <Skeleton h={400} />;

  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setForm({ ...form, [k]: v });
  const typeTitle = (type: EventType) => t(EVENT_TYPES.find((x) => x.id === type)!.label);
  const setSched = (patch: Partial<Schedule>) => setForm({ ...form, schedule: { ...form.schedule, ...patch } as Schedule });
  const schedErr = validateSchedule(form.schedule);
  const preview = schedErr ? [] : occurrencesBetween(form.schedule, now, now + 30 * 86_400_000, 4);
  const guild = member!.guilds.find((g) => g.id === form.guildId);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    const payload: EventInput = {
      ...form,
      // No title needed — an empty one becomes the raid type (here in the poster's language).
      title: form.title.trim() || typeTitle(form.type),
      squadJoin: form.squadJoin?.trim() || null,
      voice: voiceUrl.trim() ? { kind: voiceKind, url: voiceUrl.trim() } : null,
    };
    try {
      if (editing) {
        await call('updateEvent', { eventId: id, ...payload });
        toast(t('Raid updated.'), 'ok');
        navigate(`/events/${id}`);
      } else {
        const r = await call<{ event: PublicEvent }>('createEvent', payload);
        toast(t('Raid posted to the calendar!'), 'ok');
        navigate(`/events/${r.event.id}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl">
      <PageHeader
        title={t(editing ? 'Edit raid' : 'Post a raid')}
        sub={t('Public: guild, team, time, map, type, tag and languages. Team-only: squad join, voice, goals, size, builds and notes.')}
      />
      {modLoaded?.event.archived && (
        <div className="mb-4">
          <Notice tone="gold">{t('This raid is in the past. As a moderator you can still correct it — the date may stay in the past.')}</Notice>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}

      <div className="card card-pad mb-4 grid gap-4">
        <h2 className="font-bold">{t('Basics')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">{t('Guild')}</span>
            <select className="select" value={form.guildId ?? ''} onChange={(e) => set('guildId', e.target.value || null)} disabled={editing}>
              <option value="">— {t('No guild (independent raid)')} —</option>
              {member!.guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  [{g.tag}] {g.name} {g.leader ? '👑' : ''}
                </option>
              ))}
              {existing?.guildId && !member!.guilds.some((g) => g.id === existing.guildId) && (
                <option value={existing.guildId}>
                  [{existing.guildTag}] {existing.guildName}
                </option>
              )}

            </select>
            <span className="faint mt-1 block text-xs">
              {!form.guildId
                ? t('Shown as an independent raid, without a guild tag. Your account name is never shown.')
                : guild?.leader
                  ? t('You lead this guild — the raid shows as ✓ official.')
                  : t('Any guild member can post; only the guild leader’s raids carry the ✓ official badge.')}
            </span>
          </label>
          <label>
            <span className="label">
              {t('Title')} <span className="faint normal-case">· {t('optional')}</span>
            </span>
            <input
              className="input"
              value={form.title}
              maxLength={LIMITS.titleMax}
              onChange={(e) => {
                setTitleTouched(true);
                set('title', e.target.value);
              }}
              placeholder={typeTitle(form.type)}
            />
          </label>
          <label>
            <span className="label">{t('Raid type')}</span>
            <select
              className="select"
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as EventType;
                // Keep the pre-filled default title in step with the type.
                setForm({ ...form, type, title: titleTouched ? form.title : typeTitle(type) });
              }}
            >
              {EVENT_TYPES.map((x) => (
                <option key={x.id} value={x.id}>
                  {t(x.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{t('Who can join')}</span>
            <select className="select" value={form.openness} onChange={(e) => set('openness', e.target.value as Openness)}>
              {OPENNESS.map((x) => (
                <option key={x.id} value={x.id}>
                  {t(x.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="label">{t('Who can see this raid')}</span>
          <Segmented
            options={AUDIENCES.map((a) => ({ id: a.id, label: a.id === 'team' ? `🔒 ${t('Only my team')}` : `🌍 ${t('Everyone')}` }))}
            value={form.audience}
            onChange={(v) => set('audience', v as Audience)}
          />
          <span className="faint mt-1 block text-xs">{t(AUDIENCES.find((a) => a.id === form.audience)?.hint ?? '')}</span>
        </div>
        <div>
          <span className="label">{t('Languages (max 4)')}</span>
          <ChipToggle options={LANGUAGES} value={form.languages} onChange={(v) => set('languages', v as Language[])} max={4} />
        </div>
      </div>

      <div className="card card-pad mb-4 grid gap-4">
        <h2 className="font-bold">{t('When')}</h2>
        <Segmented
          options={[
            { id: 'none', label: t('One-off') },
            { id: 'weekly', label: t('Weekly') },
          ]}
          value={form.schedule.repeat}
          onChange={(r) =>
            setSched({
              repeat: r,
              days: r === 'weekly' ? (form.schedule.days?.length ? form.schedule.days : [weekdayOfDate(form.schedule.date)]) : undefined,
              until: r === 'weekly' ? form.schedule.until ?? null : undefined,
            })
          }

        />
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="sm:col-span-1">
            <span className="label">{t(form.schedule.repeat === 'weekly' ? 'Starting' : 'Date')}</span>
            <input type="date" className="input" value={form.schedule.date} onChange={(e) => setSched({ date: e.target.value })} required />
          </label>
          <label>
            <span className="label">{t('Start time')}</span>
            <input type="time" className="input" value={form.schedule.time} onChange={(e) => setSched({ time: e.target.value })} required />
          </label>
          <label>
            <span className="label">{t('Duration (min)')}</span>
            <input
              type="number"
              className="input"
              min={15}
              max={720}
              step={15}
              value={form.schedule.durationMin}
              onChange={(e) => setSched({ durationMin: Number(e.target.value) })}
            />
          </label>
          <label>
            <span className="label">{t('Your time zone')}</span>
            <select className="select" value={form.schedule.tz} onChange={(e) => setSched({ tz: e.target.value })}>
              {[...new Set([form.schedule.tz, ...COMMON_TIMEZONES])].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        </div>
        {form.schedule.repeat === 'weekly' && (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <span className="label">{t('Days')}</span>
              <ChipToggle
                options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ id: String(d), label: t(WEEKDAY_SHORT[d]) }))}
                value={(form.schedule.days ?? []).map(String)}
                onChange={(v) => setSched({ days: v.map(Number) })}
              />
            </div>
            <label>
              <span className="label">{t('Until (optional)')}</span>
              <input type="date" className="input" value={form.schedule.until ?? ''} onChange={(e) => setSched({ until: e.target.value || null })} />
            </label>
          </div>
        )}
        {schedErr ? (
          <p className="text-sm text-orange-300">{schedErr}</p>
        ) : (
          <div className="text-sm">
            <span className="label">{t('Preview ({tz})', { tz: displayTz })}</span>
            <ul className="muted">
              {preview.map((o) => (
                <li key={o.start}>{fmtRange(o.start, o.end, displayTz)}</li>
              ))}
              {!preview.length && <li>{t('No dates in the next 30 days.')}</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="card card-pad mb-4 grid gap-2">
        <span className="label">{t('Commander tag')}</span>
        <TagPicker value={form.tag} onChange={(v) => set('tag', v)} />
        <p className="faint text-xs">{t('The tag players look for in-game — shown on the calendar and the matchup map.')}</p>
      </div>

      <div className="card card-pad mb-4 grid gap-4">
        <div>
          <span className="label">{t('Where — pick the map, or Jumper for cross-map play')}</span>
          <MapPicker value={form.map} onChange={(v) => v && set('map', v as MapId)} sides={sides} myColor={myColor} />
          <p className="muted mt-1 text-sm">
            {t('Selected:')} <b className="text-white">{mapLabel(form.map, t, sides, names)}</b>
          </p>
        </div>
      </div>

      <div className="card card-pad mb-4 grid gap-4">
        <h2 className="font-bold">🔒 {t('Team-only details')}</h2>
        <label>
          <span className="label">{t('Squad join (in-game)')}</span>
          <div className="flex items-center gap-2">
            <span className="faint shrink-0 font-mono text-sm">/squadjoin</span>
            <input
              className="input"
              value={form.squadJoin ?? ''}
              maxLength={LIMITS.squadJoinMax + 12}
              onChange={(e) => set('squadJoin', e.target.value.replace(/^\/(squadjoin|sqjoin)\s+/i, '') || null)}
              placeholder={t('Commander’s character name')}
              autoComplete="off"
            />
          </div>
          <span className="faint mt-1 block text-xs">
            {t('Only players verified by API key to be on your team see this — with a copy button next to the raid on the calendar and map. Others never get it.')}
          </span>
          {form.squadJoin?.trim() && (
            <span className="mt-2 block">
              <SquadJoin name={form.squadJoin.trim()} />
            </span>
          )}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">{t('Expected squad size')}</span>
            <input
              type="number"
              className="input"
              min={1}
              max={LIMITS.expectedSizeMax}
              value={form.expectedSize ?? ''}
              onChange={(e) => set('expectedSize', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label>
            <span className="label">{t('Voice platform')}</span>
            <select className="select" value={voiceKind} onChange={(e) => setVoiceKind(e.target.value as VoiceKind)}>
              {VOICE_KINDS.map((v) => (
                <option key={v.id} value={v.id}>
                  {t(v.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{t('Voice link')}</span>
            <input
              className="input"
              value={voiceUrl}
              onChange={(e) => setVoiceUrl(e.target.value)}
              placeholder={voiceKind === 'discord' ? 'https://discord.com/channels/… or discord.gg/…' : 'ts3server://… / https://…'}
            />
          </label>
        </div>
        <label>
          <span className="label">{t('Goals')}</span>
          <textarea className="textarea" maxLength={LIMITS.goalsMax} value={form.goals} onChange={(e) => set('goals', e.target.value)} placeholder={t('Defend home BL, push SMC after reset, train new tags…')} />
        </label>
        <label>
          <span className="label">{t('Builds / comp link')}</span>
          <input className="input" value={form.buildsUrl ?? ''} onChange={(e) => set('buildsUrl', e.target.value || null)} placeholder="https://…" />
        </label>
        <label>
          <span className="label">{t('Notes')}</span>
          <textarea className="textarea" maxLength={LIMITS.notesMax} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('Meet at spawn 15 min early, mic optional…')} />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Link to={editing ? `/events/${id}` : '/calendar'} className="btn">
          {t('Cancel')}
        </Link>
        <button className="btn btn-gold" disabled={busy || !!schedErr || !form.languages.length}>
          {t(busy ? 'Saving…' : editing ? 'Save changes' : 'Post raid')}

        </button>
      </div>
    </form>
  );
}
