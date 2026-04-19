import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import Toast from './components/Toast';
import type { UserRole } from './types';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Editor = lazy(() => import('./pages/Editor'));
const Users = lazy(() => import('./pages/Users'));

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-[var(--text-muted)]">Loading...</div>
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
          <Route element={<AuthGuard />}>
            <Route index element={<Dashboard />} />
            <Route path="/new" element={<Editor />} />
            <Route path="/edit/:draftId" element={<Editor />} />
            <Route path="/copy/:filename" element={<Editor />} />
          </Route>
          <Route element={<AdminGuard />}>
            <Route path="/users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toast />
    </>
  );
}
