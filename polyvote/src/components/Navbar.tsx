/*
 * CHANGE: Added theme toggle and improved navigation
 * REASON: Dark/light mode switch, better mobile layout
 * DATE: 2026-04-13
 */
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, FileText, Home, ArrowLeft, Sun, Moon, Vote, GitCompareArrows } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import UserStats from './UserStats';

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/requests', label: 'Requests', icon: FileText },
  { to: '/my-votes', label: 'My Votes', icon: Vote },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  return (
    <header className="sticky top-0 z-50 border-b border-surface-200 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 font-bold text-brand-400 text-lg">
          <BarChart3 size={22} />
          <span className="hidden sm:inline">PolyVote</span>
          <span className="sm:hidden">PV</span>
        </Link>

        {/* Nav links */}
        <nav aria-label="Main navigation" className="flex items-center gap-0.5 sm:gap-1">
          <a
            href="/"
            aria-label="Back to main site"
            className="flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Back to site</span>
          </a>
          <span className="mx-1 h-4 w-px bg-surface-200" aria-hidden="true" />
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  active
                    ? 'bg-brand-400/10 text-brand-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </Link>
            );
          })}
          <UserStats />
          <span className="mx-1 h-4 w-px bg-surface-200" aria-hidden="true" />
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
