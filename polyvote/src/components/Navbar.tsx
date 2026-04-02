/*
 * CHANGE: New file – Top navigation bar
 * REASON: Provides site-wide navigation with links to Home and Requests
 * DATE: 2026-04-02
 */
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, FileText, Home } from 'lucide-react';

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/requests', label: 'Requests', icon: FileText },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-surface-200 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 font-bold text-brand-400 text-lg">
          <BarChart3 size={22} />
          PolyVote
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-brand-400/10 text-brand-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
