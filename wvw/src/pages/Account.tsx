import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { ErrorBox, Notice, PageHeader, Skeleton, TeamChip } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';
import { auth, call, errorMessage } from '../firebase';
import { API_KEY_URL, KEY_NAME } from '../config';
import { isVerified, useStore } from '../store';
import { COMMON_TIMEZONES } from '../shared/constants';
import { browserTimeZone, fmtDateTime, relative } from '../lib/format';
import type { DeviceRow, StoredKeyInfo } from '../shared/types';
import { clearDevice, deviceRowId, rememberPref, setRememberPref, type RememberedDevice } from '../lib/device';

import { UI_LANGS, useT, type Lang } from '../i18n';

const ADMIN_UID = 'wvw-admin';

function KeySteps() {
  const t = useT();
  return (
    <ol className="muted mb-4 list-decimal space-y-1.5 pl-5 text-sm">
      <li>
        {t('Open')}{' '}
        <a href={API_KEY_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] underline">
          account.arena.net/applications
        </a>{' '}
        → <b>New Key</b>.
      </li>
      <li>
        {t('Name it')} <code className="rounded bg-[var(--bg-2)] px-2 py-0.5 font-mono font-bold text-[var(--gold)]">{KEY_NAME}</code>{' '}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(KEY_NAME)}>
          {t('copy')}
        </button>{' '}
        — {t('keys made for other tools aren’t accepted.')}
      </li>
      <li>{t('Tick account, guilds and wvw (nothing else is needed), create it and paste it below.')}</li>
    </ol>
  );
}

function KeyInput({
  busy,
  label,
  onSubmit,
  remember,
}: {
  busy: boolean;
  label: string;
  onSubmit: (key: string) => Promise<boolean>;
  /** Show the "Remember me on this device" checkbox (sign-in form). */
  remember?: { value: boolean; onChange: (v: boolean) => void };
}) {
  const t = useT();
  const [key, setKey] = useState('');
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit(key.trim())) setKey('');
      }}
    >
      <input
        className="input font-mono"
        placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXXXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-label={t('GW2 API key')}
      />
      <button className="btn btn-gold" disabled={busy || key.trim().length < 6}>
        {busy ? t('Checking…') : label}
      </button>
      {remember && (
        <label className="flex w-full items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={remember.value} onChange={(e) => remember.onChange(e.target.checked)} />
          <span>
            <b>{t('Remember me on this device')}</b>
            <span className="faint block text-xs">
              {t('Next time it’s one click — no need to look up your API key again. Untick on shared or public computers.')}
            </span>
          </span>
        </label>
      )}
    </form>
  );
}

/** Signed out, but this browser is remembered → one click back in. */
function WelcomeBack({ device }: { device: RememberedDevice }) {
  const t = useT();
  const navigate = useNavigate();
  const { resume, resuming, forgetThisDevice } = useStore();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card card-pad mb-4 grid gap-3 border-[rgba(224,179,65,0.45)]">
      <div>
        <h2 className="text-lg font-bold">👋 {t('Welcome back!')}</h2>
        <p className="muted text-sm">{t('This device remembers you — no API key needed.')}</p>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-gold"
          disabled={resuming}
          onClick={async () => {
            setError(null);
            const err = await resume();
            if (err) setError(err);
            else navigate('/account', { replace: true });
          }}
        >
          {resuming ? t('Signing in…') : device.accountName ? t('Continue as {name}', { name: device.accountName }) : t('Continue')}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => void forgetThisDevice()} disabled={resuming}>
          {t('Forget this device')}
        </button>
      </div>
    </div>
  );
}

