---
layout: page
title: About
subtitle: The person behind the posts
permalink: /about/
---

## Hey there

I'm the person behind **RanzLappen** — a personal blog where I write about whatever catches my attention. No single niche, no editorial calendar, just genuine curiosity put into words.

## What you'll find here

This is a space for passion projects, random experiments, deep dives into things I find interesting, and the occasional hot take on something nobody asked about. Topics range from tech and tinkering to whatever rabbit hole I fell into last weekend.

## Why "RanzLappen"?

Every good blog needs a name that makes people pause for a second. This one stuck.

## Built with Claude, open sourced on GitHub

This entire site — the Jekyll blog you're reading now, the **PolyVote** community voting SPA at [/polyvote/](/polyvote/), and the **Blog Admin** authoring dashboard at `/blog-admin/` — is self-developed, end to end, in collaboration with [Claude](https://www.claude.com/) (Anthropic's AI assistant).

The whole thing is open source and lives on GitHub at **[Ranzlappen/website](https://github.com/Ranzlappen/website)** — MIT licensed. Fork it, lift pieces of it, or use it as a template for your own blog. The [`README.md`](https://github.com/Ranzlappen/website/blob/main/README.md) walks non-developers through getting their own copy online from a phone, and [`CLAUDE.md`](https://github.com/Ranzlappen/website/blob/main/CLAUDE.md) is the architecture source of truth for anyone digging into the internals.

### How it's put together

A quick tour of the moving parts, in case you're curious (or want to borrow an idea):

- **Jekyll static blog** — the content you're reading. Markdown posts in `_posts/`, Liquid templates in `_layouts/` and `_includes/`, one hand-written CSS file with ~3000 lines of custom properties. No framework, no build step for the blog itself. Posts support status flags (`published`, `draft`, `placeholder`, `unpublished`), opt-in parallax backdrops, a swipeable image carousel, Chart.js-powered bar/pie/line charts, a search palette, read-aloud, and a per-section voting sidebar.
- **PolyVote** — a React 19 + Vite + Tailwind 3 single-page app for community topic voting. Zustand for state, Framer Motion for animation, Chart.js for radar charts. Anonymous Firebase Auth — no signup, one click and you're in.
- **Blog Admin** — a React 19 + Vite + Tailwind 4 dashboard for writing and publishing posts without touching Markdown files. CodeMirror 6 for the editor, react-markdown for live preview, Firebase Auth with custom-claim roles for access. Drafts live in Firestore; publishing commits Markdown directly into the repo via the GitHub API.
- **Reference pages & tools** — three searchable, dark-by-default reference pages at [/references/](/references/): the **Electromagnetic Spectrum**, **Electronics Fundamentals** (with live Ohm's-law / LED-resistor / voltage-divider calculators and an interactive formula wheel), and the **CLI Command Cheat Sheet** (with chmod, find, regex, and curl builders). Everything renders client-side from committed YAML data — no backend, and the interactive tools run entirely in your browser.
- **Firebase Cloud Functions** — the server-side layer. Every client write (votes, comments, drafts, publishes, image uploads) goes through a callable function so security rules and invariants are enforced in one place. Clients never touch Firestore directly.
- **GitHub Actions** — two deploy pipelines. [`jekyll-gh-pages.yml`](https://github.com/Ranzlappen/website/blob/main/.github/workflows/jekyll-gh-pages.yml) builds the Jekyll site and both React apps into a single `_site/` and ships it to GitHub Pages. [`firebase-deploy.yml`](https://github.com/Ranzlappen/website/blob/main/.github/workflows/firebase-deploy.yml) redeploys Firestore rules, RTDB rules, and all Cloud Functions when their paths change. Per-app path filters keep unrelated changes from triggering deploys.
- **Privacy first** — no Google Analytics, no third-party trackers. GDPR-compliant cookie consent with functional categories. Comments are hosted in this repo's GitHub Discussions via [Giscus](https://giscus.app/); the contact form opens a pre-filled GitHub issue instead of emailing anyone. A **Storage Inspector** in the footer (the 🍪 button) lets you see every cookie and `localStorage` entry the site sets, right in the browser.

The dark theme is the default, with a CSS-variable-driven light mode in the blog and PolyVote. Blog Admin is dark-only, on purpose.

If any of that sounds like something you'd want for your own site, the repo is yours to clone.

## Get in touch

Have a question, want to collaborate, or just want to say hi? Head over to the [contact page](/contact/) — messages land directly in my GitHub Issues so nothing gets lost.
