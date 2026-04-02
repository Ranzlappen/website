/*
 * CHANGE: New file – React entry point
 * REASON: Bootstraps the PolyVote SPA with router and global styles
 * DATE: 2026-04-02
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/polyvote">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
