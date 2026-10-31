import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Notice, PageHeader, Segmented, Skeleton } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';
import { call, errorMessage } from '../firebase';
import { isAdmin, isMod, useStore } from '../store';
import { REPORT_REASONS, labelOf } from '../shared/constants';
import { TEAM_NAMES } from '../shared/teams';
import type { ReportRow } from '../shared/types';

type Tab = 'reports' | 'settings' | 'discord' | 'mods';
type Row = ReportRow & { applied: string | null };

function Reports() {
  const toast = useStore((s) => s.toast);
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    setRows(null);
    call<{ reports: Row[] }>('modListReports', { status })
      .then((r) => setRows(r.reports))
      .catch((e) => {
        toast(errorMessage(e), 'error');
        setRows([]);
      });
  }, [status, toast]);
  useEffect(load, [load]);

  const act = async (r: Row, action: string) => {
    try {
      await call('modResolveReport', { reportId: r.id, action, note: notes[r.id] ?? '' });
      toast('Done.', 'ok');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const link = (r: Row) => (r.targetType === 'event' ? `/events/${r.targetId}` : r.targetType === 'run' ? `/runs/${r.targetId}` : `/guilds/${r.targetId}`);

  return (
    <div>
      <Segmented
        options={[
          { id: 'open', label: 'Open' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'dismissed', label: 'Dismissed' },
        ]}
        value={status}
        onChange={setStatus}
      />
      <div className="mt-4 grid gap-3">
        {rows === null ? (
          <Skeleton h={120} />
        ) : rows.length === 0 ? (
          <Empty title="Nothing here 🎉" />
        ) : (
          rows.map((r) => (
            <div key={r.id} className="card card-pad">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip chip-red">{labelOf(REPORT_REASONS, r.reason)}</span>
                <span className="chip">{r.targetType}</span>
                <Link to={link(r)} className="font-semibold hover:underline">
                  {r.targetLabel}
                </Link>
                <span className="faint text-xs">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              {r.details && <p className="mt-2 whitespace-pre-wrap text-sm">{r.details}</p>}
              {r.resolution && <p className="faint mt-2 text-xs">Resolution: {r.resolution}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className="input max-w-xs !py-1 text-sm"
                  placeholder="Note (optional)"
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                />
                {r.status === 'open' ? (
                  <>
                    <button className="btn btn-sm" onClick={() => act(r, 'dismiss')}>
                      Dismiss
                    </button>
                    {r.targetType !== 'guild' && (
                      <button className="btn btn-sm" onClick={() => act(r, 'hideEvent')}>
                        Hide raid
                      </button>
                    )}
                    {r.targetType !== 'guild' && (
                      <button className="btn btn-danger btn-sm" onClick={() => act(r, 'suspendCommander')}>
                        Suspend commander
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => act(r, 'suspendGuild')}>
                      Suspend guild page
                    </button>
                  </>
                ) : (
                  <button className="btn btn-sm" onClick={() => act(r, 'revert')}>
                    ↩ Revert & reopen
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <p className="faint mt-4 text-xs">Moderators never see commander identities: actions resolve the owner server-side and are reversible.</p>
    </div>
  );
}

interface SettingsShape {
  siteUrl: string;
  hubInviteUrl: string | null;
  announcement: string | null;
  teamNames: Record<string, string>;
  discord: {
    guildId: string | null;
    autoJoin: boolean;
    channels: Record<string, string>;
    roles: Record<string, string> & { teams?: Record<string, string> };
  };
}

const CHANNEL_KEYS = ['welcome', 'rules', 'announcements', 'raidsEu', 'raidsNa', 'liveEu', 'liveNa', 'reports', 'modLog'];
const ROLE_KEYS = ['verified', 'commander', 'guildLeader', 'eu', 'na', 'mod'];

function Settings() {
  const toast = useStore((s) => s.toast);
  const [s, setS] = useState<SettingsShape | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call<{ settings: SettingsShape }>('adminGetSettings')
      .then((r) => setS(r.settings))
      .catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);
  if (!s) return <Skeleton h={300} />;
  const save = async () => {
    setBusy(true);
    try {
      const r = await call<{ settings: SettingsShape }>('adminUpdateSettings', s);
      setS(r.settings);
      toast('Settings saved.', 'ok');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const idInput = (value: string | undefined, onChange: (v: string) => void, label: string) => (
    <label key={label}>
      <span className="label">{label}</span>
      <input className="input font-mono text-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim())} placeholder="Discord id" />
    </label>
  );
  return (
    <div className="grid gap-4">
      <div className="card card-pad grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Site URL (for Discord links + iCal)</span>
          <input className="input" value={s.siteUrl} onChange={(e) => setS({ ...s, siteUrl: e.target.value })} />
        </label>
        <label>
          <span className="label">Hub invite URL (public)</span>
          <input className="input" value={s.hubInviteUrl ?? ''} onChange={(e) => setS({ ...s, hubInviteUrl: e.target.value || null })} placeholder="https://discord.gg/…" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Site-wide announcement banner</span>
          <input className="input" maxLength={300} value={s.announcement ?? ''} onChange={(e) => setS({ ...s, announcement: e.target.value || null })} />
        </label>
      </div>
      <div className="card card-pad grid gap-3">
        <h3 className="font-bold">Discord hub</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {idInput(s.discord.guildId ?? undefined, (v) => setS({ ...s, discord: { ...s.discord, guildId: v || null } }), 'Hub server id')}
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" checked={s.discord.autoJoin} onChange={(e) => setS({ ...s, discord: { ...s.discord, autoJoin: e.target.checked } })} />
            Auto-add members to the hub on sign-in (guilds.join)
          </label>
        </div>
        <p className="faint text-xs">Channels and roles below are filled automatically by “Provision hub server” — edit only to point at existing ones.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {CHANNEL_KEYS.map((k) =>
            idInput(s.discord.channels[k], (v) => setS({ ...s, discord: { ...s.discord, channels: { ...s.discord.channels, [k]: v } } }), `#${k}`),
          )}
          {ROLE_KEYS.map((k) =>
            idInput(s.discord.roles[k], (v) => setS({ ...s, discord: { ...s.discord, roles: { ...s.discord.roles, [k]: v } } }), `@${k}`),
          )}
        </div>
      </div>
      <details className="card card-pad">
        <summary className="cursor-pointer font-bold">Team name overrides</summary>
        <p className="faint my-2 text-xs">Leave empty to use the built-in name. Use this if ArenaNet renames a team.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(TEAM_NAMES).map(([id, name]) => (
            <label key={id}>
              <span className="label">
                {id} · {name}
              </span>
              <input
                className="input !py-1 text-sm"
                value={s.teamNames[id] ?? ''}
                onChange={(e) => setS({ ...s, teamNames: { ...s.teamNames, [id]: e.target.value } })}
              />
            </label>
          ))}
        </div>
      </details>
      <div className="flex justify-end">
        <button className="btn btn-gold" onClick={save} disabled={busy}>
          Save settings
        </button>
      </div>
    </div>
  );
}

function DiscordTools() {
  const toast = useStore((s) => s.toast);
  const [info, setInfo] = useState<{ inviteUrl: string; bot: { username: string } | null; guild: { name: string } | null } | null>(null);
  const [log, setLog] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const loadInfo = useCallback(() => {
    call<typeof info>('adminDiscordInfo')
      .then(setInfo)
      .catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);
  useEffect(loadInfo, [loadInfo]);
  const run = async (name: string, ok: string) => {
    setBusy(true);
    try {
      const r = await call<{ created?: string[]; registered?: string[] }>(name);
      setLog(r.created ?? r.registered ?? []);
      toast(ok, 'ok');
      loadInfo();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4">
      <div className="card card-pad">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Bot: {info?.bot ? <b>{info.bot.username}</b> : <span className="faint">not configured (WVW_SECRETS.discordBotToken)</span>} · Hub:{' '}
            {info?.guild ? <b>{info.guild.name}</b> : <span className="faint">set the hub server id in Settings, then invite the bot</span>}
          </li>
          <li>
            {info?.inviteUrl ? (
              <a className="text-[var(--gold)] underline" href={info.inviteUrl} target="_blank" rel="noopener noreferrer">
                Invite the bot to the hub server
              </a>
            ) : (
              'Invite the bot'
            )}{' '}
            — then drag its role above the Verified/Team roles (Server settings → Roles) so it can assign them.
          </li>
          <li>
            <button className="btn btn-sm" disabled={busy} onClick={() => run('adminProvisionDiscord', 'Hub provisioned.')}>
              Provision hub server
            </button>{' '}
            creates roles, channel groups, region voice channels, rules, welcome text and AutoMod rules (only what’s missing).
          </li>
          <li>
            <button className="btn btn-sm" disabled={busy} onClick={() => run('adminRegisterCommands', 'Slash commands registered.')}>
              Register slash commands
            </button>{' '}
            (/raid, /wvw). Set the Interactions Endpoint URL in the Discord portal to <code className="text-xs">…/wvw-discordInteractions</code>.
          </li>
          <li>Recommended manually: enable Community, Onboarding and Rules Screening in the server settings.</li>
        </ol>
      </div>
      {log && (
        <div className="card card-pad text-sm">
          <h3 className="mb-2 font-bold">Result</h3>
          {log.length ? (
            <ul className="list-disc pl-5">
              {log.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing to do — everything already exists.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Mods() {
  const toast = useStore((s) => s.toast);
  const [mods, setMods] = useState<{ discordId: string; discordName: string; role: string }[] | null>(null);
  const [id, setId] = useState('');
  const load = useCallback(() => {
    call<{ mods: typeof mods }>('adminListMods')
      .then((r) => setMods(r.mods))
      .catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);
  useEffect(load, [load]);
  const set = async (discordId: string, role: 'user' | 'mod') => {
    try {
      await call('adminSetRole', { discordId, role });
      toast('Updated.', 'ok');
      setId('');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div className="card card-pad grid gap-3">
      <p className="muted text-sm">Promote by Discord user id (Discord → Settings → Advanced → Developer Mode, then right-click a user → Copy User ID). They must have signed in once.</p>
      <div className="flex gap-2">
        <input className="input max-w-xs font-mono" value={id} onChange={(e) => setId(e.target.value.trim())} placeholder="Discord user id" />
        <button className="btn btn-gold" disabled={!/^\d{15,22}$/.test(id)} onClick={() => set(id, 'mod')}>
          Make moderator
        </button>
      </div>
      <ul className="divide-y divide-[var(--border)] text-sm">
        {(mods ?? []).map((m) => (
          <li key={m.discordId} className="flex items-center justify-between py-2">
            <span>
              {m.discordName} <span className="faint font-mono text-xs">{m.discordId}</span> <span className="chip">{m.role}</span>
            </span>
            {m.role === 'mod' && (
              <button className="btn btn-danger btn-sm" onClick={() => set(m.discordId, 'user')}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="faint text-xs">Admins come from WVW_SECRETS.adminDiscordIds.</p>
    </div>
  );
}

export default function Moderation() {
  useDocumentTitle('Moderation');
  const member = useStore((s) => s.member);
  const [tab, setTab] = useState<Tab>('reports');
  if (!isMod(member)) return <ErrorBox>Moderators only.</ErrorBox>;
  const admin = isAdmin(member);
  return (
    <div>
      <PageHeader title="Moderation" sub="Reports, settings and the Discord hub." />
      {!admin && <Notice>You’re a moderator — settings and Discord tools are admin-only.</Notice>}
      <div className="my-4">
        <Segmented
          options={[
            { id: 'reports', label: 'Reports' },
            ...(admin
              ? ([
                  { id: 'settings', label: 'Settings' },
                  { id: 'discord', label: 'Discord' },
                  { id: 'mods', label: 'Mods' },
                ] as const)
              : []),
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === 'reports' && <Reports />}
      {tab === 'settings' && admin && <Settings />}
      {tab === 'discord' && admin && <DiscordTools />}
      {tab === 'mods' && admin && <Mods />}
    </div>
  );
}
