/*
 * CHANGE: Updated – Root application component with admin routes and user profiles
 * REASON: Added admin dashboard routes, user profile sync, and role-based routing
 * DATE: 2026-04-14
 */
import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useStore } from './hooks/useStore';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import KeyboardHelp from './components/KeyboardHelp';
import { TopicDetailSkeleton } from './components/LoadingSkeleton';
import { useKeyboard } from './hooks/useKeyboard';
import type { UserProfile, UserRole } from './types';

// Route-level code splitting
const Home = lazy(() => import('./pages/Home'));
const TopicDetail = lazy(() => import('./pages/TopicDetail'));
const Requests = lazy(() => import('./pages/Requests'));
const TopicRequestForm = lazy(() => import('./components/TopicRequestForm'));
const MyVotes = lazy(() => import('./pages/MyVotes'));
const Compare = lazy(() => import('./pages/Compare'));
const Insights = lazy(() => import('./pages/Insights'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminTopics = lazy(() => import('./pages/admin/AdminTopics'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminRequests = lazy(() => import('./pages/admin/AdminRequests'));
const AdminModeration = lazy(() => import('./pages/admin/AdminModeration'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminRoute = lazy(() => import('./pages/admin/components/AdminRoute'));

export default function App() {
  const setUser = useStore((s) => s.setUser);
  const setUserProfile = useStore((s) => s.setUserProfile);
  const setUserRole = useStore((s) => s.setUserRole);
  const addToast = useStore((s) => s.addToast);

  const { showHelp, closeHelp } = useKeyboard();

  // Auth listener: sign in anonymously on mount, then sync user profile
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      // Clean up previous profile listener
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (user) {
        setUser(user);

        // Get custom claims for role
        const tokenResult = await user.getIdTokenResult();
        const role = (tokenResult.claims.role as UserRole) || 'user';
        setUserRole(role);

        // Subscribe to user profile in Firestore
        profileUnsub = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              setUserProfile({ id: snap.id, ...snap.data() } as unknown as UserProfile);
            }
          },
          (err) => {
            console.error('Profile listener error:', err);
          }
        );
      } else {
        setUser(null);
        setUserProfile(null);
        setUserRole('user');
        signInAnonymously(auth).catch((err) => {
          console.error('Anonymous sign-in failed:', err);
          addToast('Authentication failed. Some features may not work.', 'error');
        });
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, [setUser, setUserProfile, setUserRole, addToast]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <ErrorBoundary>
            <Suspense fallback={<TopicDetailSkeleton />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Home />} />
                <Route path="/topic/:topicId" element={<TopicDetail />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/requests/new" element={<TopicRequestForm />} />
                <Route path="/my-votes" element={<MyVotes />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/insights" element={<Insights />} />

                {/* Admin routes (guarded) */}
                <Route path="/admin" element={<AdminRoute />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="topics" element={<AdminTopics />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="requests" element={<AdminRequests />} />
                  <Route path="moderation" element={<AdminModeration />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="*" element={<NotFound />} />
                </Route>

                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="border-t border-surface-200 py-6 text-center text-sm text-gray-500">
          <p>PolyVote Prototype &middot; Multi-Metric Community Voting</p>
          <nav className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-600">
            <a href="https://www.ranzlappen.com/" className="hover:text-gray-400 transition-colors">ranzlappen.com</a>
            <a href="https://www.ranzlappen.com/privacy/" className="hover:text-gray-400 transition-colors">Privacy</a>
            <a href="https://www.ranzlappen.com/disclaimer/" className="hover:text-gray-400 transition-colors">Disclaimer</a>
          </nav>
        </footer>
        <Toast />
        <KeyboardHelp open={showHelp} onClose={closeHelp} />
      </div>
    </MotionConfig>
  );
}
