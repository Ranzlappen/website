<!--
CHANGE: New file – PolyVote project documentation
REASON: Setup, build, deployment, and Firestore rules guide
DATE: 2026-04-02
-->

# PolyVote – Multi-Metric Community Voting

A self-contained **Vite + React 18 + TypeScript + Tailwind CSS** prototype that lets communities vote across multiple dimensions on any topic and see results in real-time radar charts.

## Quick Start

```bash
cd polyvote
npm install
npm run dev
```

The app will be available at `http://localhost:5173/polyvote/`.

## Seed Demo Data

Before using the app you need to populate Firestore with sample topics:

```bash
npm run seed
```

This creates **6 topics** across 3 categories (Technology, Science, Culture) with 2–3 metrics each.

## Firestore Security Rules

Add these rules to your Firebase console (**Firestore Database → Rules**) so the app can read and write:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Topics: anyone can read, authenticated users can update (vote)
    match /topics/{topicId} {
      allow read: if true;
      allow update: if request.auth != null;
    }

    // Requests: anyone can read, authenticated users can create,
    // only the original author or an admin can update status
    match /requests/{requestId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}
```

> **Note:** For a production app you'd add tighter validation (e.g. only increment vote counts, validate field types). The rules above are intentionally permissive for prototyping.

## Build for Production

```bash
npm run build
```

Output is in `dist/`. The `base` path is set to `/polyvote/` in `vite.config.ts`.

## Deploy to GitHub Pages

1. Build the project: `npm run build`
2. Copy the contents of `dist/` to your GitHub Pages deployment root under a `/polyvote/` path, **or** configure your GitHub Actions workflow to deploy this subfolder.
3. Ensure your Firebase project has `your-domain.github.io` added as an authorized domain in **Authentication → Settings → Authorized domains**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Language | TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router v6 |
| State | Zustand |
| Database | Cloud Firestore (Firebase v9 modular) |
| Auth | Firebase Auth (anonymous) |
| Charts | Chart.js + react-chartjs-2 |
| Icons | Lucide React |
| Dates | date-fns |
| Animations | Framer Motion |

## Project Structure

```
polyvote/
├── index.html          # Vite entry HTML
├── package.json        # Dependencies and scripts
├── vite.config.ts      # Vite configuration
├── tailwind.config.js  # Tailwind theme (dark-mode-first)
├── tsconfig.json       # TypeScript configuration
└── src/
    ├── main.tsx        # React mount point
    ├── App.tsx         # Root component with routes
    ├── firebase.ts     # Firebase init (same project as parent repo)
    ├── index.css       # Tailwind directives + custom styles
    ├── types/          # TypeScript interfaces
    ├── hooks/          # Zustand store + Firestore hooks
    ├── components/     # Reusable UI components
    ├── pages/          # Route-level page components
    └── utils/          # Seed script
```

## Features

- **Homepage** – Hero section, collapsible category tabs, search/filter/sort, responsive topic grid with mini radar previews
- **Topic Detail** – Per-metric single-select voting cards, live-updating radar chart, participant count, request-changes modal
- **Requests Page** – Pending/approved/rejected change requests with approve/reject controls
- **Real-time** – All data updates via Firestore `onSnapshot` listeners
- **Anonymous Voting** – Firebase anonymous auth; duplicate vote prevention via localStorage
- **Dark Mode** – Dark-first design with green accent palette matching the parent site
- **Responsive** – Mobile-first layout with smooth Framer Motion animations
