import { Routes, Route } from 'react-router-dom';
// Side-effect imports: register the bundled games + their React views so the
// gallery, lobby and router discover them automatically.
import './games';
import './games/views';

import Home from './pages/Home';
import Setup from './pages/Setup';
import Play from './pages/Play';
import Online from './pages/Online';
import Room from './pages/Room';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup/:gameId" element={<Setup />} />
      <Route path="/play/:matchId" element={<Play />} />
      <Route path="/online" element={<Online />} />
      <Route path="/room/:roomId" element={<Room />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
