/*
 * CHANGE: New file – Root application component
 * REASON: Sets up routes, auth listener, and toast container
 * DATE: 2026-04-02
 */
import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './hooks/useStore';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import Home from './pages/Home';
import TopicDetail from './pages/TopicDetail';
import Requests from './pages/Requests';
import TopicRequestForm from './components/TopicRequestForm';

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/topic/:topicId" element={<TopicDetail />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<TopicRequestForm />} />
        </Routes>
      </main>
      <footer className="border-t border-surface-200 py-6 text-center text-sm text-gray-500">
        PolyVote Prototype &middot; Multi-Metric Community Voting
      </footer>
      <Toast />
    </div>
  );
}
