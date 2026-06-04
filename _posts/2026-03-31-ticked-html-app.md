---
title: "Ticked: Offline Process & Workflow Tracker"
description: "Ticked is a free single-file HTML app for logging entries and tracking workflows via checkpoints. Fully offline with localStorage, instant auto-save, smart filters, timeline views, and export backups. No accounts, no servers—use instantly online or save locally as index.html for private productivity anywhere."
keywords: ["ticked app", "offline workflow tracker", "process checkpoint tracker", "localstorage productivity tool", "single file html app", "privacy focused task logger", "pwa workflow tracker", "backup enabled productivity"]
date: 2026-03-31
category: "Projects"
tags: [productivity, html, offline, tools]
image: /assets/images/ticked/ticked-hero.webp
backdrop: /assets/images/ticked/ticked-hero.webp
status: published
series: "project-showcases"
series_order: 1
comments: true
---

<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#what-ticked-does">What Ticked Does</a></li>
    <li><a href="#core-features">Core Features</a></li>
    <li><a href="#architecture">Architecture & How It Works</a></li>
    <li><a href="#technical-advantages">Technical Advantages</a></li>
    <li><a href="#configuration">Configuration & Settings</a></li>
    <li><a href="#potential-use-cases">Potential Use Cases</a></li>
    <li><a href="#how-to-get-started">How to Get Started</a></li>
    <li><a href="#important-note-on-data-persistence">Important Note on Data Persistence</a></li>
    <li><a href="#troubleshooting">Troubleshooting & Pitfalls</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="what-ticked-does">What Ticked Does</h2>

Ticked gives you two seamless tabs: **Log** for quick timestamped entries and **Processes** for multi-stage workflow tracking. Every change auto-saves to your browser’s localStorage<sup><a href="#source-3">[3]</a></sup>. Your data stays on your device, works completely offline, and never leaves your machine.

At its core, the Log tab lets you press a button or hit Enter to instantly log the current timestamp like a traditional logbook. This simple one-action capture is particularly helpful for real-time time tracking, habit logging, event documentation, or quick personal journaling—eliminating friction so you can record exactly when something happens without extra steps or apps.

