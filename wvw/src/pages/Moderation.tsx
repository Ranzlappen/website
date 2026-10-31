import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Notice, PageHeader, Segmented, Skeleton } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';
import { call, errorMessage } from '../firebase';
import { isAdmin, isMod, useStore } from '../store';
import { REPORT_REASONS, labelOf } from '../shared/constants';
import { TEAM_NAMES } from '../shared/teams';
import type { ReportRow } from '../shared/types';
import { ImportRaids } from '../components/ImportRaids';
import { useT } from '../i18n';

type Tab = 'reports' | 'import' | 'settings' | 'mods';
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
                        Suspend raid lead
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
      <p className="faint mt-4 text-xs">Moderators never see who posted a raid: actions resolve the owner server-side and are reversible.</p>
    </div>
  );
}

interface SettingsShape {
  siteUrl: string;
  hubInviteUrl: string | null;
  announcement: string | null;
  teamNames: Record<string, string>;
}

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
  return (
    <div className="grid gap-4">
      <div className="card card-pad grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Site URL (for iCal links)</span>
          <input className="input" value={s.siteUrl} onChange={(e) => setS({ ...s, siteUrl: e.target.value })} />
        </label>
        <label>
          <span className="label">Community Discord invite (optional public link)</span>
          <input className="input" value={s.hubInviteUrl ?? ''} onChange={(e) => setS({ ...s, hubInviteUrl: e.target.value || null })} placeholder="https://discord.gg/…" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Site-wide announcement banner</span>
          <input className="input" maxLength={300} value={s.announcement ?? ''} onChange={(e) => setS({ ...s, announcement: e.target.value || null })} />
        </label>
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

function Mods() {
  const toast = useStore((s) => s.toast);
  const [mods, setMods] = useState<{ accountName: string; role: string }[] | null>(null);
  const [name, setName] = useState('');
  const load = useCallback(() => {
    call<{ mods: { accountName: string; role: string }[] }>('adminListMods')
      .then((r) => setMods(r.mods))
      .catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);
  useEffect(load, [load]);
  const set = async (accountName: string, role: 'user' | 'mod') => {
    try {
      await call('adminSetRole', { accountName, role });
      toast('Updated.', 'ok');
      setName('');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div className="card card-pad grid gap-3">
      <p className="muted text-sm">Promote by GW2 account name (Name.1234). They must have signed in once. Account names stay inside this admin view.</p>
      <div className="flex gap-2">
        <input className="input max-w-xs font-mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name.1234" />
        <button className="btn btn-gold" disabled={!/\.\d{4}$/.test(name.trim())} onClick={() => set(name.trim(), 'mod')}>
          Make moderator
        </button>
      </div>
      <ul className="divide-y divide-[var(--border)] text-sm">
        {(mods ?? []).map((m) => (
          <li key={m.accountName} className="flex items-center justify-between py-2">
            <span>
              {m.accountName} <span className="chip">{m.role}</span>
            </span>
            {m.role === 'mod' && (
              <button className="btn btn-danger btn-sm" onClick={() => set(m.accountName, 'user')}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="faint text-xs">Admins come from WVW_SECRETS.adminAccounts.</p>
    </div>
  );
}

export default function Moderation() {
  const t = useT();
  useDocumentTitle(t('Moderation'));
  const member = useStore((s) => s.member);
  const [tab, setTab] = useState<Tab>('reports');
  if (!isMod(member)) return <ErrorBox>{t('Moderators only.')}</ErrorBox>;
  const admin = isAdmin(member);
  return (
    <div>
      <PageHeader title={t('Moderation')} sub={t('Reports, raid import, settings and moderators.')} />
      {!admin && <Notice>{t('You’re a moderator — import and settings are admin-only.')}</Notice>}
      <div className="my-4">
        <Segmented
          options={[
            { id: 'reports', label: t('Reports') },
            ...(admin
              ? ([
                  { id: 'import', label: t('Import raids') },
                  { id: 'settings', label: t('Settings') },
                  { id: 'mods', label: t('Mods') },
                ] as const)
              : []),
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === 'reports' && <Reports />}
      {tab === 'import' && admin && <ImportRaids />}
      {tab === 'settings' && admin && <Settings />}

      {tab === 'mods' && admin && <Mods />}
    </div>
  );
}
