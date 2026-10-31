import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox, Notice, PageHeader, Skeleton, TeamChip } from '../components/ui';
import { useDocumentTitle, usePublicConfig } from '../lib/hooks';
import { call, errorMessage } from '../firebase';
import { API_KEY_URL } from '../config';
import { isVerified, useStore } from '../store';
import { COMMON_TIMEZONES } from '../shared/constants';
import { browserTimeZone } from '../lib/format';
import { discordConfigured, startDiscordLogin } from '../lib/discordAuth';

export default function Account() {
  useDocumentTitle('Account');
  const { uid, member, memberReady, authReady, toast, signOut } = useStore();
  const config = usePublicConfig().data;
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authReady || (uid && !memberReady)) return <Skeleton h={300} />;

  if (!uid) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Sign in" sub="WvW Hub uses your Discord account to sign in and your GW2 API key to verify team, guilds and commander tag." />
        <div className="card card-pad">
          {discordConfigured() ? (
            <button className="btn btn-discord w-full" onClick={() => startDiscordLogin()}>
              Sign in with Discord
            </button>
          ) : (
            <Notice tone="warn">Discord login isn’t configured yet (site setup in progress).</Notice>
          )}
          <p className="faint mt-3 text-xs">
            We store your Discord id + display name and, after verification, your GW2 account details. Your account name is never shown
            publicly. <Link to="/privacy" className="underline">Privacy</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!member) return <ErrorBox>Your account record is missing — sign out and in again.</ErrorBox>;
  const verified = isVerified(member);

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

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <PageHeader
        title="Your account"
        sub={`Signed in with Discord as ${member.discordName}`}
        actions={
          <button className="btn btn-sm" onClick={() => signOut()}>
            Sign out
          </button>
        }
      />
      {error && <ErrorBox>{error}</ErrorBox>}

      {member.stale && (
        <Notice tone="warn">
          ⚠️ A relink happened and we couldn’t re-check your team automatically (the stored key was removed or invalid). Paste a key below to
          re-verify.
        </Notice>
      )}

      <div className="card card-pad">
        <h2 className="mb-3 font-bold">{verified ? '✅ Verified' : 'Verify your Guild Wars 2 account'}</h2>
        {verified && (
          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="label">GW2 account (private)</span>
              {member.accountName}
            </div>
            <div>
              <span className="label">Current team</span>
              <TeamChip teamId={member.teamId} region={member.region} />
            </div>
            <div>
              <span className="label">Commander tag</span>
              {member.commander ? '✅ yes' : '— no'}
            </div>
            <div>
              <span className="label">Guilds</span>
              <div className="flex flex-wrap gap-1.5">
                {member.guilds.map((g) => (
                  <Link key={g.id} to={`/guilds/${g.id}`} className="chip">
                    [{g.tag}] {g.leader ? '👑' : g.appointed ? '⭐' : ''}
                  </Link>
                ))}
                {!member.guilds.length && '—'}
              </div>
            </div>
          </div>
        )}
        <ol className="muted mb-4 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Open <a href={API_KEY_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] underline">account.arena.net/applications</a> → New key.
          </li>
          <li>
            Name it so it contains your code:{' '}
            <code className="rounded bg-[var(--bg-2)] px-2 py-0.5 font-mono font-bold text-[var(--gold)]">WvW Hub {member.challenge}</code>{' '}
            <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(`WvW Hub ${member.challenge}`)}>
              copy
            </button>
          </li>
          <li>
            Tick <b>account</b>, <b>guilds</b> and <b>wvw</b> (nothing else is needed), create it and paste it here.
          </li>
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input font-mono"
            placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXXXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="btn btn-gold"
            disabled={busy || key.trim().length < 20}
            onClick={async () => {
              if (await run(() => call('verifyApiKey', { apiKey: key.trim() }), 'Verified! Your Discord roles update in a moment.')) setKey('');
            }}
          >
            {busy ? 'Checking…' : verified ? 'Re-verify' : 'Verify'}
          </button>
        </div>
        <p className="faint mt-2 text-xs">
          The key is encrypted and used only to re-check your team after each relink. You can make us forget it below at any time (you’ll then
          need to re-verify after the next relink).
        </p>
      </div>

      {verified && member.commander && (
        <div className="card card-pad">
          <h2 className="mb-2 font-bold">⭐ Commander invite code</h2>
          <p className="muted mb-3 text-sm">Got a code from your guild leader? Redeem it to post official raids for that guild.</p>
          <div className="flex gap-2">
            <input className="input max-w-xs font-mono uppercase" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD2345" />
            <button
              className="btn"
              disabled={busy || code.trim().length !== 8}
              onClick={async () => {
                if (await run(() => call('redeemCommanderInvite', { code: code.trim() }), 'You are now an appointed commander.')) setCode('');
              }}
            >
              Redeem
            </button>
          </div>
        </div>
      )}

      <div className="card card-pad grid gap-4">
        <h2 className="font-bold">Preferences</h2>
        <label className="max-w-sm">
          <span className="label">Default time zone for raids you post</span>
          <select
            className="select"
            value={member.prefs?.timezone ?? ''}
            onChange={(e) => run(() => call('updatePrefs', { timezone: e.target.value || null }), 'Saved.')}
          >
            <option value="">Use my browser ({browserTimeZone()})</option>
            {COMMON_TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={member.prefs?.hubAutoJoin !== false}
            onChange={(e) => run(() => call('updatePrefs', { hubAutoJoin: e.target.checked }), 'Saved.')}
          />
          Add me to the WvW Hub Discord server when I sign in
          {config?.hubInviteUrl && (
            <a href={config.hubInviteUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] underline">
              (or join manually)
            </a>
          )}
        </label>
      </div>

      <div className="card card-pad">
        <h2 className="mb-2 font-bold">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('rotateChallenge'), 'New verification code generated.')}>
            New verification code
          </button>
          <button className="btn btn-sm" disabled={busy} onClick={() => run(() => call('forgetApiKey'), 'Stored API key deleted.')}>
            Forget my API key
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={async () => {
              if (!confirm('Delete your WvW Hub account and data? Your raids are cancelled and your hub roles removed. This cannot be undone.')) return;
              if (await run(() => call('deleteMyData'), 'Your data was deleted.')) await signOut();
            }}
          >
            Delete my data
          </button>
        </div>
        <p className="faint mt-2 text-xs">
          Also delete the API key on account.arena.net if you no longer use it. <Link to="/privacy" className="underline">What we store</Link>
        </p>
      </div>
    </div>
  );
}
