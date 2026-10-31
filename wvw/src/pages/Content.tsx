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
      <PageHeader title="Community rules" sub="Rules for everyone posting or rating raids on the WvW Hub." />
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
        <li>Sign in by pasting a GW2 API key named <code>WvW Hub</code> (account, guilds and wvw permissions). The name proves the key was made for us — keys made for other tools aren’t accepted.</li>
        <li>We read your guilds, whether you lead a guild, whether you own a commander tag, and your current WvW team. After every relink your team is re-checked automatically.</li>
        <li><strong>Account names are never shown publicly.</strong> Raids are identified only by guild tag.</li>
      </ul>
      <h2>Posting raids</h2>
      <ul>
        <li>Any verified member of a guild can post raids for it — the GW2 API confirms the membership. Raids posted by the guild’s in-game leader carry the “✓ official” badge.</li>
        <li>Pick where you’ll lead on a map of the current matchup: each map is split into thirds, one per team colour, plus “Jumper” for cross-map play.</li>
        <li>The map third, voice link, goals and expected squad size are only shown to verified members of the raid’s own team — WvW is a competitive mode, so plans don’t leak to the enemy.</li>
        <li>The calendar runs week by week from Friday reset; switch between Day, Week, Link (until the next relink) and Month.</li>
      </ul>
      <h2>Stats & ratings</h2>
      <ul>
        <li>Each run records duration, check-ins and arcdps logs uploaded to dps.report — we keep counts only, never player names.</li>
        <li>Only players who checked in to a run can rate it, for {LIMITS.ratingWindowHours} hours, on four aspects. No free-text reviews. Guild averages appear only after {LIMITS.minRatingsToShow} different raters, and each person counts once.</li>
      </ul>
      <h2>Support</h2>
      <p>
        WvW Hub is a non-commercial passion project. If it helps your community, you can <a href={KOFI_URL}>buy me a coffee on Ko-fi</a>
        {config?.hubInviteUrl && (
          <>
            {' '}or <a href={config.hubInviteUrl}>join the community Discord</a>
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
        <li><strong>Guild Wars 2:</strong> account id and name, guild memberships, guild-leader status, commander-tag ownership and current WvW team — read via the API key you sign in with. The account name is visible only to you (and to admins when promoting moderators).</li>
        <li><strong>API key:</strong> stored encrypted (AES-256-GCM) and used only to re-check your team after relinks. Delete it any time on your Account page.</li>
        <li><strong>Activity:</strong> raids you post, runs you check in to, and your ratings (stored without being shown individually; only guild averages are published).</li>
        <li><strong>Reports</strong> you file are visible to moderators without your identity.</li>
      </ul>
      <h2>Deletion</h2>
      <p>“Delete my data” on the Account page removes your account, API key, check-ins and ratings and cancels your raids. Aggregated guild statistics stay. Objective-claim history is public game data and is purged after 120 days.</p>
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
