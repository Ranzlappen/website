import { Outlet, Navigate } from 'react-router-dom';
import { useStore } from '../../../hooks/useStore';
import AdminLayout from './AdminLayout';

/**
 * Route guard: only allows admin or moderator users.
 * Renders nested admin routes inside the AdminLayout.
 */
export default function AdminRoute() {
  const user = useStore((s) => s.user);
  const isAdmin = useStore((s) => s.isAdmin);
  const isModerator = useStore((s) => s.isModerator);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading...
      </div>
    );
  }

  if (!isAdmin() && !isModerator()) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
