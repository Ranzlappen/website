/**
 * Moderation → Raids: every active raid incl. hidden and team-only ones.
 * Mods: hide / unhide / cancel. Admins additionally: hard delete (single or
 * bulk) and see the poster's GW2 account name.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, GuildTag, Segmented, Skeleton } from './ui';
import { call, errorMessage } from '../firebase';
import { useStore } from '../store';
import { EVENT_TYPES, labelOf } from '../shared/constants';
import { describeSchedule } from '../shared/time';
import type { AdminEventRow } from '../shared/types';
import { team } from '../lib/format';
import { useTeamNames } from '../lib/hooks';
import { mapLabel } from './MapPicker';
import { useT } from '../i18n';

type Filter = 'all' | 'hidden' | 'seeded' | 'independent' | 'team';

export function AdminRaids({ admin }: { admin: boolean }) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const names = useTeamNames();
  const [region, setRegion] = useState<'all' | 'eu' | 'na'>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminEventRow[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    call<{ events: AdminEventRow[] }>('modListEvents', { region: region === 'all' ? null : region })
      .then((r) => {
        setRows(r.events);
        setSel(new Set());
      })
      .catch((e) => {
        toast(errorMessage(e), 'error');
        setRows([]);
      });
  }, [region, toast]);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((e) => {
      if (filter === 'hidden' && e.visibility !== 'hidden') return false;
      if (filter === 'seeded' && !e.seeded) return false;
      if (filter === 'independent' && e.guildId) return false;
      if (filter === 'team' && e.audience !== 'team') return false;
      if (!needle) return true;
      return [e.title, e.guildTag, e.guildName, e.commander ?? '', team(e.teamId, names)].some((x) => x.toLowerCase().includes(needle));
    });
  }, [rows, filter, q, names]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok, 'ok');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const hide = (e: AdminEventRow) => {
    const reason = prompt(t('Reason for hiding (shown to moderators only):'), '');
    if (reason === null) return;
    void run(() => call('modSetEventHidden', { eventId: e.id, hidden: true, reason }), t('Raid hidden.'));
  };
  const remove = (ids: string[]) => {
    if (!ids.length || !confirm(t('Permanently delete {n} raid(s)? This cannot be undone.', { n: ids.length }))) return;
    void run(() => call('adminDeleteEvents', { eventIds: ids }), t('Deleted.'));
  };
  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSel(next);
  };
  const allShownSelected = shown.length > 0 && shown.every((e) => sel.has(e.id));

  return (
    <div className="grid gap-4">
      <div className="card card-pad flex flex-wrap items-end gap-3">
        <Segmented
          options={[
            { id: 'all', label: t('All') },
            { id: 'eu', label: 'EU' },
            { id: 'na', label: 'NA' },
          ]}
          value={region}
          onChange={setRegion}
        />
        <label className="min-w-[14rem] flex-1">
          <span className="label">{t('Search')}</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Title, guild, team or account…')} />
        </label>
        <label>
          <span className="label">{t('Show')}</span>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">{t('All raids')}</option>
            <option value="hidden">{t('Hidden')}</option>
            <option value="seeded">{t('Imported (seeded)')}</option>
            <option value="independent">{t('Independent (no guild)')}</option>
            <option value="team">{t('Team-only')}</option>
          </select>
        </label>
        <button className="btn btn-sm" onClick={load} disabled={busy}>
          ↻ {t('Refresh')}
        </button>
      </div>

      {admin && sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="muted">{t('{n} selected', { n: sel.size })}</span>
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove([...sel])}>
            🗑 {t('Delete selected')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>
            {t('Clear selection')}
          </button>
        </div>
      )}

      {rows === null ? (
        <Skeleton h={200} />
      ) : !shown.length ? (
        <Empty title={t('No raids match')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr>
                {admin && (
                  <th>
                    <input
                      type="checkbox"
                      aria-label={t('Select all')}
                      checked={allShownSelected}
                      onChange={() => setSel(allShownSelected ? new Set() : new Set(shown.map((e) => e.id)))}
                    />
                  </th>
                )}
                <th>{t('Raid')}</th>
                <th>{t('Team')}</th>
                <th>{t('Map')}</th>
                <th>{t('When')}</th>
                {admin && <th>{t('Posted by')}</th>}
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className={e.visibility === 'hidden' ? 'opacity-70' : ''}>
                  {admin && (
                    <td>
                      <input type="checkbox" aria-label={t('Select')} checked={sel.has(e.id)} onChange={() => toggle(e.id)} />
                    </td>
                  )}
                  <td className="min-w-[14rem]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <GuildTag tag={e.guildTag} id={e.guildId} />
                      <Link to={`/events/${e.id}`} className="font-semibold hover:underline">
                        {e.title}
                      </Link>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="chip">{t(labelOf(EVENT_TYPES, e.type))}</span>
                      {e.official && <span className="chip chip-gold">✓ {t('official')}</span>}
                      {e.seeded && <span className="chip">📋 {t('listed by moderators')}</span>}
                      {!e.guildId && <span className="chip">🏳️ {t('independent')}</span>}
                      {e.audience === 'team' && <span className="chip chip-blue">🔒 {t('team only')}</span>}
                      {e.status !== 'scheduled' && <span className="chip chip-red">{t(e.status === 'suspended' ? 'on hold' : e.status)}</span>}
                      {e.visibility === 'hidden' && (
                        <span className="chip chip-red" title={e.hiddenReason ?? ''}>
                          {t('hidden')}
                          {e.hiddenReason ? `: ${e.hiddenReason}` : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {team(e.teamId, names)} <span className="faint">{e.region.toUpperCase()}</span>
                  </td>
                  <td className="whitespace-nowrap">{mapLabel(e.map, t, undefined, undefined, true)}</td>
                  <td className="faint text-xs">{describeSchedule(e.schedule)}</td>
                  {admin && <td className="font-mono text-xs">{e.commander ?? (e.seeded ? t('import') : '—')}</td>}
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {e.visibility === 'hidden' ? (
                        <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('modSetEventHidden', { eventId: e.id, hidden: false }), t('Raid visible again.'))}>
                          {t('Unhide')}
                        </button>
                      ) : (
                        <button className="btn btn-sm" disabled={busy} onClick={() => hide(e)}>
                          {t('Hide')}
                        </button>
                      )}
                      {e.status === 'scheduled' && (
                        <button
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() => confirm(t('Cancel this raid?')) && run(() => call('cancelEvent', { eventId: e.id }), t('Raid cancelled.'))}
                        >
                          {t('Cancel')}
                        </button>
                      )}
                      {admin && (
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove([e.id])}>
                          {t('Delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="faint text-xs">
        {t('Hide removes a raid from every public surface and can be undone; Cancel marks it cancelled (the poster can re-activate it by editing); Delete removes it permanently.')}
      </p>
    </div>
  );
}