/** Account → the browsers that can sign back in with one click. */
function RememberedDevices() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const device = useStore((s) => s.device);
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [remember, setRemember] = useState(rememberPref());
  const [busy, setBusy] = useState(false);

  const load = () =>
    call<{ devices: DeviceRow[] }>('listMyDevices')
      .then((r) => setRows(r.devices))
      .catch(() => setRows([]));
  // Reload when this browser's token appears / changes (it's issued right after sign-in).
  const token = device?.token ?? null;
  useEffect(() => {
    let alive = true;
    void (token ? deviceRowId(token) : Promise.resolve(null)).then((id) => alive && setCurrent(id));
    call<{ devices: DeviceRow[] }>('listMyDevices')
      .then((r) => alive && setRows(r.devices))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [token]);

  const forget = async (ids?: string[]) => {
    setBusy(true);
    try {
      await call('forgetMyDevices', ids ? { ids } : {});
      // This browser's token was among them → drop it locally too.
      if (!ids || (current && ids.includes(current))) {
        clearDevice();
        useStore.setState({ device: null });
      }
      toast(t('Done.'), 'ok');
      await load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">📱 {t('Remembered devices')}</span>
        {!!rows?.length && (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => confirm(t('Forget every device? Each one then needs the API key again.')) && forget()}>
            {t('Forget all')}
          </button>
        )}
      </div>
      <p className="faint mb-2 text-xs">
        {t('You stay signed in until you sign out. A remembered device can sign back in with one click — it holds a random device token, never your API key. Unused tokens expire after 400 days.')}
      </p>
      {rows === null ? (
        <div className="skeleton h-8" />
      ) : rows.length === 0 ? (
        <p className="muted text-xs">{t('No remembered devices.')}</p>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-1.5">
              <span>
                {r.label} {r.id === current && <span className="chip chip-gold ml-1">{t('this device')}</span>}
                <span className="faint block text-xs">{t('last used {when}', { when: relative(r.lastUsedAt) })}</span>
              </span>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => forget([r.id])} aria-label={t('Forget')}>
                ✕ {t('Forget')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={remember}
          onChange={async (e) => {
            setRemember(e.target.checked);
            setRememberPref(e.target.checked);
            if (!e.target.checked && current) await forget([current]);
            else if (e.target.checked) await useStore.getState().rememberThisDevice();
          }}
        />
        {t('Remember me on this device')}
      </label>
    </div>
  );
}

/** The encrypted, server-side stored key as its owner sees it — never the key itself. */
function StoredKey({ info }: { info: StoredKeyInfo | null | undefined }) {
  const t = useT();
  const tz = useStore((s) => s.displayTz);
  const known = !!info?.last4;
  return (
    <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-semibold">🔑 {t('Stored API key')}</span>
        {info === null ? (
          <span className="chip">{t('none')}</span>
        ) : info?.status === 'invalid' ? (
          <span className="chip chip-red">⚠️ {t('rejected by ArenaNet')}</span>
        ) : info?.status === 'ok' ? (
          <span className="chip chip-green">✓ {t('working')}</span>
        ) : null}
      </div>
      {info === null ? (
        <p className="muted text-xs">{t('No key is stored — after a relink you’ll need to paste one again. Re-verify below to store one.')}</p>
      ) : known && info ? (

        <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="faint">{t('Key')}</dt>
          <dd className="font-mono">••••••••-••••-…-{info.last4}</dd>
          {info.name && (
            <>
              <dt className="faint">{t('Name')}</dt>
              <dd>“{info.name}”</dd>
            </>
          )}
          {info.permissions?.length > 0 && (
            <>
              <dt className="faint">{t('Permissions')}</dt>
              <dd>{info.permissions.join(', ')}</dd>
            </>
          )}
          <dt className="faint">{t('Saved')}</dt>
          <dd>{fmtDateTime(info.savedAt, tz)}</dd>
          {info.checkedAt && (
            <>
              <dt className="faint">{t('Last checked')}</dt>
              <dd>{relative(info.checkedAt)}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="muted text-xs">{t('A key is stored. Its details appear after the next re-check — press “Re-check my team now”.')}</p>
      )}
      <p className="faint mt-2 text-xs">
        {t('Encrypted on the server and only used to re-check your team after relinks — it is never sent back to your browser. You stay signed in on this device across refreshes until you sign out.')}
      </p>
    </div>
  );
}

function LanguagePref() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  return (
    <label className="max-w-sm">
      <span className="label">{t('Language')}</span>
      <select className="select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {UI_LANGS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Account() {
  const t = useT();
  useDocumentTitle(t('Account'));
  const navigate = useNavigate();
  const { uid, member, memberReady, authReady, toast, signOut, device } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(rememberPref());
  const [useKey, setUseKey] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast(ok, 'ok');
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setBusy(true);
    setError(null);
    const before = member?.teamId ?? null;
    try {
      const { result } = await call<{ result: 'ok' | 'stale' }>('refreshMe');
      if (result === 'stale') setError(t('Your stored key no longer works — paste a new key below to re-verify.'));
      else toast(t('Re-checked with the GW2 API.') + (before !== useStore.getState().member?.teamId ? ` ${t('Your team changed.')}` : ''), 'ok');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!authReady || (uid && !memberReady)) return <Skeleton h={300} />;

  if (!uid) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t('Sign in')} sub={t('Your Guild Wars 2 API key is your login — it also verifies your team, guilds and commander tag.')} />
        {error && (
          <div className="mb-4">
            <ErrorBox>{error}</ErrorBox>
          </div>
        )}
        {device && <WelcomeBack device={device} />}
        {device && !useKey ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setUseKey(true)}>
            🔑 {t('Use a different API key')}
          </button>
        ) : (
        <div className="card card-pad">
          <KeySteps />
          <KeyInput
            busy={busy}
            label={t('Sign in')}
            remember={{ value: remember, onChange: setRemember }}
            onSubmit={(key) =>
              run(async () => {
                setRememberPref(remember);
                const { token } = await call<{ token: string }>('signIn', { apiKey: key });
                await signInWithCustomToken(auth, token);
                navigate('/account', { replace: true });
              }, t('Signed in and verified!'))
            }
          />
          <p className="faint mt-3 text-xs">
            {t('The key is stored encrypted and only used to re-check your team after each relink. Your account name is never shown publicly — raids only show guild tags.')}{' '}
            <Link to="/privacy" className="underline">
              {t('Privacy')}
            </Link>
          </p>
        </div>
        )}
        <div className="card card-pad mt-4">
          <LanguagePref />
        </div>
      </div>
    );
  }

  if (!member) return <ErrorBox>{t('Your account record is missing — sign out and in again.')}</ErrorBox>;
  const verified = isVerified(member);

  if (uid === ADMIN_UID) {
    return (
      <div className="mx-auto grid max-w-3xl gap-5">
        <PageHeader
          title={t('Admin session')}
          sub={t('Signed in with the admin access key.')}
          actions={
            <button className="btn btn-sm" onClick={() => signOut()}>
              {t('Sign out')}
            </button>
          }
        />
        <div className="card card-pad grid gap-3 text-sm">
          <p>
            {t('You can see every team’s raids — including team-only raids with their voice and goals — and use the Moderation tools (reports, raid import, settings, moderators).')}
          </p>
          <p className="faint text-xs">{t('The admin session is never remembered on a device — after signing out, enter the admin key again.')}</p>
          <p className="muted">
            {t('This session has no GW2 account, so it can’t post raids itself (use Moderation → Import to list raids). To post, sign out and sign in with your own API key — put your account name in WVW_SECRETS.adminAccounts to keep admin rights there too.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/calendar" className="btn btn-gold btn-sm">
              {t('Open the calendar')}
            </Link>
            <Link to="/mod" className="btn btn-sm">
              {t('Moderation')}
            </Link>
          </div>
          <LanguagePref />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <PageHeader
        title={t('Your account')}
        sub={member.accountName ? `${member.accountName} · ${t('visible only to you')}` : undefined}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn btn-sm" onClick={() => signOut()} title={t('This device stays remembered — one click to sign back in.')}>
              {t('Sign out')}
            </button>
            {device && (
              <button className="btn btn-ghost btn-sm" onClick={() => signOut({ forget: true })} title={t('Use this on shared or public computers.')}>
                {t('Sign out & forget this device')}
              </button>
            )}
          </div>
        }
      />
      {error && <ErrorBox>{error}</ErrorBox>}

      {member.stale && (
        <Notice tone="warn">
          ⚠️ {t('A relink happened and we couldn’t re-check your team automatically (the stored key was removed or is invalid). Paste a key below to re-verify — until then your raids are on hold.')}
        </Notice>
      )}
      {!member.teamId && !member.stale && (
        <Notice>{t('Your account isn’t on a WvW team right now (no recent WvW activity or no WvW guild selected). You can browse, but posting raids needs a team.')}</Notice>
      )}

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{verified ? `✅ ${t('Verified')}` : t('Verification')}</h2>
          <button className="btn btn-sm" onClick={recheck} disabled={busy} title={t('Ask the GW2 API again for your team, guilds and commander tag (uses your stored key).')}>
            🔄 {busy ? t('Checking…') : t('Re-check my team now')}
          </button>
        </div>
        <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="label">{t('Current team')}</span>
            {member.teamId ? <TeamChip teamId={member.teamId} region={member.region} /> : '—'}
            {member.verifiedAt && <span className="faint mt-1 block text-xs">{t('checked {when}', { when: relative(member.verifiedAt) })}</span>}
          </div>
          <div>
            <span className="label">{t('Commander tag')}</span>
            {member.commander ? `✅ ${t('yes')}` : `— ${t('no')}`}
          </div>
          <div className="sm:col-span-2">
            <span className="label">{t('Your guilds')}</span>
            <div className="flex flex-wrap gap-1.5">
              {member.guilds.map((g) => (
                <Link
                  key={g.id}
                  to={`/guilds/${g.id}`}
                  className={`chip hover:border-[var(--gold)] hover:text-white ${g.leader ? 'chip-gold' : ''}`}
                  title={g.leader ? t('You lead this guild — open it to edit the guild page and recruitment') : t('Open the guild page')}
                >
                  [{g.tag}] {g.leader ? '👑' : ''} <span aria-hidden>›</span>
                </Link>
              ))}
              {!member.guilds.length && '—'}
            </div>
            {member.guilds.length > 0 && (
              <p className="faint mt-1.5 text-xs">
                {t('Click a guild to see its page. As leader (👑) you manage its profile and recruitment there. You can post raids for any of them.')}
              </p>
            )}
          </div>
        </div>
        <StoredKey info={member.keyInfo} />
        <RememberedDevices />
        <p className="faint mb-3 text-xs">
          {t('After every relink the hub re-checks everyone automatically within about an hour and moves your raids to your new team. Use the button if you want it right now.')}
        </p>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">{t('Re-verify with a new key')}</summary>
          <div className="mt-3">
            <KeySteps />
            <KeyInput busy={busy} label={t('Re-verify')} onSubmit={(key) => run(() => call('verifyApiKey', { apiKey: key }), t('Re-verified.'))} />
          </div>
        </details>
      </div>

      <div className="card card-pad grid gap-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{t('Preferences')}</h2>
        <LanguagePref />
        <label className="max-w-sm">
          <span className="label">{t('Default time zone for raids you post')}</span>
          <select className="select" value={member.prefs?.timezone ?? ''} onChange={(e) => run(() => call('updatePrefs', { timezone: e.target.value || null }), t('Saved.'))}>
            <option value="">{t('Use my browser ({tz})', { tz: browserTimeZone() })}</option>
            {COMMON_TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card card-pad">
        <h2 className="mb-2 font-bold">{t('Your data')}</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('forgetApiKey'), t('Stored API key deleted.'))}>
            {t('Forget my API key')}
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={async () => {
              if (!confirm(t('Delete your WvW Hub account and data? Your raids are cancelled. This cannot be undone.'))) return;
              if (await run(() => call('deleteMyData'), t('Your data was deleted.'))) await signOut({ forget: true });
            }}
          >
            {t('Delete my data')}
          </button>
        </div>
        <p className="faint mt-2 text-xs">
          {t('Also delete the key on account.arena.net if you no longer use it.')}{' '}
          <Link to="/privacy" className="underline">
            {t('What we store')}
          </Link>
        </p>
      </div>
    </div>
  );
}
