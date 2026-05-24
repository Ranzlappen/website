import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
      <h1 className="text-7xl font-extrabold text-[var(--accent)] leading-none">
        404
      </h1>
      <p className="text-[var(--text-muted)] max-w-md">
        This page doesn’t exist in the Inventory Manager.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
      >
        Back to Inventory
      </Link>
    </div>
  );
}
