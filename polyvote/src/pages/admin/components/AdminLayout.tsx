import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Shield, Flag, BarChart3 } from 'lucide-react';
import { useStore } from '../../../hooks/useStore';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/topics', label: 'Topics', icon: FileText },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/requests', label: 'Requests', icon: Shield },
  { to: '/admin/moderation', label: 'Moderation', icon: Flag },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isAdmin = useStore((s) => s.isAdmin);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <nav className="lg:w-48 flex-shrink-0">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield size={16} />
            Admin Panel
          </h2>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {navItems.map(({ to, label, icon: Icon, exact }) => {
              // Analytics is admin-only
              if (to === '/admin/analytics' && !isAdmin()) return null;

              const active = exact ? pathname === to : pathname.startsWith(to) && to !== '/admin';
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-amber-400/10 text-amber-400 font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surface-100'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
