import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  auth,
  adminListUsersFn,
  adminBanUserFn,
  adminUnbanUserFn,
  setUserRoleFn,
} from '../firebase';
import { useStore } from '../store';
import type { UserProfile, UserRole } from '../types';

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'text-amber-400 bg-amber-900/30',
  moderator: 'text-blue-400 bg-blue-900/30',
  author: 'text-emerald-400 bg-emerald-900/30',
  user: 'text-gray-400 bg-gray-900/30',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'text-green-400 bg-green-900/30',
  banned: 'text-red-400 bg-red-900/30',
  suspended: 'text-yellow-400 bg-yellow-900/30',
};

export default function Users() {
  const addToast = useStore((s) => s.addToast);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminListUsersFn({
        pageSize: 50,
        roleFilter: roleFilter || undefined,
        statusFilter: statusFilter || undefined,
        searchQuery: search || undefined,
      });
      setUsers(result.data.users);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load users';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, search, addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRoleChange(uid: string, role: UserRole) {
    try {
      await setUserRoleFn({ uid, role });
      addToast(`Role set to ${role}.`, 'success');
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change role';
      addToast(msg, 'error');
    }
  }

  async function handleBan(uid: string) {
    const reason = prompt('Reason for banning this user:');
    if (reason === null) return;
    try {
      await adminBanUserFn({ uid, reason });
      addToast('User banned.', 'success');
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to ban user';
      addToast(msg, 'error');
    }
  }

  async function handleUnban(uid: string) {
    try {
      await adminUnbanUserFn({ uid });
      addToast('User reactivated.', 'success');
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unban user';
      addToast(msg, 'error');
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Users</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="px-3 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors"
            >
              Back to dashboard
            </Link>
            <button
              onClick={() => auth.signOut()}
              className="px-3 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, email, or UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors w-72"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="author">Author</option>
            <option value="user">User</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-[var(--text-muted)]">No users found.</p>
        ) : (
          <div className="overflow-x-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleClass = ROLE_BADGE[u.role] ?? ROLE_BADGE.user;
                  const statusClass =
                    STATUS_BADGE[u.status] ?? 'text-gray-400 bg-gray-900/30';
                  return (
                    <tr
                      key={u.uid}
                      className="border-b border-[var(--border)] last:border-b-0"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${roleClass}`}
                          >
                            {u.role}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium break-words">
                              {u.displayName}
                            </div>
                            <div className="text-xs text-[var(--text-muted)] break-all">
                              {u.email || 'Anonymous'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.uid, e.target.value as UserRole)
                          }
                          className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                        >
                          <option value="user">User</option>
                          <option value="author">Author</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${statusClass}`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-[var(--text-muted)]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {u.status === 'banned' ? (
                          <button
                            onClick={() => handleUnban(u.uid)}
                            className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBan(u.uid)}
                            className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
                          >
                            Ban
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
