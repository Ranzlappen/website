import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import { About, NotFound, Privacy, Rules } from './pages/Content';

// Route-level code splitting: the home page ships first, the rest on demand.
const Calendar = lazy(() => import('./pages/Calendar'));
const Matchups = lazy(() => import('./pages/Matchups'));
const Guilds = lazy(() => import('./pages/Guilds'));
const GuildDetail = lazy(() => import('./pages/GuildDetail'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const EventEditor = lazy(() => import('./pages/EventEditor'));
const RunDetail = lazy(() => import('./pages/RunDetail'));
const Account = lazy(() => import('./pages/Account'));
const MyRaids = lazy(() => import('./pages/MyRaids'));
const Moderation = lazy(() => import('./pages/Moderation'));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8"><Spinner /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="matchups" element={<Matchups />} />
          <Route path="guilds" element={<Guilds />} />
          <Route path="guilds/:id" element={<GuildDetail />} />
          <Route path="events/new" element={<EventEditor />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="events/:id/edit" element={<EventEditor />} />
          <Route path="runs/:id" element={<RunDetail />} />
          <Route path="account" element={<Account />} />
          <Route path="my-raids" element={<MyRaids />} />
          <Route path="mod" element={<Moderation />} />
          <Route path="about" element={<About />} />
          <Route path="rules" element={<Rules />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
