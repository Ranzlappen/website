import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { useDocumentTitle, usePublicConfig } from '../lib/hooks';
import { COMMUNITY_RULES, LIMITS } from '../shared/constants';
import { KOFI_URL, LEGAL_URL } from '../config';
import { useStore } from '../store';
import { useT } from '../i18n';

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

function AboutEn({ discord }: { discord: string | null }) {
  return (
    <>
      <h2>For everyone</h2>
      <ul>
        <li>
          The <Link to="/calendar">calendar</Link> opens on the <b>matchup map</b>: all four maps plus a Jumper section, with every raid of the
          three teams placed in the third of the team that organises it (a red-team raid on EBG sits in EBG’s red third). Day, Week, Link and Month
          views list the same raids week by week from reset, in your own time zone.
        </li>
        <li>
          <b>Subscribe</b> adds a live feed for a region, team or guild to Google / Apple / Outlook Calendar — your calendar app then reminds you.
          The website itself sends no notifications.
        </li>
        <li>
          <Link to="/matchups">Matchups</Link>, relink and reset countdowns and the <Link to="/guilds">guild directory</Link> come straight from the
          official GW2 API — no sign-up needed. Guild activity is measured from public objective claims.
        </li>
      </ul>
      <h2>Verification</h2>
      <ul>
        <li>
          Sign in by pasting a GW2 API key named <code>WvW Hub</code> (account, guilds and wvw permissions). The name proves the key was made for
          us — keys made for other tools aren’t accepted.
        </li>
        <li>
          We read your guilds, whether you lead a guild, whether you own a commander tag, and your current WvW team. After every relink everyone is
          re-checked automatically and raids move to their commander’s new team; “Re-check my team now” on the Account page does it instantly.
        </li>
        <li>
          <strong>Account names are never shown publicly.</strong> Raids are identified only by guild tag.
        </li>
      </ul>
      <h2>Posting raids</h2>
      <ul>
        <li>
          Any verified member of a guild can post raids for it — the GW2 API confirms the membership. Raids posted by the guild’s in-game leader
          carry the “✓ official” badge.
        </li>
        <li>Pick the map (EBG or a borderland) or “Jumper” for cross-map play. Where it shows on the matchup map follows from your team’s colour.</li>
        <li>
          Choose who sees it: <b>Everyone</b> (time, map and guild are public; voice, goals and notes stay with your team) or <b>Only my team</b> (the
          raid is hidden from the other teams entirely).
        </li>
      </ul>
      <h2>Stats & ratings</h2>
      <ul>
        <li>Each run records duration, check-ins and arcdps logs uploaded to dps.report — we keep counts only, never player names.</li>
        <li>
          Only players who checked in to a run can rate it, for {LIMITS.ratingWindowHours} hours, on four aspects. No free-text reviews. Guild
          averages appear only after {LIMITS.minRatingsToShow} different raters, and each person counts once.
        </li>
      </ul>
      <h2>Support</h2>
      <p>
        WvW Hub is a non-commercial passion project. If it helps your community, you can <a href={KOFI_URL}>buy me a coffee on Ko-fi</a>
        {discord && (
          <>
            {' '}
            or <a href={discord}>join the community Discord</a>
          </>
        )}
        .
      </p>
    </>
  );
}

