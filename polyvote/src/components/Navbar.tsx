/*
 * CHANGE: Added admin login/logout and admin panel link
 * REASON: Admin accounts need a way to sign in with email/password and access admin panel
 * DATE: 2026-04-14
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, FileText, Home, ArrowLeft, Sun, Moon, Vote, GitCompareArrows, Shield, LogIn, LogOut } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
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
  const user = useStore((s) => s.user);
  const isAdmin = useStore((s) => s.isAdmin);
  const isModerator = useStore((s) => s.isModerator);
  const addToast = useStore((s) => s.addToast);

  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const isAdminOrMod = isAdmin() || isModerator();
  const isAnonymous = user?.isAnonymous ?? true;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
      setEmail('');
      setPassword('');
      addToast('Signed in successfully!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      addToast(message, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      addToast('Signed out. You are now anonymous.', 'info');
    } catch {
      addToast('Sign out failed.', 'error');
    }
  };

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

          {/* Admin link (only visible to admins/moderators) */}
          {isAdminOrMod && (
            <Link
              to="/admin"
              className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                pathname.startsWith('/admin')
                  ? 'bg-amber-400/10 text-amber-400'
                  : 'text-amber-400/70 hover:text-amber-400'
              }`}
            >
              <Shield size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

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

          {/* Auth button */}
          {isAnonymous ? (
            <div className="relative">
              <button
                onClick={() => setShowLogin(!showLogin)}
                aria-label="Admin sign in"
                className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <LogIn size={16} />
              </button>

              {/* Login dropdown */}
              {showLogin && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-surface-200 bg-surface p-4 shadow-xl z-50">
                  <h3 className="text-sm font-semibold text-gray-200 mb-3">Admin Sign In</h3>
                  <form onSubmit={handleLogin} className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-400 focus:outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                    >
                      {loginLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </form>
                  <p className="mt-2 text-xs text-gray-500">
                    For admin/moderator accounts only
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="flex items-center gap-1.5 rounded-lg p-1.5 text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <LogOut size={16} />
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
