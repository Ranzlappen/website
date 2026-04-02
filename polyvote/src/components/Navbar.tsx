/*
 * CHANGE: Updated – Top navigation bar with main site links
 * REASON: Brand link navigates back to Jekyll site root; includes main site nav + app nav
 * DATE: 2026-04-02
 */
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, FileText, Home, ArrowLeft } from 'lucide-react';

const appLinks = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/requests', label: 'Requests', icon: FileText },
];

const siteLinks = [
  { href: '/', label: 'Home' },
  { href: '/blog/', label: 'Blog' },
  { href: '/categories/', label: 'Categories' },
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-surface-200 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Brand – links back to main Jekyll site */}
        <a href="/" className="flex items-center gap-2 font-bold text-brand-400 text-lg">
          <BarChart3 size={22} />
          PolyVote
        </a>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {/* Back to site link */}
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors text-gray-400 hover:text-gray-200 mr-2 border-r border-surface-200 pr-4"
          >
            <ArrowLeft size={16} />
            Back to site
          </a>

          {/* App navigation */}
          {appLinks.map(({ to, label, icon: Icon }) => {
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
