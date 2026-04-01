---
title: "Why I Track Everything in Plain Text Files"
date: 2026-03-20
category: "Workflow"
tags: [productivity, plaintext, tools]
description: "A case for using simple markdown files instead of fancy apps for personal knowledge management."
image:
status: placeholder
comments: true
---

Every year a new note-taking app launches promising to revolutionize how we think. I've tried most of them. I always come back to plain text.

## The Problem with Apps

Apps disappear. Notion could change their pricing tomorrow. Obsidian could stop being maintained. Roam Research already pivoted once. But a `.md` file from 2005 still opens just fine today.

The other issue is lock-in. Most apps store your data in proprietary formats or behind sync services you don't control. Even "local-first" apps often use SQLite databases that aren't fun to parse without the app itself.

## My System

I keep everything in a folder called `~/notes/`. Inside there are subfolders for projects, a daily journal, and a `_inbox` folder for quick captures. The structure is simple:

```
~/notes/
├── _inbox/
├── journal/
│   └── 2026-03-20.md
├── projects/
│   ├── keyboard-build.md
│   └── garden-automation.md
└── references/
```

## The Tools

I edit with whatever's available — VS Code at my desk, iA Writer on mobile, or `vim` over SSH when I'm feeling fancy. The files sync via Git (pushed to a private repo) and Syncthing as a fallback.

Search is handled by `ripgrep`. It's faster than any app's built-in search and works across every file format.

## What About Links and Backlinks?

I use standard markdown links between files. No wiki-style `[[brackets]]`, just regular `[link text](./path/to/file.md)`. It works in every editor and every renderer without plugins.

Do I miss automatic backlinks? Sometimes. But the act of manually linking forces me to actually think about connections rather than letting software create a false sense of organization.

## Will I Ever Switch?

Probably not. The system is boring, reliable, and completely under my control. That's exactly what I want from something I plan to use for decades.
