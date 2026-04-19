import { useEffect, useState, useCallback } from 'react';
import { Ban, UserCheck, ShieldAlert, Shield, User } from 'lucide-react';
import { adminListUsersFn, adminBanUserFn, adminUnbanUserFn, setUserRoleFn } from '../../firebase';
import { useStore } from '../../hooks/useStore';
import type { UserProfile, UserRole } from '../../types';
import DataTable from './components/DataTable';
import { formatDistanceToNow } from 'date-fns';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const addToast = useStore((s) => s.addToast);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminListUsersFn({
        pageSize: 50,
        roleFilter: roleFilter || undefined,
        statusFilter: statusFilter || undefined,
        searchQuery: search || undefined,
      });
      setUsers((result.data as { users: UserProfile[] }).users);
    } catch (err) {
      console.error(err);
      addToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, search, addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBan = async (uid: string) => {
    const reason = prompt('Reason for banning this user:');
    if (reason === null) return;
    try {
      await adminBanUserFn({ uid, reason });
      addToast('User banned.', 'success');
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to ban user.';
      addToast(message, 'error');
    }
  };

  const handleUnban = async (uid: string) => {
    try {
      await adminUnbanUserFn({ uid });
      addToast('User reactivated.', 'success');
      fetchUsers();
    } catch (err) {
      console.error(err);
      addToast('Failed to unban user.', 'error');
    }
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
      await setUserRoleFn({ uid, role });
      addToast(`Role set to ${role}.`, 'success');
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change role.';
      addToast(message, 'error');
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <ShieldAlert size={14} className="text-amber-400" />;
      case 'moderator': return <Shield size={14} className="text-blue-400" />;
      default: return <User size={14} className="text-gray-500" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'banned': return 'bg-red-500/20 text-red-400';
      case 'suspended': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (u: UserProfile) => (
        <div className="flex items-center gap-2 min-w-0">
          {roleIcon(u.role)}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-200 truncate">{u.displayName}</div>
            <div className="text-xs text-gray-500 truncate">{u.email || 'Anonymous'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (u: UserProfile) => (
        <select
          value={u.role}
          onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
          className="rounded-md border border-surface-200 bg-surface-100 px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-brand-400"
        >
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (u: UserProfile) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(u.status)}`}>
          {u.status}
        </span>
      ),
    },
    {
      key: 'stats',
      label: 'Activity',
      render: (u: UserProfile) => (
        <div className="text-xs text-gray-500">
          {u.votesCount} votes, {u.commentsCount} comments
        </div>
      ),
    },
    {
      key: 'joined',
      label: 'Joined',
      render: (u: UserProfile) => (
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (u: UserProfile) => (
        <div className="flex gap-1">
          {u.status === 'active' ? (
            <button
              onClick={() => handleBan(u.uid)}
              className="rounded-lg p-1.5 text-gray-500 hover:text-red-400"
              title="Ban user"
            >
              <Ban size={14} />
            </button>
          ) : u.status === 'banned' ? (
            <button
              onClick={() => handleUnban(u.uid)}
              className="rounded-lg p-1.5 text-gray-500 hover:text-green-400"
              title="Unban user"
            >
              <UserCheck size={14} />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-100">Users</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-400 focus:outline-none w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-400"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-400"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : (
        <DataTable
          columns={columns}
          data={users.map((u) => ({ ...u, id: u.uid }))}
          pageSize={15}
          emptyMessage="No users found."
        />
      )}
    </div>
  );
}