Live at [ticked.ranzlappen.com](https://ticked.ranzlappen.com/) — open it and it is ready immediately, no sign-up required.

<h2 id="core-features">Core Features</h2>

- **Dual Tabs for Flexibility**  
  Switch instantly between Log (quick notes and custom-timestamped entries) and Processes (full workflow tracking).

- **Checkpoint & Stage Tracking**  
  Create processes, add dynamic checkpoints with names, due dates, comments, and notifications. Progress updates via a visual horizontal timeline.

- **Smart Filters & Sorting**  
  For Log: All / Auto-logged / Custom / Edited. For Processes: All / Edited / Overdue. Combine with search, date pickers, and sort by time or name.

- **Timeline & List Views**  
  Toggle between chronological timeline (with day headers) and classic list. Swipe gestures on mobile integrate well for phones, offering quick delete or actions.

- **Silent Instant Logging**  
  Type, hit Enter or tap Log—entries save automatically with no buttons or spinners.

- **Color Palette Customization**  
  Edit your app’s color scheme on the fly; changes persist across sessions.

- **Multi-Language Support**  
  Interface available in English, Spanish (Español), German (Deutsch), and French (Français).

- **Full Responsiveness & PWA-Ready**  
  Scales perfectly from phone to desktop. Installable via browser “Add to Home Screen” with service worker support.

- **Advanced Backup & Export**  
  One-click JSON export, import, Google Drive sync option (with your own client ID), and built-in “Download Offline HTML” for a self-contained backup file.

<div class="carousel">

<img src="/assets/images/ticked/log-tab.mp4" alt="Log tab — swipe to delete and edit">

<img src="/assets/images/ticked/log-tab-timeline.mp4" alt="Log tab — timeline view">

<img src="/assets/images/ticked/processes-tab.svg" alt="Processes tab — checkpoint timeline, overdue indicators, and detail sheet">

<img src="/assets/images/ticked/export-panel.svg" alt="Export/backup panel and mobile swipe gesture in action">

</div>

<h2 id="architecture">Architecture & How It Works</h2>

Ticked ships as six files, four of which provide the full application logic<sup><a href="#source-1">[1]</a></sup>:

| File | Role |
|---|---|
| `index.html` | Application shell and markup |
| `app.js` | All application logic — state, UI, event handling |
| `styles.css` | UI styling and CSS theme tokens |
| `i18n.js` | Language dictionaries for the four supported locales |
| `sw.js` | Service worker — caches assets for offline use |
| `manifest.json` | PWA metadata — name, icons, `display: standalone` |

**State persistence** is handled entirely by the Web Storage API. All log entries, process definitions, checkpoints, and settings are written to `localStorage` on every change (no debounce — every keystroke and tap triggers a save). The storage key is `ticked_store`.

**Offline operation** works via the service worker caching strategy: all six application files are precached on first load. Subsequent visits — even with no network — serve entirely from the cache. Bumping `CACHE_REV` in `sw.js` forces clients to fetch fresh assets on next load, which is the only “release” mechanism for a file served from GitHub Pages.

**PWA installation** is driven by `manifest.json` with `display: standalone`. Visitors on Chrome/Edge (desktop) or any mobile browser get an install prompt. Once installed, Ticked appears as a standalone app with no browser chrome, indistinguishable from a native app.

**Google Drive sync** is optional and requires the user to supply their own OAuth client ID from Google Cloud Console. No credentials are ever stored server-side — the OAuth flow is entirely client-side via the Google Identity Services library. Drive sync is disabled by default and is only activated from Settings.

There are no build tools, no bundler, no `node_modules`. Development is as simple as:

```bash
# Without service worker (instant, no caching)
open index.html

# With full PWA features (service worker requires a server origin)
python3 -m http.server 8080
# visit http://localhost:8080/
```

<h2 id="technical-advantages">Technical Advantages</h2>

Ticked is a single-origin, dependency-free application built with vanilla JavaScript, CSS, and HTML—no frameworks, no build step.

**100 % Local & Offline**  
Data lives in `localStorage` under the key `ticked_store`. The included service worker (`sw.js`) and manifest enable true offline use and PWA installation. Once saved locally, Ticked runs forever without internet.

**Privacy First**  
No accounts, no telemetry, no analytics, no external calls—except for the optional Google Drive sync, which the user explicitly opts into with their own credentials. Your workflows remain completely private by default.

**Under 100 KB**  
The entire application — HTML, CSS, JavaScript, and i18n strings — loads in milliseconds. Service worker caching means repeat loads are instantaneous.

**Easy Instant Access**  
Use it immediately at the live app or save the page as `index.html` (File → Save As in any browser) for a portable, offline copy. Updates are as simple as replacing the file.

<h2 id="configuration">Configuration & Settings</h2>

Ticked has no config file — all settings are exposed through the in-app Settings panel and persisted in `localStorage` alongside your data. The available options are:

- **Language** — Switch between English, Español, Deutsch, and Français at any time. The choice is saved immediately.
- **Color palette** — Edit the app’s color scheme; tokens are stored per-session and persist across reloads.
- **Google Drive sync** — Paste your Google Cloud OAuth client ID to enable optional cloud backup. Can be disconnected at any time from the same panel.
- **Cache invalidation** — If you self-host, bump `CACHE_REV` in `sw.js` to push an update to all cached clients.

<h2 id="potential-use-cases">Potential Use Cases</h2>

- Freelance project logging—track deliverables stage by stage.  
- Daily personal workflows—log routines, side projects, or learning checkpoints.  
- Team hand-off notes—export a clean JSON or offline HTML snapshot.  
- Offline fieldwork—reliable tracking when connectivity is unavailable.  
- Minimalist productivity—replace bloated apps with a tool you own.  
- Logbook-style timestamping—freelance billable-hours logging or daily mood/event journaling.

<h2 id="how-to-get-started">How to Get Started</h2>

1. Visit [ticked.ranzlappen.com](https://ticked.ranzlappen.com/) and start using it immediately — no install, no account.  
2. For a fully offline portable copy, save the page (`File → Save As → index.html`) and open it in any browser.  
3. To install as a PWA on mobile, tap your browser’s **Share → Add to Home Screen**; on desktop, look for the install icon in the address bar.

**Development Note**: Ticked is still in active development. While the core functionality is stable and ready to use, occasional bugs may appear. Feedback and bug reports via GitHub are welcome.

<h2 id="important-note-on-data-persistence">Important Note on Data Persistence</h2>

Ticked stores everything in your browser’s localStorage. Clearing cookies or site data for this domain will delete your entries and processes. Regular backups are strongly recommended — use the built-in Export button to download a `.json` file anytime, or use **Download Offline HTML** for a complete self-contained backup that also works without internet.

Also note: localStorage is per-origin and per-browser profile. If you use Ticked on both your phone and your laptop, the data does **not** sync automatically. Use the JSON export/import or configure Google Drive sync to keep devices in step.

<h2 id="troubleshooting">Troubleshooting & Pitfalls</h2>

**Service worker not updating after a code change?**  
The PWA caches aggressively. If you self-host, bump `CACHE_REV` in `sw.js` and redeploy. In-browser you can force-clear via DevTools → Application → Service Workers → Unregister, then hard-reload.

**”Add to Home Screen” prompt not appearing?**  
This requires the site to be served over HTTPS (or `localhost`). Opening `index.html` directly as a `file://` URL suppresses the install prompt and disables the service worker.

**Google Drive sync not connecting?**  
You need a Google Cloud project with the Drive API enabled and an OAuth client ID scoped for your origin. The client ID you paste must exactly match the domain you’re running Ticked on.

**Data appears to be gone after clearing browser history?**  
Most browsers tie `localStorage` to site data. “Clear browsing data” in most browsers includes site data by default. Always export a backup before clearing.

<h2 id="key-takeaways">Key Takeaways</h2>

- Single-origin HTML app—zero dependencies, zero build step, instant load, fully offline.  
- Dual Log + Processes tabs with checkpoint timelines and smart filters (All / Edited / Overdue).  
- Silent auto-save to `localStorage` with PWA support for an app-like experience on any device.  
- Built-in backup: JSON export/import, optional Google Drive sync, and offline HTML download.  
- Multi-language (EN, ES, DE, FR) with fully responsive UI, swipe gestures, and color customization.  
- 100 % private—no accounts, no servers, no telemetry; data never leaves your device unless you choose Drive sync.

<h2 id="conclusion">Conclusion</h2>

Ticked delivers powerful workflow tracking in the lightest possible package. Whether you open it online for immediate use or save it locally for permanent offline access, you get instant logging, checkpoint progress, smart organisation, and total data ownership. If you value speed, simplicity, and control over your own information, Ticked is ready the moment you open the page.

Star or fork the project on GitHub: [github.com/Ranzlappen/ticked](https://github.com/Ranzlappen/ticked).

---

**More project showcases:** [MoodRadar](/blog/2026/04/03/twitch-mood-radar/) · [Discord Music Bot](/blog/2026/06/04/discord-musicbot/) · [Flipper Zero Framework](/blog/2026/06/04/flipper/) · [HardwareDash](/blog/2026/06/04/hardwaredash/) · [Pageside](/blog/2026/06/04/pageside/) · [tools.ranzlappen.com](/blog/2026/06/04/tools/)

<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://github.com/Ranzlappen/ticked" target="_blank" rel="noopener">Ranzlappen/ticked — GitHub repository (README, source files, architecture).</a></li>
  <li id="source-2"><a href="https://ticked.ranzlappen.com/" target="_blank" rel="noopener">Ticked — live app at ticked.ranzlappen.com.</a></li>
  <li id="source-3"><a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API" target="_blank" rel="noopener">MDN Web Docs — Web Storage API (localStorage).</a></li>
  <li id="source-4"><a href="https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API" target="_blank" rel="noopener">MDN Web Docs — Service Worker API (offline caching).</a></li>
  <li id="source-5"><a href="https://web.dev/progressive-web-apps/" target="_blank" rel="noopener">web.dev — Progressive Web Apps overview (PWA installation, manifest, standalone display).</a></li>
</ol>
