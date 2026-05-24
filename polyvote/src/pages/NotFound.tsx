import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
      <h1 className="text-7xl font-extrabold leading-none text-brand-500">404</h1>
      <p className="text-gray-500 max-w-md">
        This page doesn’t exist in PolyVote.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
      >
        Back to PolyVote
      </Link>
    </div>
  );
}
