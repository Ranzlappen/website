import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useStore } from '../store';

export default function Login() {
  const user = useStore((s) => s.user);
  const authLoading = useStore((s) => s.authLoading);
  const isAuthor = useStore((s) => s.isAuthor);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in with author role
  if (!authLoading && user && !user.isAnonymous && isAuthor()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Blog Admin</h1>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            Sign in to manage blog posts
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--text-muted)]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--text-muted)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </label>

          {error && (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--accent)] text-[var(--bg)] font-semibold py-2 rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--text-muted)] mt-4">
          <a href="https://www.ranzlappen.com/" className="hover:text-[var(--accent)] transition-colors">
            ranzlappen.com
          </a>
        </p>
      </div>
    </div>
  );
}