function AboutDe({ discord }: { discord: string | null }) {
  return (
    <>
      <h2>Für alle</h2>
      <ul>
        <li>
          Der <Link to="/calendar">Kalender</Link> startet mit der <b>Matchup-Karte</b>: alle vier Karten plus ein Jumper-Bereich, jeder Raid der
          drei Teams im Drittel des Teams, das ihn organisiert (ein Raid des roten Teams auf den Ewigen Schlachtfeldern steht im roten Drittel).
          Die Ansichten Tag, Woche, Link und Monat zeigen dieselben Raids Woche für Woche ab Reset, in deiner Zeitzone.
        </li>
        <li>
          <b>Abonnieren</b> fügt einen Live-Feed für Region, Team oder Gilde zu Google / Apple / Outlook Kalender hinzu — die Erinnerung kommt dann
          von deiner Kalender-App. Die Website selbst verschickt keine Benachrichtigungen.
        </li>
        <li>
          <Link to="/matchups">Matchups</Link>, Relink- und Reset-Countdowns und das <Link to="/guilds">Gildenverzeichnis</Link> kommen direkt aus
          der offiziellen GW2-API — ohne Anmeldung. Gildenaktivität wird aus öffentlichen Zielobjekt-Beanspruchungen gemessen.
        </li>
      </ul>
      <h2>Verifizierung</h2>
      <ul>
        <li>
          Du meldest dich mit einem GW2-API-Schlüssel namens <code>WvW Hub</code> an (Berechtigungen account, guilds und wvw). Der Name beweist,
          dass der Schlüssel für uns erstellt wurde — Schlüssel anderer Tools werden nicht akzeptiert.
        </li>
        <li>
          Wir lesen deine Gilden, ob du eine Gilde leitest, ob du ein Kommandeur-Abzeichen besitzt, und dein aktuelles WvW-Team. Nach jedem Relink
          werden alle automatisch neu geprüft und Raids wandern ins neue Team ihres Kommandeurs; „Mein Team jetzt neu prüfen“ auf der Konto-Seite
          macht das sofort.
        </li>
        <li>
          <strong>Accountnamen werden nie öffentlich angezeigt.</strong> Raids erkennt man nur am Gildenkürzel.
        </li>
      </ul>
      <h2>Raids eintragen</h2>
      <ul>
        <li>
          Jedes verifizierte Mitglied einer Gilde kann Raids für sie eintragen — die GW2-API bestätigt die Mitgliedschaft. Raids des Gildenleiters
          tragen das Abzeichen „✓ offiziell“.
        </li>
        <li>
          Wähle die Karte (Ewige Schlachtfelder oder ein Grenzland) oder „Jumper“ für kartenübergreifendes Spiel. Wo der Raid auf der Matchup-Karte
          erscheint, ergibt sich aus der Farbe deines Teams.
        </li>
        <li>
          Wähle, wer ihn sieht: <b>Alle</b> (Zeit, Karte und Gilde sind öffentlich; Voice, Ziele und Notizen bleiben im Team) oder <b>Nur mein Team</b>{' '}
          (der Raid ist für die anderen Teams komplett unsichtbar).
        </li>
      </ul>
      <h2>Statistiken & Bewertungen</h2>
      <ul>
        <li>Jeder Lauf speichert Dauer, Check-ins und auf dps.report hochgeladene arcdps-Logs — wir behalten nur Zahlen, nie Spielernamen.</li>
        <li>
          Nur wer bei einem Lauf eingecheckt hat, kann ihn {LIMITS.ratingWindowHours} Stunden lang in vier Kategorien bewerten. Keine Freitexte.
          Gildendurchschnitte erscheinen erst ab {LIMITS.minRatingsToShow} verschiedenen Bewertenden, und jede Person zählt einmal.
        </li>
      </ul>
      <h2>Unterstützen</h2>
      <p>
        WvW Hub ist ein nicht-kommerzielles Herzensprojekt. Wenn es deiner Community hilft, kannst du mir <a href={KOFI_URL}>auf Ko-fi einen Kaffee spendieren</a>
        {discord && (
          <>
            {' '}
            oder <a href={discord}>dem Community-Discord beitreten</a>
          </>
        )}
        .
      </p>
    </>
  );
}

export function About() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  useDocumentTitle(t('How it works'));
  const config = usePublicConfig().data;
  return (
    <div className="prose-hub mx-auto max-w-3xl">
      <PageHeader title={t('How WvW Hub works')} sub={t('A cross-guild, cross-team calendar for Guild Wars 2 World vs. World.')} />
      {lang === 'de' ? <AboutDe discord={config?.hubInviteUrl ?? null} /> : <AboutEn discord={config?.hubInviteUrl ?? null} />}
    </div>
  );
}

