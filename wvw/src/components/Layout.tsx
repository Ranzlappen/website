import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { KOFI_URL, LEGAL_URL, MAIN_SITE } from '../config';
import { usePublicConfig } from '../lib/hooks';
import { isMod, isVerified, useStore } from '../store';
import { team } from '../lib/format';
import { discordConfigured, startDiscordLogin } from '../lib/discordAuth';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/matchups', label: 'Matchups' },
  { to: '/guilds', label: 'Guilds' },
];

function AccountButton() {
  const { uid, member, authReady } = useStore();
  const config = usePublicConfig().data;
  if (!authReady) return <span className="skeleton inline-block h-8 w-24" />;
  if (!uid) {
    return (
      <button className="btn btn-discord btn-sm" onClick={() => discordConfigured() && startDiscordLogin()} disabled={!discordConfigured()} title={discordConfigured() ? undefined : 'Discord login is not configured yet'}>
        Sign in with Discord
      </button>
    );
  }
  const verified = isVerified(member);
  return (
    <Link to="/account" className="btn btn-sm">
      <span className={`h-2 w-2 rounded-full ${verified ? 'bg-green-400' : member?.stale ? 'bg-orange-400' : 'bg-slate-500'}`} />
      <span className="max-w-[9rem] truncate">{verified ? team(member!.teamId, config?.teamNames) : member?.discordName ?? 'Account'}</span>
    </Link>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const member = useStore((s) => s.member);
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismiss);
  const config = usePublicConfig().data;
  const nav = [
    ...NAV,
    ...(member?.commander && isVerified(member) ? [{ to: '/my-raids', label: 'My raids' }] : []),
    ...(isMod(member) ? [{ to: '/mod', label: 'Moderation' }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 btn btn-gold">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(12,16,22,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight" onClick={() => setOpen(false)}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
            <span>
              WvW <span className="text-[var(--gold)]">Hub</span>
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-[var(--surface-2)] text-white' : 'muted hover:text-white'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <AccountButton />
            <button className="btn btn-ghost btn-sm md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
              ☰
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-[var(--border)] px-4 py-2 md:hidden" aria-label="Main mobile">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 font-semibold">
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {config?.announcement && (
        <div className="border-b border-[rgba(224,179,65,0.3)] bg-[rgba(224,179,65,0.08)] px-4 py-2 text-center text-sm text-amber-100">
          {config.announcement}
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--bg-2)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div>
            <div className="font-bold">
              WvW <span className="text-[var(--gold)]">Hub</span>
            </div>
            <p className="muted mt-1">A community calendar for Guild Wars 2 World vs. World. Built for fun, not for profit.</p>
            <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className="btn btn-sm mt-3">
              ☕ Support on Ko-fi
            </a>
          </div>
          <div className="flex flex-col gap-1.5">
            <Link to="/about" className="muted hover:text-white">How it works</Link>
            <Link to="/rules" className="muted hover:text-white">Community rules</Link>
            <Link to="/privacy" className="muted hover:text-white">Privacy</Link>
            {config?.hubInviteUrl && (
              <a href={config.hubInviteUrl} className="muted hover:text-white" target="_blank" rel="noopener noreferrer">
                Join the Discord hub
              </a>
            )}
          </div>
          <div className="faint text-xs leading-relaxed">
            Fan project, not affiliated with or endorsed by ArenaNet or NCSOFT. Guild Wars 2 and all related marks are
            trademarks of NCSOFT Corporation. Data from the official GW2 API.
            <div className="mt-2">
              <a href={MAIN_SITE} className="hover:text-white">ranzlappen.com</a> ·{' '}
              <a href={LEGAL_URL} className="hover:text-white">Legal notice</a>
            </div>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`card card-pad text-left text-sm ${t.kind === 'error' ? 'border-red-500/50' : t.kind === 'ok' ? 'border-green-500/50' : ''}`}
          >
            {t.kind === 'ok' ? '✅ ' : t.kind === 'error' ? '⚠️ ' : ''}
            {t.text}
          </button>
        ))}
      </div>
    </div>
  );
}
