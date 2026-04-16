import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../store';

export default function AuthGuard() {
  const user = useStore((s) => s.user);
  const authLoading = useStore((s) => s.authLoading);
  const isAuthor = useStore((s) => s.isAuthor);

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

  if (!isAuthor()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-[var(--text-muted)]">
          You need the <strong>author</strong> role to access the blog editor.
        </p>
        <button
          onClick={() => {
            import('../firebase').then(({ auth }) => auth.signOut());
          }}
          className="px-4 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return <Outlet />;
}
