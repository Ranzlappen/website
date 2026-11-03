/**
 * Moderation → Members (admins only): find members by GW2 account name, ban /
 * unban (blacklist), promote moderators. Bans block sign-in by GW2 account id
 * and name, suspend the member, sign them out and hide (or delete) their raids.
 * Account names stay inside this admin view.
 */
import { useCallback, useEffect, useState } from 'react';
import { Empty, Modal, Segmented, Skeleton } from './ui';
import { call, errorMessage } from '../firebase';
import { useStore } from '../store';
import type { AdminMemberRow } from '../shared/types';
import { relative, team } from '../lib/format';
import { useTeamNames } from '../lib/hooks';
import { useT } from '../i18n';

type Filter = 'recent' | 'banned' | 'mods';

interface BanTarget {
  uid?: string;
  accountName: string;
}

export function AdminMembers() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const names = useTeamNames();
  const [filter, setFilter] = useState<Filter>('recent');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminMemberRow[] | null>(null);
  const [nameBans, setNameBans] = useState<{ accountName: string; reason: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [ban, setBan] = useState<BanTarget | null>(null);
  const [reason, setReason] = useState('');
  const [raids, setRaids] = useState<'hide' | 'delete'>('hide');
  const [banName, setBanName] = useState('');

  const load = useCallback(() => {
    call<{ members: AdminMemberRow[]; nameBans: { accountName: string; reason: string | null }[] }>('adminListMembers', {
      filter: query ? null : filter,
      q: query || null,
    })
      .then((r) => {
        setRows(r.members);
        setNameBans(r.nameBans ?? []);
      })
      .catch((e) => {
        toast(errorMessage(e), 'error');
        setRows([]);
      });
  }, [filter, query, toast]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok, 'ok');
      load();
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmBan = async () => {
    if (!ban) return;
    const ok = await run(() => call('adminBanMember', { uid: ban.uid ?? null, accountName: ban.accountName, reason, raids }), t('Banned.'));
    if (ok) {
      setBan(null);
      setReason('');
      setBanName('');
    }
  };

  return (
    <div className="grid gap-4">
      <div className="card card-pad flex flex-wrap items-end gap-3">
        <Segmented
          options={[
            { id: 'recent', label: t('Newest') },
            { id: 'banned', label: t('Banned / suspended') },
            { id: 'mods', label: t('Moderators') },
          ]}
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setQ('');
            setQuery('');
          }}
        />
        <form
          className="flex min-w-[16rem] flex-1 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <label className="flex-1">
            <span className="label">{t('Find by GW2 account name (starts with, case-sensitive)')}</span>
            <input className="input font-mono" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name.1234" />
          </label>
          <button className="btn btn-sm">{t('Search')}</button>
        </form>
      </div>

      {rows === null ? (
        <Skeleton h={200} />
      ) : !rows.length && !nameBans.length ? (
        <Empty title={t('No members found')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>{t('Account')}</th>
                <th>{t('Team')}</th>
                <th>{t('Guilds')}</th>
                <th>{t('Status')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.uid}>
                  <td>
                    <div className="font-mono">{m.accountName ?? '—'}</div>
                    <div className="faint text-xs">{t('joined {when}', { when: relative(m.createdAt) })}</div>
                  </td>
                  <td className="whitespace-nowrap">{m.teamId ? team(m.teamId, names) : '—'}</td>
                  <td className="faint text-xs">{m.guilds.map((g) => `[${g}]`).join(' ') || '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {m.role !== 'user' && <span className="chip chip-gold">{m.role}</span>}
                      {m.banned ? (
                        <span className="chip chip-red" title={m.banReason ?? ''}>
                          ⛔ {t('banned')}
                          {m.banReason ? `: ${m.banReason}` : ''}
                        </span>
                      ) : m.status === 'suspended' ? (
                        <span className="chip chip-red">{t('suspended')}</span>
                      ) : m.stale ? (
                        <span className="chip">{t('needs re-verify')}</span>
                      ) : m.verified ? (
                        <span className="chip chip-green">{t('Verified')}</span>
                      ) : null}
                      {m.commander && <span className="chip">🏷️ {t('Commander')}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {m.role === 'admin' ? (
                        <span className="faint text-xs">—</span>
                      ) : m.banned || m.status === 'suspended' ? (
                        <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('adminUnbanMember', { uid: m.uid }), t('Unbanned.'))}>
                          {t('Unban')}
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setBan({ uid: m.uid, accountName: m.accountName ?? '' })}>
                            ⛔ {t('Ban')}
                          </button>
                          {m.accountName && m.role === 'user' && (
                            <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('adminSetRole', { accountName: m.accountName, role: 'mod' }), t('Updated.'))}>
                              {t('Make moderator')}
                            </button>
                          )}
                          {m.accountName && m.role === 'mod' && (
                            <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('adminSetRole', { accountName: m.accountName, role: 'user' }), t('Updated.'))}>
                              {t('Remove moderator')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {nameBans.map((b) => (
                <tr key={`name-${b.accountName}`}>
                  <td className="font-mono">{b.accountName}</td>
                  <td className="faint text-xs" colSpan={2}>
                    {t('never signed in')}
                  </td>
                  <td>
                    <span className="chip chip-red">
                      ⛔ {t('banned')}
                      {b.reason ? `: ${b.reason}` : ''}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('adminUnbanMember', { accountName: b.accountName }), t('Unbanned.'))}>
                      {t('Unban')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card card-pad grid gap-2">
        <h3 className="font-bold">{t('Ban an account that hasn’t signed in yet')}</h3>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs font-mono" value={banName} onChange={(e) => setBanName(e.target.value)} placeholder="Name.1234" />
          <button className="btn btn-danger" disabled={!/\.\d{4}$/.test(banName.trim())} onClick={() => setBan({ accountName: banName.trim() })}>
            ⛔ {t('Ban')}
          </button>
        </div>
        <p className="faint text-xs">{t('Admins come from WVW_SECRETS.adminAccounts. Moderators can hide raids and handle reports; banning, deleting and settings are admin-only.')}</p>
      </div>

      <Modal open={!!ban} onClose={() => setBan(null)} title={t('Ban {name}', { name: ban?.accountName || '—' })}>
        <div className="grid gap-3 text-sm">
          <p className="muted">
            {t('The account can no longer sign in (blocked by GW2 account id and name), is signed out, and its stored API key is deleted. Account names are never shown publicly.')}
          </p>
          <label>
            <span className="label">{t('Reason (moderators only)')}</span>
            <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {ban?.uid && (
            <div>
              <span className="label">{t('Their raids')}</span>
              <Segmented
                options={[
                  { id: 'hide', label: t('Hide (restored on unban)') },
                  { id: 'delete', label: t('Delete permanently') },
                ]}
                value={raids}
                onChange={setRaids}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setBan(null)}>
              {t('Cancel')}
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={confirmBan}>
              ⛔ {t('Ban')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
