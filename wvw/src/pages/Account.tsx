import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { ErrorBox, Notice, PageHeader, Skeleton, TeamChip } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';
import { auth, call, errorMessage } from '../firebase';
import { API_KEY_URL, KEY_NAME } from '../config';

const ADMIN_UID = 'wvw-admin';
import { isVerified, useStore } from '../store';
import { COMMON_TIMEZONES } from '../shared/constants';
import { browserTimeZone } from '../lib/format';

function KeySteps() {
  return (
    <ol className="muted mb-4 list-decimal space-y-1.5 pl-5 text-sm">
      <li>
        Open{' '}
        <a href={API_KEY_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] underline">
          account.arena.net/applications
        </a>{' '}
        → <b>New Key</b>.
      </li>
      <li>
        Name it <code className="rounded bg-[var(--bg-2)] px-2 py-0.5 font-mono font-bold text-[var(--gold)]">{KEY_NAME}</code>{' '}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(KEY_NAME)}>
          copy
        </button>{' '}
        — keys made for other tools aren’t accepted.
      </li>
      <li>
        Tick <b>account</b>, <b>guilds</b> and <b>wvw</b> (nothing else is needed), create it and paste it below.
      </li>
    </ol>
  );
}

function KeyInput({ busy, label, onSubmit }: { busy: boolean; label: string; onSubmit: (key: string) => Promise<boolean> }) {
  const [key, setKey] = useState('');
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
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
        aria-label="GW2 API key"
      />
      <button className="btn btn-gold" disabled={busy || key.trim().length < 6}>
        {busy ? 'Checking…' : label}
      </button>
    </form>
  );
}

export default function Account() {
  useDocumentTitle('Account');
  const navigate = useNavigate();
  const { uid, member, memberReady, authReady, toast, signOut } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!authReady || (uid && !memberReady)) return <Skeleton h={300} />;

  if (!uid) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Sign in" sub="Your Guild Wars 2 API key is your login — it also verifies your team, guilds and commander tag." />
        {error && (
          <div className="mb-4">
            <ErrorBox>{error}</ErrorBox>
          </div>
        )}
        <div className="card card-pad">
          <KeySteps />
          <KeyInput
            busy={busy}
            label="Sign in"
            onSubmit={(key) =>
              run(async () => {
                const { token } = await call<{ token: string }>('signIn', { apiKey: key });
                await signInWithCustomToken(auth, token);
                navigate('/account', { replace: true });
              }, 'Signed in and verified!')
            }
          />
          <p className="faint mt-3 text-xs">
            The key is stored encrypted and only used to re-check your team after each relink. Your account name is never shown publicly —
            raids only show guild tags. <Link to="/privacy" className="underline">Privacy</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!member) return <ErrorBox>Your account record is missing — sign out and in again.</ErrorBox>;
  const verified = isVerified(member);

  if (uid === ADMIN_UID) {
    return (
      <div className="mx-auto grid max-w-3xl gap-5">
        <PageHeader
          title="Admin session"
          sub="Signed in with the admin access key."
          actions={
            <button className="btn btn-sm" onClick={() => signOut()}>
              Sign out
            </button>
          }
        />
        <div className="card card-pad grid gap-3 text-sm">
          <p>
            You can see <b>every team’s raids</b> — including team-only raids and their map third, voice and goals — and use the{' '}
            <Link to="/mod" className="text-[var(--gold)] underline">Moderation</Link> tools (reports, settings, moderators).
          </p>
          <p className="muted">
            This session has no GW2 account, so it can’t post raids. To post, sign out and sign in with your own API key — put your account
            name in <code>WVW_SECRETS.adminAccounts</code> to keep admin rights there too.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/calendar" className="btn btn-gold btn-sm">Open the calendar</Link>
            <Link to="/mod" className="btn btn-sm">Moderation</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <PageHeader
        title="Your account"
        sub={member.accountName ? `${member.accountName} · visible only to you` : undefined}
        actions={
          <button className="btn btn-sm" onClick={() => signOut()}>
            Sign out
          </button>
        }
      />
      {error && <ErrorBox>{error}</ErrorBox>}

      {member.stale && (
        <Notice tone="warn">
          ⚠️ A relink happened and we couldn’t re-check your team automatically (the stored key was removed or is invalid). Paste a key below to
          re-verify — until then your raids are on hold.
        </Notice>
      )}
      {!member.teamId && !member.stale && (
        <Notice>Your account isn’t on a WvW team right now (no recent WvW activity or no WvW guild selected). You can browse, but posting raids needs a team.</Notice>
      )}

      <div className="card card-pad">
        <h2 className="mb-3 font-bold">{verified ? '✅ Verified' : 'Verification'}</h2>
        <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="label">Current team</span>
            {member.teamId ? <TeamChip teamId={member.teamId} region={member.region} /> : '—'}
          </div>
          <div>
            <span className="label">Commander tag</span>
            {member.commander ? '✅ yes' : '— no'}
          </div>
          <div className="sm:col-span-2">
            <span className="label">Guilds — you can post raids for any of them</span>
            <div className="flex flex-wrap gap-1.5">
              {member.guilds.map((g) => (
                <Link key={g.id} to={`/guilds/${g.id}`} className={`chip ${g.leader ? 'chip-gold' : ''}`} title={g.leader ? 'You lead this guild — your raids show ✓ official' : undefined}>
                  [{g.tag}] {g.leader ? '👑' : ''}
                </Link>
              ))}
              {!member.guilds.length && '—'}
            </div>
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Re-verify with a new key</summary>
          <div className="mt-3">
            <KeySteps />
            <KeyInput busy={busy} label="Re-verify" onSubmit={(key) => run(() => call('verifyApiKey', { apiKey: key }), 'Re-verified.')} />
          </div>
        </details>
      </div>

      <div className="card card-pad grid gap-4">
        <h2 className="font-bold">Preferences</h2>
        <label className="max-w-sm">
          <span className="label">Default time zone for raids you post</span>
          <select className="select" value={member.prefs?.timezone ?? ''} onChange={(e) => run(() => call('updatePrefs', { timezone: e.target.value || null }), 'Saved.')}>
            <option value="">Use my browser ({browserTimeZone()})</option>
            {COMMON_TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card card-pad">
        <h2 className="mb-2 font-bold">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('forgetApiKey'), 'Stored API key deleted.')}>
            Forget my API key
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={async () => {
              if (!confirm('Delete your WvW Hub account and data? Your raids are cancelled. This cannot be undone.')) return;
              if (await run(() => call('deleteMyData'), 'Your data was deleted.')) await signOut();
            }}
          >
            Delete my data
          </button>
        </div>
        <p className="faint mt-2 text-xs">
          Also delete the key on account.arena.net if you no longer use it. <Link to="/privacy" className="underline">What we store</Link>
        </p>
      </div>
    </div>
  );
}
