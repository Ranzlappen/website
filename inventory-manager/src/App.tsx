import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import AdminGuard from './components/AdminGuard';
import Toast from './components/Toast';
import type { UserRole } from './types';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const FolderTable = lazy(() => import('./pages/FolderTable'));
const SchemaEditor = lazy(() => import('./pages/SchemaEditor'));
const ItemEditor = lazy(() => import('./pages/ItemEditor'));
const EbayExport = lazy(() => import('./pages/EbayExport'));
const Search = lazy(() => import('./pages/Search'));

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-[var(--text-muted)]">Loading…</div>
    </div>
  );
}

export default function App() {
  const setUser = useStore((s) => s.setUser);
  const setUserRole = useStore((s) => s.setUserRole);
  const setAuthLoading = useStore((s) => s.setAuthLoading);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const tokenResult = await user.getIdTokenResult();
        const role = (tokenResult.claims.role as UserRole) || 'user';
        setUserRole(role);
      } else {
        setUserRole('user');
      }
      setAuthLoading(false);
    });
    return unsub;
  }, [setUser, setUserRole, setAuthLoading]);

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AdminGuard />}>
            <Route index element={<Dashboard />} />
            <Route path="/folder/:folderId" element={<FolderTable />} />
            <Route path="/folder/:folderId/schema" element={<SchemaEditor />} />
            <Route
              path="/folder/:folderId/item/:itemId"
              element={<ItemEditor />}
            />
            <Route path="/folder/:folderId/new" element={<ItemEditor />} />
            <Route path="/ebay-export" element={<EbayExport />} />
            <Route path="/search" element={<Search />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toast />
    </>
  );
}
