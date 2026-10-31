import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { useDocumentTitle, usePublicConfig } from '../lib/hooks';
import { COMMUNITY_RULES, LIMITS } from '../shared/constants';
import { KOFI_URL, LEGAL_URL } from '../config';

/** Render the rules' **bold** markers without dangerouslySetInnerHTML. */
function bolded(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export function Rules() {
  useDocumentTitle('Community rules');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Community rules" sub="The same rules apply on this website and in the WvW Hub Discord server." />
      <ol className="card card-pad grid gap-4">
        {COMMUNITY_RULES.map((r, i) => (
          <li key={i} className="leading-relaxed text-[#cbd5e1]">
            {bolded(r)}
          </li>
        ))}
      </ol>
      <p className="muted mt-4 text-sm">
        Spotted a problem? Use the 🚩 Report button on any raid, run or guild page (verified accounts).
      </p>
    </div>
  );
}

export function About() {
  useDocumentTitle('How it works');
  const config = usePublicConfig().data;
  return (
    <div className="prose-hub mx-auto max-w-3xl">
      <PageHeader title="How WvW Hub works" sub="A cross-guild, cross-team calendar for Guild Wars 2 World vs. World." />
      <h2>For everyone</h2>
      <ul>
        <li>The <Link to="/calendar">calendar</Link> lists every scheduled raid on every team, in your own time zone. Subscribe to a feed for any region, team or guild in Google/Apple/Outlook Calendar.</li>
        <li><Link to="/matchups">Matchups</Link>, relink and reset countdowns, and the <Link to="/guilds">guild directory</Link> come straight from the official GW2 API — no sign-up needed.</li>
        <li>Guild activity is measured from public objective claims, so the directory works even for guilds that never signed up.</li>
      </ul>
      <h2>Verification</h2>
      <ul>
        <li>Sign in with Discord, then paste a GW2 API key whose <em>name</em> contains your personal code. That proves the key was made for us and can’t be replayed from elsewhere.</li>
        <li>We read your guilds, whether you lead a guild, whether you own a commander tag, and your current WvW team. After every relink your team is re-checked automatically and your Discord roles follow.</li>
        <li><strong>Account names are never shown publicly.</strong> Raids are identified only by guild tag.</li>
      </ul>
      <h2>Commanders & guild leaders</h2>
      <ul>
        <li>Anyone verified with a commander tag can post raids for a guild they’re in (“member raid”). Guild leaders claim their guild page and hand out commander invite codes — raids from appointed commanders are marked “✓ official”.</li>
        <li>Raids can be posted on the website or with <code>/raid schedule</code> in Discord; both are announced in the hub. Go live with <code>/raid live</code>, end with <code>/raid end</code>.</li>
        <li>The map, voice link, goals and expected squad size are only shown to verified members of the raid’s own team — WvW is a competitive mode, so plans don’t leak to the enemy.</li>
      </ul>
      <h2>Stats & ratings</h2>
      <ul>
        <li>Each run records duration, check-ins, (optionally) hub voice headcounts and arcdps logs uploaded to dps.report — we keep counts only, never player names.</li>
        <li>Only players who checked in to a run can rate it, for {LIMITS.ratingWindowHours} hours, on four aspects. No free-text reviews. Guild averages appear only after {LIMITS.minRatingsToShow} different raters, and each person counts once.</li>
      </ul>
      <h2>Support</h2>
      <p>
        WvW Hub is a non-commercial passion project. If it helps your community, you can <a href={KOFI_URL}>buy me a coffee on Ko-fi</a>
        {config?.hubInviteUrl && (
          <>
            {' '}or <a href={config.hubInviteUrl}>join the Discord hub</a>
          </>
        )}
        .
      </p>
    </div>
  );
}

export function Privacy() {
  useDocumentTitle('Privacy');
  return (
    <div className="prose-hub mx-auto max-w-3xl">
      <PageHeader title="Privacy" sub="What WvW Hub stores, why, and how to delete it." />
      <h2>Without an account</h2>
      <p>Browsing is anonymous. Pages load data from our own Firebase backend (Google Cloud); your browser never contacts the GW2 API directly. We use no analytics or ad trackers. Your chosen display time zone is kept in your browser’s local storage.</p>
      <h2>With an account</h2>
      <ul>
        <li><strong>Discord:</strong> your Discord user id and display name (to sign you in and assign hub roles). We don’t keep Discord access tokens.</li>
        <li><strong>Guild Wars 2:</strong> account id and name, guild memberships, guild-leader status, commander-tag ownership and current WvW team — read via the API key you provide. The account name is visible only to you (and, if you’re an appointed commander, to your guild leader).</li>
        <li><strong>API key:</strong> stored encrypted (AES-256-GCM) and used only to re-check your team after relinks. Delete it any time on your Account page.</li>
        <li><strong>Activity:</strong> raids you post, runs you check in to, and your ratings (stored without being shown individually; only guild averages are published).</li>
        <li><strong>Reports</strong> you file are visible to moderators without your identity.</li>
      </ul>
      <h2>Deletion</h2>
      <p>“Delete my data” on the Account page removes your account, API key, check-ins, ratings and commander appointments, cancels your raids and removes your hub roles. Aggregated guild statistics stay. Objective-claim history is public game data and is purged after 120 days.</p>
      <h2>Legal</h2>
      <p>
        Operator, contact and legal notice: <a href={LEGAL_URL}>ranzlappen.com</a>. Under the GDPR you can request access, correction or deletion at any time.
      </p>
    </div>
  );
}

export function NotFound() {
  useDocumentTitle('Not found');
  return (
    <div className="py-16 text-center">
      <p className="text-6xl font-black text-[var(--gold)]">404</p>
      <p className="muted mt-2">This page fell off the cliffs of Stonemist.</p>
      <Link to="/" className="btn btn-gold mt-6">
        Back home
      </Link>
    </div>
  );
}
