import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { useStore } from '../store';

export default function Header({ children }: { children?: React.ReactNode }) {
  const user = useStore((s) => s.user);
  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <Link to="/" className="font-bold text-lg hover:text-[var(--accent)] transition-colors">
          Inventory
        </Link>
        <Link
          to="/ebay-export"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          eBay export
        </Link>
        <div className="flex-1">{children}</div>
        <span className="hidden sm:inline text-xs text-[var(--text-muted)] truncate max-w-[200px]">
          {user?.email}
        </span>
        <button
          onClick={() => auth.signOut()}
          className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
