import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { applyTheme, loadTheme } from './ui/theme';

// Apply the persisted theme before first paint.
applyTheme(loadTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/games">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
