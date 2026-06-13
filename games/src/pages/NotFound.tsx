import { Link } from 'react-router-dom';
import { EmptyState, PageShell } from '../ui/components';

export default function NotFound() {
  return (
    <PageShell>
      <EmptyState icon="🧭" title="Page not found">
        <Link to="/" className="tt-link">
          Back to the game gallery
        </Link>
      </EmptyState>
    </PageShell>
  );
}
