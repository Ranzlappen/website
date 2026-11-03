import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { useDocumentTitle, usePublicConfig } from '../lib/hooks';
import { COMMUNITY_RULES, LIMITS } from '../shared/constants';
import { KOFI_URL, LEGAL_URL } from '../config';
import { msg, useT } from '../i18n';
import { rich } from '../lib/rich';

/** Render the rules' **bold** markers without dangerouslySetInnerHTML. */
function bolded(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export function Rules() {
  const t = useT();
  useDocumentTitle(t('Community rules'));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('Community rules')} sub={t('Rules for everyone posting or rating raids on the WvW Hub.')} />
      <ol className="card card-pad grid gap-4">
        {COMMUNITY_RULES.map((r, i) => (
          <li key={i} className="leading-relaxed text-[#cbd5e1]">
            {bolded(t(r))}
          </li>
        ))}
      </ol>
      <p className="muted mt-4 text-sm">{t('Spotted a problem? Use the 🚩 Report button on any raid, run or guild page (verified accounts).')}</p>
    </div>
  );
}

/** About page: [heading, paragraphs[]] — every string is a dictionary key (markup: lib/rich.tsx). */
const ABOUT: [string, string[]][] = [
  [
    msg('For everyone'),
    [
      msg('The [calendar](/calendar) opens on the **matchup map**: all four maps plus a Jumper section, with every raid of the three teams placed in the third of the team that organises it (a red-team raid on EBG sits in EBG’s red third). Day, Week, Link and Month views list the same raids week by week from reset, in your own time zone.'),
      msg('**Subscribe** adds a live feed for a region, team or guild to Google / Apple / Outlook Calendar — your calendar app then reminds you. The website itself sends no notifications.'),
      msg('[Matchups](/matchups), relink and reset countdowns and the [guild directory](/guilds) come straight from the official GW2 API — no sign-up needed. Guild activity is measured from public objective claims.'),
    ],
  ],
  [
    msg('Verification'),
    [
      msg('Sign in by pasting a GW2 API key named `WvW Hub` (account, guilds and wvw permissions). The name proves the key was made for us — keys made for other tools aren’t accepted.'),
      msg('We read your guilds, whether you lead a guild, whether you own a commander tag, and your current WvW team. After every relink everyone is re-checked automatically and raids move to their commander’s new team; “Re-check my team now” on the Account page does it instantly.'),
      msg('**Account names are never shown publicly.** Raids are identified only by guild tag — or shown as independent raids.'),
    ],
  ],
  [
    msg('Posting raids'),
    [
      msg('Any verified member of a guild can post raids for it — the GW2 API confirms the membership. Raids posted by the guild’s in-game leader carry the “✓ official” badge. You can also post an **independent raid** without a guild.'),
      msg('Pick the map (EBG or a borderland) or “Jumper” for cross-map play. Where it shows on the matchup map follows from your team’s colour.'),
      msg('Choose who sees it: **Everyone** (time, map and guild are public; voice, goals and notes stay with your team) or **Only my team** (the raid is hidden from the other teams entirely).'),
    ],
  ],
  [
    msg('Stats & ratings'),
    [
      msg('Each run records duration, check-ins and arcdps logs uploaded to dps.report — we keep counts only, never player names.'),
      msg('Only players who checked in to a run can rate it, for {hours} hours, on four aspects. No free-text reviews. Guild averages appear only after {raters} different raters, and each person counts once.'),
    ],
  ],
];

const PRIVACY: [string, string[]][] = [
  [
    msg('Without an account'),
    [
      msg('Browsing is anonymous. Pages load data from our own Firebase backend (Google Cloud); your browser never contacts the GW2 API directly. We use no analytics or ad trackers. Your chosen display time zone and language are kept in your browser’s local storage.'),
    ],
  ],
  [
    msg('With an account'),
    [
      msg('**Guild Wars 2:** account id and name, guild memberships, guild-leader status, commander-tag ownership and current WvW team — read via the API key you sign in with. The account name is visible only to you (and to admins for moderation).'),
      msg('**API key:** stored encrypted (AES-256-GCM) and used only to re-check your team after relinks. Delete it any time on your Account page.'),
      msg('**Activity:** raids you post, runs you check in to, and your ratings (stored without being shown individually; only guild averages are published).'),
      msg('**Reports** you file are visible to moderators without your identity. If an account is banned for breaking the rules, its GW2 account id and name are kept on a block list.'),
    ],
  ],
  [
    msg('Deletion'),
    [
      msg('“Delete my data” on the Account page removes your account, API key, check-ins and ratings and cancels your raids. Aggregated guild statistics stay. Objective-claim history is public game data and is purged after 120 days.'),
    ],
  ],
  [
    msg('Legal'),
    [msg('Operator, contact and legal notice: [ranzlappen.com]({legal}). Under the GDPR you can request access, correction or deletion at any time.')],
  ],
];

function Prose({ sections, vars }: { sections: [string, string[]][]; vars: Record<string, string | number> }) {
  const t = useT();
  return (
    <>
      {sections.map(([h, ps]) => (
        <section key={h}>
          <h2>{t(h)}</h2>
          {ps.length > 1 ? (
            <ul>
              {ps.map((p) => (
                <li key={p}>{rich(t(p, vars))}</li>
              ))}
            </ul>
          ) : (
            <p>{rich(t(ps[0], vars))}</p>
          )}
        </section>
      ))}
    </>
  );
}

export function About() {
  const t = useT();
  useDocumentTitle(t('How it works'));
  const config = usePublicConfig().data;
  return (
    <div className="prose-hub mx-auto max-w-3xl">
      <PageHeader title={t('How WvW Hub works')} sub={t('A cross-guild, cross-team calendar for Guild Wars 2 World vs. World.')} />
      <Prose sections={ABOUT} vars={{ hours: LIMITS.ratingWindowHours, raters: LIMITS.minRatingsToShow }} />
      <h2>{t('Support')}</h2>
      <p>{rich(t('WvW Hub is a non-commercial passion project. If it helps your community, you can [buy me a coffee on Ko-fi]({kofi}).', { kofi: KOFI_URL }))}</p>
      {config?.hubInviteUrl && <p>{rich(t('Come and say hi in the [community Discord]({discord}).', { discord: config.hubInviteUrl }))}</p>}
    </div>
  );
}

export function Privacy() {
  const t = useT();
  useDocumentTitle(t('Privacy'));
  return (
    <div className="prose-hub mx-auto max-w-3xl">
      <PageHeader title={t('Privacy')} sub={t('What WvW Hub stores, why, and how to delete it.')} />
      <Prose sections={PRIVACY} vars={{ legal: LEGAL_URL }} />
    </div>
  );
}

export function NotFound() {
  const t = useT();
  useDocumentTitle(t('Not found'));
  return (
    <div className="py-16 text-center">
      <p className="text-6xl font-black text-[var(--gold)]">404</p>
      <p className="muted mt-2">{t('This page fell off the cliffs of Stonemist.')}</p>
      <Link to="/" className="btn btn-gold mt-6">
        {t('Back home')}
      </Link>
    </div>
  );
}
