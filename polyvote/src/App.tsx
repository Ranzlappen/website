/*
 * CHANGE: New file – Root application component
 * REASON: Sets up routes, auth listener, and toast container
 * DATE: 2026-04-02
 */
import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './hooks/useStore';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import { TopicDetailSkeleton } from './components/LoadingSkeleton';

// Route-level code splitting
const Home = lazy(() => import('./pages/Home'));
const TopicDetail = lazy(() => import('./pages/TopicDetail'));
const Requests = lazy(() => import('./pages/Requests'));
const TopicRequestForm = lazy(() => import('./components/TopicRequestForm'));
const MyVotes = lazy(() => import('./pages/MyVotes'));
const Compare = lazy(() => import('./pages/Compare'));

export default function App() {
  const setUser = useStore((s) => s.setUser);
  const addToast = useStore((s) => s.addToast);

  // Sign in anonymously on mount so every visitor can vote immediately
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        signInAnonymously(auth).catch((err) => {
          console.error('Anonymous sign-in failed:', err);
          addToast('Authentication failed. Some features may not work.', 'error');
        });
      }
    });
    return unsub;
  }, [setUser, addToast]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<TopicDetailSkeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/topic/:topicId" element={<TopicDetail />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/new" element={<TopicRequestForm />} />
            <Route path="/my-votes" element={<MyVotes />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-surface-200 py-6 text-center text-sm text-gray-500">
        PolyVote Prototype &middot; Multi-Metric Community Voting
      </footer>
      <Toast />
    </div>
  );
}
