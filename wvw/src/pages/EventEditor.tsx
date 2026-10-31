import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChipToggle, ErrorBox, Notice, PageHeader, Segmented, Skeleton } from '../components/ui';
import { useDocumentTitle, useEventIndex, useMySides, useMyTeamIndex, useNow, useTeamNames } from '../lib/hooks';
import { MapPicker, zoneLabel } from '../components/MapPicker';
import { fmtRange } from '../lib/format';
import { call, errorMessage } from '../firebase';
import { isVerified, useStore } from '../store';
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
import type { EventDetails, EventInput, PublicEvent } from '../shared/types';

function todayIn(tz: string): string {
  const p = localParts(Date.now(), tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

function blank(tz: string, guildId: string): EventInput {
  const date = todayIn(tz);
  const p = parseDate(date)!;
  return {
    guildId,
    title: '',
    type: 'zerg',
    audience: 'everyone',
    openness: 'open',
    languages: ['en'],
    schedule: { tz, date, time: '20:00', durationMin: 120, repeat: 'weekly', days: [weekdayOfDays(civilToDays(p.y, p.m, p.d))], until: null },
    map: 'ebg:red',
    goals: '',
    expectedSize: null,
    voice: null,
    buildsUrl: null,
    notes: '',
  };
}

export default function EventEditor() {
  const { id } = useParams();
  const editing = !!id;
  useDocumentTitle(editing ? 'Edit raid' : 'Post a raid');
  const navigate = useNavigate();
  const { member, memberReady, displayTz, toast } = useStore();
  const eu = useEventIndex('eu');
  const na = useEventIndex('na');
  const [form, setForm] = useState<EventInput | null>(null);
  const [voiceKind, setVoiceKind] = useState<VoiceKind>('discord');
  const [voiceUrl, setVoiceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(60_000);
  const { sides, myColor } = useMySides();
  const names = useTeamNames();

  const teamIdx = useMyTeamIndex();
  const existing: PublicEvent | null = useMemo(
    () =>
      id
        ? [...(eu.data?.events ?? []), ...(na.data?.events ?? []), ...(teamIdx?.events ?? [])].find((e) => e.id === id) ?? null
        : null,
    [eu.data, na.data, teamIdx, id],
  );

  useEffect(() => {
    if (!member || form) return;
    const tz = member.prefs?.timezone || displayTz;
    if (!editing) {
      setForm(blank(tz, member.guilds[0]?.id ?? ''));
      return;
    }
    if (!existing) return;
    call<{ details: EventDetails[] }>('getEventDetails', { eventIds: [existing.id] })
      .then(({ details }) => {
        const d = details[0];
        setForm({
          guildId: existing.guildId,
          title: existing.title,
          type: existing.type,
          audience: existing.audience ?? 'everyone',
          openness: existing.openness,
          languages: existing.languages,
          schedule: existing.schedule,
          map: d?.map ?? 'ebg:red',
          goals: d?.goals ?? '',
          expectedSize: d?.expectedSize ?? null,
          voice: d?.voice ?? null,
          buildsUrl: d?.buildsUrl ?? null,
          notes: d?.notes ?? '',
        });
        if (d?.voice) {
          setVoiceKind(d.voice.kind);
          setVoiceUrl(d.voice.url);
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [member, existing, editing, form, displayTz]);

  if (!memberReady) return <Skeleton h={400} />;
  if (!isVerified(member)) {
    return (
      <Notice tone="warn">
        Sign in with your GW2 API key to post raids. <Link to="/account" className="underline">Sign in →</Link>
      </Notice>
    );
  }
  if (!member!.guilds.length) return <Notice tone="warn">Join a guild in-game, then re-verify — raids are always posted for a guild.</Notice>;
  if (!form) return <Skeleton h={400} />;

  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setForm({ ...form, [k]: v });
  const setSched = (patch: Partial<Schedule>) => setForm({ ...form, schedule: { ...form.schedule, ...patch } as Schedule });
  const schedErr = validateSchedule(form.schedule);
  const preview = schedErr ? [] : occurrencesBetween(form.schedule, now, now + 30 * 86_400_000, 4);
  const guild = member!.guilds.find((g) => g.id === form.guildId);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    const payload: EventInput = { ...form, voice: voiceUrl.trim() ? { kind: voiceKind, url: voiceUrl.trim() } : null };
    try {
      if (editing) {
        await call('updateEvent', { eventId: id, ...payload });
        toast('Raid updated.', 'ok');
        navigate(`/events/${id}`);
      } else {
        const r = await call<{ event: PublicEvent }>('createEvent', payload);
        toast('Raid posted to the calendar!', 'ok');
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
        title={editing ? 'Edit raid' : 'Post a raid'}
        sub="Public: guild, team, time, type and languages. Team-only: map, voice, goals, size, builds and notes."
      />
      {error && (
        <div className="mb-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}

      <div className="card card-pad mb-4 grid gap-4">
        <h2 className="font-bold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Guild</span>
            <select className="select" value={form.guildId} onChange={(e) => set('guildId', e.target.value)} disabled={editing}>
              {member!.guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  [{g.tag}] {g.name} {g.leader ? '👑' : ''}
                </option>
              ))}
            </select>
            <span className="faint mt-1 block text-xs">
              {guild?.leader
                ? 'You lead this guild — the raid shows as ✓ official.'
                : 'Any guild member can post; only the guild leader’s raids carry the ✓ official badge.'}
            </span>
          </label>
          <label>
            <span className="label">Title</span>
            <input className="input" value={form.title} maxLength={LIMITS.titleMax} onChange={(e) => set('title', e.target.value)} placeholder="Monday night zerg" required />
          </label>
          <label>
            <span className="label">Raid type</span>
            <select className="select" value={form.type} onChange={(e) => set('type', e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Who can join</span>
            <select className="select" value={form.openness} onChange={(e) => set('openness', e.target.value as Openness)}>
              {OPENNESS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="label">Who can see this raid</span>
          <Segmented
            options={AUDIENCES.map((a) => ({ id: a.id, label: a.id === 'team' ? '🔒 Only my team' : '🌍 Everyone' }))}
            value={form.audience}
            onChange={(v) => set('audience', v as Audience)}
          />
          <span className="faint mt-1 block text-xs">{AUDIENCES.find((a) => a.id === form.audience)?.hint}</span>
        </div>
        <div>
          <span className="label">Languages (max 4)</span>
          <ChipToggle options={LANGUAGES} value={form.languages} onChange={(v) => set('languages', v as Language[])} max={4} />
        </div>
      </div>

      <div className="card card-pad mb-4 grid gap-4">
        <h2 className="font-bold">When</h2>
        <Segmented
          options={[
            { id: 'weekly', label: 'Weekly' },
            { id: 'none', label: 'One-off' },
          ]}
          value={form.schedule.repeat}
          onChange={(r) => setSched({ repeat: r, days: r === 'weekly' ? form.schedule.days ?? [] : undefined, until: r === 'weekly' ? form.schedule.until ?? null : undefined })}
        />
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="sm:col-span-1">
            <span className="label">{form.schedule.repeat === 'weekly' ? 'Starting' : 'Date'}</span>
            <input type="date" className="input" value={form.schedule.date} onChange={(e) => setSched({ date: e.target.value })} required />
          </label>
          <label>
            <span className="label">Start time</span>
            <input type="time" className="input" value={form.schedule.time} onChange={(e) => setSched({ time: e.target.value })} required />
          </label>
          <label>
            <span className="label">Duration (min)</span>
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
            <span className="label">Your time zone</span>
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
              <span className="label">Days</span>
              <ChipToggle
                options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ id: String(d), label: WEEKDAY_SHORT[d] }))}
                value={(form.schedule.days ?? []).map(String)}
                onChange={(v) => setSched({ days: v.map(Number) })}
              />
            </div>
            <label>
              <span className="label">Until (optional)</span>
              <input type="date" className="input" value={form.schedule.until ?? ''} onChange={(e) => setSched({ until: e.target.value || null })} />
            </label>
          </div>
        )}
        {schedErr ? (
          <p className="text-sm text-orange-300">{schedErr}</p>
        ) : (
          <div className="text-sm">
            <span className="label">Preview ({displayTz})</span>
            <ul className="muted">
              {preview.map((o) => (
                <li key={o.start}>{fmtRange(o.start, o.end, displayTz)}</li>
              ))}
              {!preview.length && <li>No dates in the next 30 days.</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="card card-pad mb-4 grid gap-4">
        <h2 className="font-bold">🔒 Team-only details</h2>
        <div>
          <span className="label">Where — pick a map third, or Jumper for cross-map play</span>
          <MapPicker value={form.map} onChange={(v) => v && set('map', v as MapId)} sides={sides} myColor={myColor} />
          <p className="muted mt-1 text-center text-sm">
            Selected: <b className="text-white">{zoneLabel(form.map, sides, names)}</b>
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Expected squad size</span>
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
            <span className="label">Voice platform</span>
            <select className="select" value={voiceKind} onChange={(e) => setVoiceKind(e.target.value as VoiceKind)}>
              {VOICE_KINDS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Voice link</span>
            <input
              className="input"
              value={voiceUrl}
              onChange={(e) => setVoiceUrl(e.target.value)}
              placeholder={voiceKind === 'discord' ? 'https://discord.com/channels/… or discord.gg/…' : 'ts3server://… / https://…'}
            />
          </label>
        </div>
        <label>
          <span className="label">Goals</span>
          <textarea className="textarea" maxLength={LIMITS.goalsMax} value={form.goals} onChange={(e) => set('goals', e.target.value)} placeholder="Defend home BL, push SMC after reset, train new tags…" />
        </label>
        <label>
          <span className="label">Builds / comp link</span>
          <input className="input" value={form.buildsUrl ?? ''} onChange={(e) => set('buildsUrl', e.target.value || null)} placeholder="https://…" />
        </label>
        <label>
          <span className="label">Notes</span>
          <textarea className="textarea" maxLength={LIMITS.notesMax} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Meet at spawn 15 min early, mic optional…" />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Link to={editing ? `/events/${id}` : '/calendar'} className="btn">
          Cancel
        </Link>
        <button className="btn btn-gold" disabled={busy || !!schedErr || !form.title.trim() || !form.languages.length}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Post raid'}
        </button>
      </div>
    </form>
  );
}