function PrivacyEn() {
  return (
    <>
      <h2>Without an account</h2>
      <p>
        Browsing is anonymous. Pages load data from our own Firebase backend (Google Cloud); your browser never contacts the GW2 API directly. We use
        no analytics or ad trackers. Your chosen display time zone and language are kept in your browser’s local storage.
      </p>
      <h2>With an account</h2>
      <ul>
        <li>
          <strong>Guild Wars 2:</strong> account id and name, guild memberships, guild-leader status, commander-tag ownership and current WvW team —
          read via the API key you sign in with. The account name is visible only to you (and to admins when promoting moderators).
        </li>
        <li>
          <strong>API key:</strong> stored encrypted (AES-256-GCM) and used only to re-check your team after relinks. Delete it any time on your
          Account page.
        </li>
        <li>
          <strong>Activity:</strong> raids you post, runs you check in to, and your ratings (stored without being shown individually; only guild
          averages are published).
        </li>
        <li>
          <strong>Reports</strong> you file are visible to moderators without your identity.
        </li>
      </ul>
      <h2>Deletion</h2>
      <p>
        “Delete my data” on the Account page removes your account, API key, check-ins and ratings and cancels your raids. Aggregated guild
        statistics stay. Objective-claim history is public game data and is purged after 120 days.
      </p>
      <h2>Legal</h2>
      <p>
        Operator, contact and legal notice: <a href={LEGAL_URL}>ranzlappen.com</a>. Under the GDPR you can request access, correction or deletion at
        any time.
      </p>
    </>
  );
}

function PrivacyDe() {
  return (
    <>
      <h2>Ohne Konto</h2>
      <p>
        Das Stöbern ist anonym. Die Seiten laden Daten aus unserem eigenen Firebase-Backend (Google Cloud); dein Browser kontaktiert die GW2-API nie
        direkt. Wir verwenden keine Analyse- oder Werbe-Tracker. Deine gewählte Zeitzone und Sprache werden im lokalen Speicher deines Browsers
        abgelegt.
      </p>
      <h2>Mit Konto</h2>
      <ul>
        <li>
          <strong>Guild Wars 2:</strong> Account-ID und -Name, Gildenmitgliedschaften, Gildenleiter-Status, Kommandeur-Abzeichen und aktuelles
          WvW-Team — gelesen über den API-Schlüssel, mit dem du dich anmeldest. Der Accountname ist nur für dich sichtbar (und für Admins beim
          Ernennen von Moderatoren).
        </li>
        <li>
          <strong>API-Schlüssel:</strong> verschlüsselt gespeichert (AES-256-GCM) und nur genutzt, um dein Team nach Relinks neu zu prüfen. Du kannst
          ihn jederzeit auf deiner Konto-Seite löschen.
        </li>
        <li>
          <strong>Aktivität:</strong> Raids, die du einträgst, Läufe, bei denen du eincheckst, und deine Bewertungen (nicht einzeln angezeigt; nur
          Gildendurchschnitte werden veröffentlicht).
        </li>
        <li>
          <strong>Meldungen</strong>, die du einreichst, sehen Moderatoren ohne deine Identität.
        </li>
      </ul>
      <h2>Löschung</h2>
      <p>
        „Meine Daten löschen“ auf der Konto-Seite entfernt dein Konto, deinen API-Schlüssel, Check-ins und Bewertungen und sagt deine Raids ab.
        Aggregierte Gildenstatistiken bleiben bestehen. Die Historie der Zielobjekt-Beanspruchungen ist öffentliche Spieldaten und wird nach 120
        Tagen gelöscht.
      </p>
      <h2>Rechtliches</h2>
      <p>
        Betreiber, Kontakt und Impressum: <a href={LEGAL_URL}>ranzlappen.com</a>. Nach der DSGVO kannst du jederzeit Auskunft, Berichtigung oder
        Löschung verlangen.
      </p>
    </>
  );
}

export function Privacy() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  useDocumentTitle(t('Privacy'));
  return (
    <div className="prose-hub mx-auto max-w-3xl">
      <PageHeader title={t('Privacy')} sub={t('What WvW Hub stores, why, and how to delete it.')} />
      {lang === 'de' ? <PrivacyDe /> : <PrivacyEn />}
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
