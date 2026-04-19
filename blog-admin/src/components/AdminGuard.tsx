import { Link, Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../store';

export default function AdminGuard() {
  const user = useStore((s) => s.user);
  const authLoading = useStore((s) => s.authLoading);
  const isAdmin = useStore((s) => s.isAdmin);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--text-muted)]">Checking access...</div>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <h1 className="text-xl font-bold">Admins only</h1>
        <p className="text-[var(--text-muted)] max-w-md">
          You need the <strong>admin</strong> role to manage users.
        </p>
        <Link
          to="/"
          className="px-4 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
