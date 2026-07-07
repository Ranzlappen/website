# ranzlappen.com — Blog + PolyVote + Blog Admin + Inventory Manager + Tabletop

A hybrid static site: a dark-themed Jekyll blog, the PolyVote community voting SPA, a Blog Admin publishing dashboard, a private Inventory Manager, and Tabletop — a reusable browser game engine for card and board games. The blog itself needs **no coding** — everything routine can be done from GitHub's website (works on your phone). The React apps need a dev setup.

> **New here?** If you just want to run or write posts, jump to [Get Your Blog Online](#get-your-blog-online). If you're a developer working on PolyVote, Blog Admin, Inventory Manager, or Tabletop, start with [Developer Setup](#developer-setup).

---

## Developer Setup

The repo contains **five independent modules** plus a nested Cloud Functions module. Each has its own package manifest, lint/test/build/deploy path, and its own README. **Do not cross-import source between modules** — duplicate intentionally if sharing is required (see [`CLAUDE.md`](./CLAUDE.md)).

| Module | Path | Role | Local dev | Docs |
|---|---|---|---|---|
| Jekyll blog | `./` (root) | Static site, posts, pages | `bundle exec jekyll serve` | this README |
| PolyVote | [`polyvote/`](./polyvote) | React 19 voting SPA (served at `/polyvote/`) | `cd polyvote && npm run dev` | [`polyvote/README.md`](./polyvote/README.md) |
| Blog Admin | [`blog-admin/`](./blog-admin) | React 19 publishing dashboard (served at `/blog-admin/`) | `cd blog-admin && npm run dev` | [`blog-admin/README.md`](./blog-admin/README.md) |
| Inventory Manager | [`inventory-manager/`](./inventory-manager) | React 19 admin-only inventory tool with eBay CSV export (served at `/inventory/`, hidden from crawlers) | `cd inventory-manager && npm run dev` | [`inventory-manager/README.md`](./inventory-manager/README.md) |
| Tabletop | [`games/`](./games) | React 19 reusable card/board game engine + 3 demo games (served at `/games/`) | `cd games && npm run dev` | [`games/README.md`](./games/README.md) · [handbook](./games/docs/wiki/README.md) |
| Cloud Functions | [`polyvote/functions/`](./polyvote/functions) | Firebase callables/triggers (server-side writes) | `cd polyvote/functions && npm run serve` | [`polyvote/functions/README.md`](./polyvote/functions/README.md) |

### Prerequisites

- **Node 22** — required for PolyVote, Blog Admin, Cloud Functions, and CI. Check with `node --version`.
- **Ruby 3.x + Bundler** — required to run Jekyll locally. Install Bundler with `gem install bundler`, then `bundle install` from the repo root.
- **Firebase CLI** (only if you deploy server-side resources) — `npm install -g firebase-tools`, then `firebase login`.

### Architecture source of truth

[`CLAUDE.md`](./CLAUDE.md) is the authoritative architecture doc (build commands, conventions, CI/CD table, tech stack). When a README and `CLAUDE.md` disagree, `CLAUDE.md` wins and the README needs updating.

### CI/CD at a glance

The GitHub Actions workflows live in [`.github/workflows/`](./.github/workflows) (see `CLAUDE.md` for the full table). Each is scoped by path filter so unrelated changes don't trigger deploys.

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](./.github/workflows/ci.yml) | PR → `main` | Per-app lint/test/build, only for changed apps |
| [`jekyll-gh-pages.yml`](./.github/workflows/jekyll-gh-pages.yml) | Push → `main` | Builds Jekyll + PolyVote + Blog Admin + Inventory Manager + Tabletop/games, deploys to GitHub Pages |
| [`firebase-deploy.yml`](./.github/workflows/firebase-deploy.yml) | Push → `main` touching Firebase paths | Deploys Firestore rules, RTDB rules, Storage rules, `castBlogVote`, all Blog Admin callables, and all Inventory Manager callables |
| [`search-crawl.yml`](./.github/workflows/search-crawl.yml) | Manual (`workflow_dispatch`) | Re-crawls external content (subdomains, GitHub Pages, repos, gists) via the `search-crawler` module and opens a PR with the refreshed `search-external.json` (merge it to redeploy) |

Required secret for Firebase deploys: `FIREBASE_SERVICE_ACCOUNT`.

---

## Table of Contents

1. [Developer Setup](#developer-setup)
2. [Get Your Blog Online (5 minutes)](#get-your-blog-online)
3. [How to Write a New Post](#how-to-write-a-new-post)
4. [Article Status (Draft / Unpublished)](#article-status)
5. [Add an Image Carousel](#add-an-image-carousel)
6. [Enable a Parallax Backdrop](#enable-a-parallax-backdrop)
7. [Blog Admin (Author Dashboard)](#blog-admin-author-dashboard)
8. [Add a Bar Chart](#add-a-bar-chart)
9. [Add a Pie Chart](#add-a-pie-chart)
10. [Add a Line Chart](#add-a-line-chart)
11. [Add a Data Table](#add-a-data-table)
12. [Add Sources & Citations](#add-sources--citations)
13. [Built-in Features](#built-in-features)
14. [Keyboard Shortcuts](#keyboard-shortcuts)
15. [Enable Comments (Giscus)](#enable-comments-giscus)
16. [Enable Voting Sidebar (Firebase)](#enable-voting-sidebar-firebase)
17. [Enable Contact Form CAPTCHA (hCaptcha)](#enable-contact-form-captcha-hcaptcha)
18. [Connect Your Own Domain](#connect-your-own-domain)
19. [Change Colors or Fonts](#change-colors-or-fonts)
20. [Tune the Blog Carousel](#tune-the-blog-carousel)
21. [Moderate Comments and Votes](#moderate-comments-and-votes)
22. [Fullstack Architecture](#fullstack-architecture)
23. [Quick Reference](#quick-reference)
24. [Project Structure](#project-structure)

---

<details>
<summary><h2>Get Your Blog Online</h2></summary>

You should have your own copy of this repo on GitHub (your fork of the template). If the files from the zip aren't uploaded yet:

### Upload the files

1. Go to your repo on GitHub.
2. Click **Add file → Upload files**.
3. Unzip the downloaded zip file on your phone/tablet (most file managers can do this).
4. Drag or select **all files and folders** from inside the `website/` folder and upload them. Important: upload the *contents* of the `website/` folder, not the folder itself — so `_config.yml` should be at the root of your repo, not inside a subfolder.
5. Scroll down, click **Commit changes**.

### Turn on GitHub Pages

1. In your repo, tap **Settings** (gear icon, top right area).
2. In the left sidebar, tap **Pages**.
3. Under **Source**, select **Deploy from a branch**.
4. Choose branch: **main**, folder: **/ (root)**.
5. Tap **Save**.
6. Wait 2-3 minutes, then visit: **https://ranzlappen.github.io/website/**

That's it — your blog is live.

</details>

---

<details>
<summary><h2>How to Write a New Post</h2></summary>

Every blog post is just a single text file. Here's how to create one:

1. Go to your repo on GitHub.
2. Navigate to the `_posts` folder.
3. Tap **Add file → Create new file**.
4. Name it using this exact pattern: `YYYY-MM-DD-your-title-here.md`
   - Example: `2026-04-15-my-first-real-post.md`
5. Paste this template at the top, then write your content below:

```
---
title: "Your Post Title Here"
date: 2026-04-15
category: "Projects"
tags: [tag1, tag2]
description: "A short summary for search engines and social media previews."
comments: true
---

Write your post here using normal text.

## Section Heading

Use ## for section headings — these automatically show up in the
voting sidebar and comment section picker.

You can use **bold**, *italic*, [links](https://example.com),
and all standard Markdown formatting.

### Smaller Heading

Use ### for sub-sections within a section.

- Bullet points work too
- Like this

> This is a quote block
```

6. Scroll down and tap **Commit changes**.
7. Wait 1-2 minutes — your post is live.

### Tips

- The `category` is a single label like `Projects`, `Thoughts`, `Tutorials`, `Workflow`.
- `tags` can be multiple: `[raspberry-pi, automation, gardening]`.
- `date` must match the date in the filename.
- Want a cover image? Add the image file to `assets/images/`, then add `image: /assets/images/your-image.jpg` to the template header.

### Sticky section headings

When readers scroll a long article, each `## Section heading` will pin under the site bar and shrink slightly until the next `##` rolls in to take its place. It's automatic — nothing to set up. `###` and smaller headings are never sticky, so use those for sub-sections you don't want to pin.

**To turn it off for a single heading**, add a kramdown class on the same line:

```
## My quiet heading {: .no-stick }
```

**To turn it off for an entire post or page**, add this to the front matter:

```yaml
---
sticky_headings: false
---
```

This works on blog posts (`_posts/*.md`) and on Markdown pages (`pages/*.md`). HTML pages (the blog index, projects, tags, etc.) are not affected.

### Using HTML headings with a table of contents

For longer articles, you can use HTML headings with `id` attributes instead of Markdown `##` headings. This lets you add a clickable table of contents at the top. Here's the pattern:

```html
<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#first-section">First Section</a></li>
    <li><a href="#second-section">Second Section</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
  </ol>
</nav>

<h2 id="first-section">First Section</h2>

Your content here...

<h2 id="second-section">Second Section</h2>

More content...

<h2 id="conclusion">Conclusion</h2>

Final thoughts...
```

The `id` on each `<h2>` must match the `href` in the table of contents (without the `#`). You can nest sub-sections with `<h3 id="...">` and use `<ul>` inside the `<ol>` for nested links. These HTML headings work the same as Markdown `##` headings for the voting sidebar and comment section picker.

### Adding an image carousel to a post

You can embed a swipeable image carousel anywhere in your post. Wrap your images in a `<div class="carousel">` block:

```html
<div class="carousel">
  <img src="/assets/images/screenshot-1.png" alt="Description of first image">
  <img src="/assets/images/screenshot-2.png" alt="Description of second image">
  <img src="/assets/images/screenshot-3.png" alt="Description of third image">
</div>
```

Upload your images to `assets/images/` first, then reference them in the `src` attribute. The `alt` text is used as captions. The carousel auto-initializes with arrow buttons, dot indicators, swipe gestures, keyboard navigation, auto-play, and a slide counter. See [Add an Image Carousel](#add-an-image-carousel) for full details.

</details>

---

<details>
<summary><h2>Article Status</h2></summary>

You can control the visibility of any post by adding a `status` field to its frontmatter. This is useful for work-in-progress drafts, placeholder articles, or posts you want to take down without deleting.

### Supported values

| Value | Behavior |
|-------|----------|
| `published` | **(Default)** Normal article — visible everywhere. You never need to add this explicitly. |
| `placeholder` | **Visible in on-site listings** (homepage, blog, categories, tags) with a status badge, but — like drafts — excluded from search, the RSS feed, and the sitemap, and served with a `noindex` meta tag (it is self-declared test content, so crawlers are kept away). Still shows a banner on the article page: *"This article is a draft and may be incomplete or subject to change."* |
| `draft` | Hidden from all listings, feeds, search, and sitemap. Still accessible via direct URL. Shows a banner: *"This article is a draft and may be incomplete or subject to change."* |
| `unpublished` | Same hiding behavior as `draft`. Shows a banner: *"This article is unpublished."* |

### How to use it

Add a `status` line to the frontmatter of any post:

```
---
title: "My Work-in-Progress Post"
date: 2026-04-15
category: "Projects"
tags: [tag1, tag2]
description: "A short summary."
status: draft
comments: true
---
```

To publish it later, either remove the `status` line or change it to `status: published`.

### What gets hidden

When a post's status is `draft` or `unpublished`, it is excluded from:

- The homepage and blog page (grid and list views)
- Category and tag pages (including the count pills)
- Search results
- The RSS feed (`/feed.xml`)
- The sitemap (`/sitemap.xml`)
- Previous/next navigation links on other posts

The post itself **remains fully accessible** if someone visits its URL directly — they'll just see a small disclaimer banner at the top of the article. Any post whose status is not `published` also ships a `<meta name="robots" content="noindex,nofollow">` tag so search engines that discover the URL don't index it.

**Note:** `placeholder` articles are hidden only from crawlers and machine outputs (search index, feed, sitemap, robots meta). They still appear in all on-site listings with a yellow "Placeholder" badge, making them useful for reserving spots on the site while the content is still being written.

</details>

---

<details>
<summary><h2>Article Series</h2></summary>

Group related posts into a **series**. When a post belongs to a series with at least one other post, a series nav renders automatically at the top of the article — listing every post in order and highlighting the current one.

### 1. Define the series

Series live in `_data/series.yml`. Each entry needs an `id` (kebab-case, referenced from post front matter), a `title`, and an optional `description`:

```yaml
- id: "media-trust"
  title: "Media, Trust & Power"
  description: "How media institutions, statistics, and advertising shape public perception — and what's broken."

- id: "project-showcases"
  title: "Project Showcases"
  description: "Tools and experiments built to solve real problems."
```

### 2. Mark each post

Add `series` and `series_order` to the front matter of every post that belongs to the series. `series_order` is the post's position in the series (1-indexed, integer):

```
---
title: "Western Media Trust Crisis"
date: 2026-03-31
category: "Media"
tags: [media, trust]
description: "A look at why trust in mainstream media keeps falling."
series: "media-trust"
series_order: 1
comments: true
---
```

### 3. How rendering works

`_includes/series-nav.html` is injected from `_layouts/post.html` on every post page. The nav renders only when **both** conditions are true:

- The `series` value matches an `id` in `_data/series.yml`.
- At least **two** posts with that `series` exist and have status `published` or `placeholder` (drafts and `unpublished` posts are excluded from the nav and count).

Inside the series, posts are sorted by `series_order` ascending. Each number should be **unique within a series** — Jekyll won't warn on collisions, so two posts sharing an order will just render in an arbitrary order.

### 4. Editing from the Blog Admin

The Blog Admin editor's **Advanced fields** section exposes `Series` and `Series Order`. The series picker is a combobox — you can pick an existing series from the list or type a brand-new ID. The order input shows which numbers are already used in the selected series and flags collisions.

If you introduce a brand-new series ID from the admin, remember to also add a matching entry to `_data/series.yml` — without it, the series nav won't render.

</details>

---

<details>
<summary><h2>Add an Image Carousel</h2></summary>

You can add a swipeable image carousel (gallery/slideshow) to any post. Wrap your images in a `<div class="carousel">` block:

```html
<div class="carousel">
  <img src="/assets/images/screenshot-1.png" alt="Description of first image">
  <img src="/assets/images/screenshot-2.png" alt="Description of second image">
  <img src="/assets/images/screenshot-3.png" alt="Description of third image">
</div>
```

That's it — the carousel auto-initializes with:

- **Arrow buttons** and **dot indicators** for navigation
- **Swipe gestures** on mobile
- **Keyboard arrow keys** (← →)
- **Auto-play** that pauses when you hover
- **Captions** pulled from each image's `alt` text
- **Slide counter** (e.g., "1 / 3")

Upload your images to `assets/images/` and reference them in the `src` attribute. You can add as many images as you want.

</details>

---

<details>
<summary><h2>Enable a Parallax Backdrop</h2></summary>

A parallax backdrop pins the article's hero image behind the page content, scrolling slower than the rest of the page for a subtle depth effect. The post header, body, and footer become translucent panels layered on top of the image. It's opt-in per article — no global toggle.

### Turn it on for an article

Add a single `backdrop:` field to the post's front matter. Point it at any image in `assets/images/` — reusing the post's `image:` (hero) is the common pattern:

```yaml
---
title: "My Post"
date: 2026-04-15
category: "Media"
image: /assets/images/my-topic/my-hero.webp
backdrop: /assets/images/my-topic/my-hero.webp
status: published
---
```

That's the entire setup. On the next build, the post page renders with the image fixed in the background and the content panels made translucent over it. See `_posts/2026-04-12-cookies.md` for a reference article.

### How it works

- The `_layouts/default.html` layout renders `<div class="parallax-backdrop">` around the referenced image when `page.backdrop` is set, and adds a `has-backdrop` class on `<body>`.
- `_layouts/post.html` adds the `post--has-backdrop` modifier so the header, body, and footer pick up the translucent background rule in `assets/css/style.css`.
- `assets/js/main.js` applies a `translate3d` on scroll so the backdrop moves slower than the content, creating the parallax effect.
- Opacity of the translucent panels is tuned via the `--backdrop-opacity` CSS variable at the top of `assets/css/style.css` (defaults to `0.88`).

### Turn it off

Remove the `backdrop:` line. The post falls back to the normal opaque layout on the next build.

### Setting it from Blog Admin

If you use the Blog Admin dashboard (see next section), the front-matter form has a **Backdrop Image** field — paste the same path you'd put in `image:` and publish. No Markdown editing required.

</details>

---

<details>
<summary><h2>Blog Admin (Author Dashboard)</h2></summary>

An optional web dashboard at `/blog-admin/` for writing, previewing, and publishing posts without ever touching Markdown files directly. It's mobile-friendly, so you can draft from a phone and ship a post without the GitHub UI.

Developer setup and architecture live in [`blog-admin/README.md`](./blog-admin/README.md). This section is the author's tour of what the dashboard does once it's wired up.

### What it gives you

- **CodeMirror 6 editor** with Markdown syntax highlighting, search/replace, and keyboard shortcuts.
- **Live preview** that matches the rendered blog post, including GFM tables/tasks and raw HTML passthrough.
- **Front-matter form** for every field you'd otherwise edit by hand — title, date, category, tags, description, keywords, status (`published` / `draft` / `placeholder` / `unpublished`), hero image, **backdrop image** (parallax), author, PolyVote topic, series, and comments toggle.
- **Draft list** on the dashboard showing every work-in-progress draft with last-edited timestamps.
- **Import existing posts** from the repo's `_posts/` folder, in two explicit modes:
  - **Edit** — links the draft to the existing GitHub file (via `blogDrafts.sourceFilename`), so re-imports reopen the same draft and a publish updates the file in place.
  - **Copy** — creates an unlinked draft seeded with a `-copy` slug for building a new post from the old one.
- **Image upload** — drop an image into the editor and the `blogUploadImage` Cloud Function commits it into `assets/images/` on the default branch; the Markdown gets the correct path automatically.
- **One-click publish** — the `blogPublishToGitHub` Cloud Function commits the final Markdown file into `_posts/` via the GitHub API, and Jekyll rebuilds on the next push. A safety check blocks silent overwrites of existing files unless you confirm.

### How to get in

1. Visit `/blog-admin/` on your deployed site (or `http://localhost:5173/` when running `npm run dev` from `blog-admin/`).
2. Log in with Firebase email/password. The first admin is bootstrapped once via the `bootstrapAdmin` Cloud Function; additional admins/authors are elevated by an existing admin through `setUserRole`.
3. The dashboard lists your drafts. Click **New** to start one, click an existing draft to edit it, or use **Import** to pull in a post that's already in `_posts/`.

### Author workflow at a glance

```
Dashboard → New/Edit/Import
   → CodeMirror editor + front-matter form
   → Save (writes a draft to Firestore via blogSaveDraft)
   → Preview in the live pane
   → Publish → blogPublishToGitHub commits _posts/<slug>.md
   → jekyll-gh-pages.yml rebuilds the site → post is live
```

### Permissions and limits

- All writes go through Cloud Functions — the client never touches Firestore directly. That means the full set of callables (`blogSaveDraft`, `blogListDrafts`, `blogGetDraft`, `blogDeleteDraft`, `blogListExistingPosts`, `blogFetchExistingPost`, `blogImportPostForEdit`, `blogPublishToGitHub`, `blogUploadImage`) must be deployed — they ship automatically via [`.github/workflows/firebase-deploy.yml`](./.github/workflows/firebase-deploy.yml).
- Role is read from the signed-in user's ID-token custom claims (not a Firestore doc). If you see "Missing or insufficient permissions," your account lacks the right claim — have an admin run `setUserRole`.
- Dark-only by design — there's no light-theme toggle in the admin.

### When to use it vs. editing Markdown directly

Use the admin when you want the form-based front matter, image uploads, or live preview — and especially when drafting on mobile. Edit the Markdown directly on GitHub when you just need a quick typo fix or when you want to review the exact file diff before committing.

</details>

---

<!--
CHANGE: Complete rewrite of chart documentation for Chart.js-based system
REASON: Chart system overhaul — Chart.js replaces pure CSS charts
DATE: 2026-04-03
-->

<details>
<summary><h2>Add a Bar Chart</h2></summary>

Embed responsive, professional bar charts in any post using [Chart.js](https://www.chartjs.org/) (loaded from CDN). Charts auto-initialize from declarative HTML — no manual JavaScript needed. They adapt to dark/light theme, support `prefers-reduced-motion`, and are fully responsive.

### Minimal example

```html
<div class="chart-container" role="figure" aria-label="Monthly sales">
  <canvas data-chart="bar"
    data-title="Monthly Sales"
    data-labels='["Jan","Feb","Mar","Apr"]'
    data-datasets='[{"label":"Sales","data":[42,68,55,89]}]'>
  </canvas>
</div>
```

### How it works

- `data-chart="bar"` — chart type
- `data-title` — optional title displayed above the chart
- `data-labels` — JSON array of category labels (x-axis)
- `data-datasets` — JSON array of dataset objects, each with:
  - `"label"` — series name (shown in legend and tooltips)
  - `"data"` — array of numeric values
  - `"color"` — (optional) single color for all bars in the series
  - `"colors"` — (optional) array of colors, one per bar

The wrapper `<div class="chart-container">` provides the styled card background. Always include `role="figure"` and `aria-label` for accessibility.

### Color each bar individually

Pass a `"colors"` array instead of a single `"color"`:

```html
<canvas data-chart="bar"
  data-labels='["Q1","Q2","Q3"]'
  data-datasets='[{"label":"Revenue","data":[65,82,91],"colors":["#ef4444","#f59e0b","#4ade80"]}]'>
</canvas>
```

### Built-in color palette

When no color is specified, datasets cycle through this palette:

| Index | Color | Hex |
|-------|-------|-----|
| 1 | Green | `#4ade80` |
| 2 | Blue | `#3b82f6` |
| 3 | Amber | `#f59e0b` |
| 4 | Purple | `#8b5cf6` |
| 5 | Pink | `#ec4899` |
| 6 | Cyan | `#06b6d4` |
| 7 | Red | `#ef4444` |
| 8 | Slate | `#64748b` |

### Grouped bar chart (multiple series)

```html
<div class="chart-container" role="figure" aria-label="AI Model Comparison">
  <canvas data-chart="bar"
    data-title="AI Model Guardrails vs. Bias"
    data-labels='["ChatGPT","Claude","Gemini","Grok"]'
    data-datasets='[{"label":"Guardrails","data":[85,80,70,28],"color":"#ef4444"},{"label":"Bias","data":[72,68,48,20],"color":"#f59e0b"}]'>
  </canvas>
</div>
```

### Responsive and accessible

- **Responsive:** Chart.js handles canvas resizing automatically on all screen sizes
- **Tooltips:** Hover or tap any bar to see precise values
- **Animations:** Smooth entrance animation (disabled when `prefers-reduced-motion: reduce`)
- **Theme-aware:** Reads CSS custom properties for text, border, and surface colors
- **Print:** Charts render inside a styled container with `break-inside: avoid`

</details>

---

<details>
<summary><h2>Add a Pie Chart</h2></summary>

Embed responsive pie charts (or doughnut charts) in any post. Uses Chart.js canvas rendering with smooth animations and interactive tooltips.

### Minimal example

```html
<div class="chart-container" role="figure" aria-label="Browser market share">
  <canvas data-chart="pie"
    data-title="Browser Market Share"
    data-labels='["Chrome","Firefox","Safari","Edge"]'
    data-values='[42,28,18,12]'
    data-colors='["#4ade80","#3b82f6","#f59e0b","#8b5cf6"]'>
  </canvas>
</div>
```

### How it works

- `data-chart="pie"` — use `"pie"` for a full pie or `"doughnut"` for a doughnut
- `data-title` — optional title
- `data-labels` — JSON array of slice labels
- `data-values` — JSON array of numeric values (one per slice)
- `data-colors` — (optional) JSON array of hex colors; defaults to the built-in 8-color palette

### Doughnut variant

Simply change the chart type:

```html
<canvas data-chart="doughnut"
  data-title="Project Progress"
  data-labels='["Complete","In Progress","Remaining"]'
  data-values='[50,30,20]'
  data-colors='["#4ade80","#f59e0b","#64748b"]'>
</canvas>
```

### Real-world example (from a post)

```html
<div class="chart-container" role="figure" aria-label="Trust in Journalists by Type 2025">
  <canvas data-chart="pie"
    data-title="Trust in Journalists by Type 2025 (Source: Change Research)"
    data-labels='["Independent / Online","National Outlets","Local News","Social Media","Other"]'
    data-values='[34,12,26,16,12]'
    data-colors='["#4ade80","#3b82f6","#f59e0b","#8b5cf6","#64748b"]'>
  </canvas>
</div>
```

### Responsive and accessible

- **Legend:** Auto-positioned (right on desktop, bottom on mobile)
- **Tooltips:** Hover or tap any slice to see label and value
- **Animations:** Smooth entrance animation, respects `prefers-reduced-motion`
- **Theme-aware:** Slice borders match the theme surface color for clean separation

</details>

---

<details>
<summary><h2>Add a Line Chart</h2></summary>

Embed responsive line charts with multiple data series, grid lines, smooth curves, and interactive data points. All rendered by Chart.js from declarative HTML.

### Minimal example

```html
<div class="chart-container" role="figure" aria-label="Monthly Visitors">
  <canvas data-chart="line"
    data-title="Monthly Visitors"
    data-labels='["Jan","Feb","Mar","Apr"]'
    data-datasets='[{"label":"Visitors","data":[50,75,60,95]}]'>
  </canvas>
</div>
```

### How it works

- `data-chart="line"` — chart type
- `data-title` — optional title
- `data-labels` — JSON array of x-axis labels
- `data-datasets` — JSON array of dataset objects:
  - `"label"` — series name
  - `"data"` — array of numeric values
  - `"color"` — (optional) line and point color
  - `"fill"` — (optional) set to `true` to fill the area under the line

### Multiple data series

```html
<div class="chart-container" role="figure" aria-label="US vs Europe Trust">
  <canvas data-chart="line"
    data-title="Media Trust Decline 2015–2025 (%)"
    data-labels='["2015","2018","2021","2025"]'
    data-datasets='[{"label":"United States","data":[50,43,37,30],"color":"#3b82f6"},{"label":"Europe","data":[60,48,40,37],"color":"#f59e0b"}]'>
  </canvas>
</div>
```

### Area fill

```html
<canvas data-chart="line"
  data-labels='["Q1","Q2","Q3","Q4"]'
  data-datasets='[{"label":"Revenue","data":[10,25,18,40],"color":"#4ade80","fill":true}]'>
</canvas>
```

### Y-axis options

By default the y-axis starts at zero. To let Chart.js auto-scale, add `data-zero="false"`:

```html
<canvas data-chart="line" data-zero="false"
  data-labels='["Mon","Tue","Wed"]'
  data-datasets='[{"label":"Temp","data":[18,22,20]}]'>
</canvas>
```

### Responsive and accessible

- **Responsive:** Canvas scales to container width automatically
- **Tooltips:** Hover shows all series values at that x-position (`interaction: index`)
- **Smooth curves:** Lines use `tension: 0.3` for gentle curves
- **Animations:** Smooth draw-in, respects `prefers-reduced-motion`
- **Theme-aware:** Grid, axis, and tooltip colors match the active dark/light theme

</details>

---

<details>
<summary><h2>Add a Data Table</h2></summary>

Just write a plain **Markdown table** — the site styles every table in a post or page automatically to match the reference pages (the [Electromagnetic Spectrum](https://www.ranzlappen.com/references/spectrum/) and [Electronics Fundamentals](https://www.ranzlappen.com/references/electronics/) big tables): a rounded, bordered card on a dark surface with a soft shadow, an uppercase header row that stays pinned while the card scrolls, light row separators, comfortable padding, and a hover highlight. **No inline styles, no `style="…"` attributes, no wrapper `<div>` needed** — the shared CSS does all of it.

### The look (shared site-wide)

The styling lives in `assets/css/style.css` under **"Content tables (blog posts + static pages)"** and targets every `table` inside `.post-body` (posts) and `.page-body` (static pages like Privacy). It deliberately mirrors the reference-page table styling (`assets/css/reference-table.css`, `spectrum.css`, `electronics-fundamentals.css`) so tables look the same everywhere on the site. **The only table that intentionally differs is the [CLI Command Cheat Sheet](https://www.ranzlappen.com/references/cmd-cheat-sheet/)**, which uses its own sortable/filterable scaffolding. You don't opt in — any table you write gets the look.

### Paste this template into your post

```markdown
| Column A          | Column B | Description                | Count |
|-------------------|:--------:|----------------------------|:-----:|
| **Row 1 label**   | 42       | What this row is about     | 73    |
| **Row 2 label**   | 38       | Another short description  | 56    |
```

That renders as the same card-style table used across the site.

### How it works

- **Card + scroll wrapper:** the CSS turns the `table` itself into a rounded, bordered scroll container — wide tables scroll horizontally on small screens instead of breaking the layout. No wrapper `<div>` required.
- **Sticky header:** the header row (`thead`) stays pinned to the top of the card as you scroll, exactly like the reference tables.
- **Alignment:** control column alignment with the Markdown separator row — `:---` (left, the default), `:---:` (center), `---:` (right). Center numeric/status columns for readability.
- **Emphasis:** wrap the first cell of each row in `**bold**` to highlight the row label (matches the convention in the existing post tables).
- **Theme-aware:** colors come from the site's CSS variables, so tables track the active dark/light theme automatically.

### Tips

- Prefer Markdown tables — they're the lightest to write and the easiest to read in source. They cover essentially every blog need.
- If you need richer cell content (e.g. a `<sup>` citation, a list, or inline `<code>`), you can write a **plain HTML `<table>`** instead — leave the inline `style` attributes off and it picks up the same shared styling. (Cell-level overrides via `style="…"` still work if you ever truly need one, but you almost never will.)
- Don't re-introduce `style="width: …"`, `border-collapse: collapse`, or a wrapping `<div style="overflow-x: auto">` — those were the old per-table approach and now just fight the shared CSS. Strip them and let the site style the table.
- Keep header labels short — they render uppercase and letter-spaced like the reference tables.

</details>

---

<details>
<summary><h2>Add Sources & Citations</h2></summary>

Every article that references external data, research, or statistics should include numbered source citations. This blog uses a consistent format: inline superscript numbers that link to a numbered sources list at the bottom of the article.

### Inline citations (in the article body)

When a sentence references a source, add a superscript link immediately after the relevant claim:

```html
Global ad spend surpassed one trillion dollars in 2024.<sup><a href="#source-2">[2]</a></sup>
```

**Rules:**
- Place the `<sup>` tag directly after the period or the end of the claim — no space before it
- The `href` must match the `id` on the corresponding `<li>` in the sources list (`#source-1`, `#source-2`, etc.)
- Multiple sources on the same claim: use consecutive sups: `<sup><a href="#source-1">[1]</a></sup><sup><a href="#source-2">[2]</a></sup>`
- Inside HTML tables or list items, sups work the same way

### Sources section (at the bottom of the article)

Add a `Sources` heading and a numbered `<ol>` list at the end of your article, before the closing content. Each source gets a unique `id` that matches the inline citation:

```html
<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://example.com/report-2025" target="_blank" rel="noopener">Author or Publisher (Year). Title of the Source.</a></li>
  <li id="source-2"><a href="https://example.com/study" target="_blank" rel="noopener">Author (Year). Title of the Study or Article.</a></li>
  <li id="source-3">Author (Year). <em>Title of a Book or Offline Source.</em></li>
</ol>
```

**Rules:**
- Use `<ol>` (ordered list), not `<ul>`
- Each `<li>` must have `id="source-N"` matching the inline `href="#source-N"`
- Linked sources: wrap in `<a href="..." target="_blank" rel="noopener">` — always include `target="_blank"` and `rel="noopener"`
- Offline sources (books, reports without URLs): use plain text with `<em>` for titles
- Format: `Publisher or Author (Year). Title.`
- Number sources in the order they first appear in the article
- Add "Sources" to the article's Table of Contents nav if one exists

### Complete example

```html
<!-- In the article body -->
<p>Studies confirm that 79 percent of respondents feel watched by retargeted ads.<sup><a href="#source-1">[1]</a></sup>
Cross-national analyses link ad exposure to lower happiness.<sup><a href="#source-2">[2]</a></sup></p>

<!-- At the bottom of the article -->
<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://example.com/ad-fatigue-stats" target="_blank" rel="noopener">HubSpot (2026). 14 Ad Fatigue Statistics.</a></li>
  <li id="source-2"><a href="https://example.com/advertising-happiness" target="_blank" rel="noopener">Griffith et al., Journal of International Business Studies. "Advertising Spending and Happiness."</a></li>
</ol>
```

### Tips

- Always add the sources `<h2>` to your Table of Contents navigation: `<li><a href="#sources">Sources</a></li>`
- If a source doesn't have a URL (e.g., a book), omit the `<a>` tag and just write the citation text
- Use `<em>` for book titles: `<em>How to Lie with Statistics</em>`
- Keep source descriptions concise: Publisher (Year). Title. — no need for full academic citation format

</details>

---

<details>
<summary><h2>Built-in Features</h2></summary>

These features work automatically on every post — no setup needed:

| Feature | What it does |
|---------|-------------|
| **Read Aloud** | Converts your article to speech with play/pause, speed, and volume controls (desktop only) |
| **Search** | Grouped search across the whole presence — posts, pages, and reference pages (live from Jekyll) plus subdomains, GitHub Pages, repos, and gists (a committed crawl snapshot). Press `Ctrl+K` (or `Cmd+K` on Mac) to open. Privacy-first: nothing third-party loads at query time. Refresh the external slice via the **Re-crawl external search index** workflow (see below). |
| **Reading Progress Bar** | Shows how far down the page the reader has scrolled |
| **Dark / Light Theme** | Toggle between dark and light mode — preference is saved |
| **Grid / List View** | Readers can switch between grid cards and a compact list on the blog page |

</details>

---

<details>
<summary><h2>Keyboard Shortcuts</h2></summary>

### Blog

| Key | Action |
|-----|--------|
| `Ctrl+K` / `Cmd+K` | Open search |
| `Esc` | Close search |
| `←` `→` | Navigate image carousels |

### PolyVote (`/polyvote/`)

| Key | Action |
|-----|--------|
| `/` | Focus the search bar |
| `t` | Toggle dark / light theme |
| `?` | Show keyboard shortcuts help overlay |
| `Esc` | Close dialogs and overlays |

> Shortcuts are disabled while typing in input fields, textareas, or content-editable elements.

</details>

---

<details>
<summary><h2>Enable Comments (Giscus)</h2></summary>

Giscus lets visitors comment on your posts using their GitHub account. Comments are stored in your repo's Discussions tab — you have full control.

### Step 1: Turn on Discussions

1. Go to your repo → **Settings**.
2. Scroll down to **Features**.
3. Check the box next to **Discussions**.

### Step 2: Create a comment category

1. Go to the **Discussions** tab in your repo (top menu bar).
2. Tap the pencil/edit icon next to "Categories" in the left sidebar.
3. Tap **New category**.
4. Name it: `Blog Comments`
5. Discussion format: choose **Announcement** (so only the bot creates threads).
6. Save.

### Step 3: Get your config codes

1. Open [giscus.app](https://giscus.app) in your browser.
2. Fill in:
   - Repository: `Ranzlappen/website`
   - Page ↔ Discussion mapping: select **pathname**
   - Category: select **Blog Comments**
3. The page will show a code block. You need two values from it:
   - `data-repo-id` (starts with `R_`)
   - `data-category-id` (starts with `DIC_`)

### Step 4: Paste them into your config

1. Go to your repo → open `_config.yml` → tap the pencil icon to edit.
2. Find the `giscus:` section and fill in:
   ```
   giscus:
     repo: "Ranzlappen/website"
     repo_id: "R_paste_yours_here"
     category: "Blog Comments"
     category_id: "DIC_paste_yours_here"
   ```
3. Tap **Commit changes**.
4. Wait 1-2 minutes — comments will now appear on every post.

</details>

---

<details>
<summary><h2>Enable Voting Sidebar (Firebase)</h2></summary>

The voting sidebar lets readers vote 👍/👎 on each section of your articles. Votes are stored in Firebase (Google's free database).

### Step 1: Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/).
2. Sign in with any Google account.
3. Tap **Add project**.
4. Name it something like `ranzlappen-votes`.
5. You can disable Google Analytics (not needed) → tap **Create project**.
6. Wait for it to finish, then tap **Continue**.

### Step 2: Create the database

1. In the Firebase console sidebar, tap **Build → Realtime Database**.
2. Tap **Create Database**.
3. Pick a location (choose the one closest to you, e.g., `europe-west1` for Europe).
4. Select **Start in locked mode** → tap **Enable**.

### Step 3: Set security rules

1. In the Realtime Database page, tap the **Rules** tab.
2. Delete everything there and paste this:

```json
{
  "rules": {
    "votes": {
      "$postSlug": {
        "$sectionId": {
          "up": {
            ".read": true,
            ".write": true,
            ".validate": "newData.isNumber()"
          },
          "down": {
            ".read": true,
            ".write": true,
            ".validate": "newData.isNumber()"
          },
          "voters": {
            "$visitorHash": {
              ".read": true,
              ".write": "!data.exists()",
              ".validate": "newData.isString() && (newData.val() === 'up' || newData.val() === 'down')"
            }
          }
        }
      }
    }
  }
}
```

3. Tap **Publish**.

### Step 4: Register a web app

1. In Firebase console, tap the **gear icon** (top left) → **Project settings**.
2. Scroll down to **Your apps** → tap the **</>** (web) icon.
3. Give it a nickname (e.g., `blog`) — you do NOT need Firebase Hosting, leave it unchecked.
4. Tap **Register app**.
5. You'll see a code block with your config. You need three values:
   - `apiKey` (starts with `AIza...`)
   - `projectId` (e.g., `ranzlappen-votes`)
   - `databaseURL` (e.g., `https://ranzlappen-votes-default-rtdb.europe-west1.firebasedatabase.app`)

### Step 5: Paste them into your config

1. Go to your repo → edit `_config.yml`.
2. Find the `firebase:` section and fill in:
   ```
   firebase:
     api_key: "AIzaSy..."
     project_id: "ranzlappen-votes"
     database_url: "https://ranzlappen-votes-default-rtdb.europe-west1.firebasedatabase.app"
   ```
3. Tap **Commit changes**.

The voting sidebar will now work on every post.

</details>

---

<details>
<summary><h2>Enable Contact Form CAPTCHA (hCaptcha)</h2></summary>

The contact form uses hCaptcha to block spam bots. Without this step, the form still works (it opens a GitHub Issue page) but won't have CAPTCHA protection.

### Step 1: Sign up

1. Go to [hcaptcha.com](https://www.hcaptcha.com/signup-interstitial).
2. Create a free account.

### Step 2: Add your site

1. In the hCaptcha dashboard, go to **Sites → + New Site**.
2. Add your domain: `ranzlappen.github.io` (and your custom domain if you have one).
3. Save. You'll get a **Site Key** — copy it.

### Step 3: Paste it into your config

1. Go to your repo → edit `_config.yml`.
2. Find the `hcaptcha:` section:
   ```
   hcaptcha:
     site_key: "paste-your-site-key-here"
   ```
3. Tap **Commit changes**.

### How the contact form works

When someone fills out the contact form, it opens a pre-filled GitHub Issue in your repo. You'll get a notification on GitHub whenever someone contacts you. You can respond directly from the Issues tab.

</details>

---

<details>
<summary><h2>Connect Your Own Domain</h2></summary>

If you have a domain (from Squarespace, Namecheap, or any registrar):

### In GitHub

1. Go to your repo → **Settings → Pages**.
2. Under **Custom domain**, type your domain (e.g., `www.yourdomain.com`).
3. Tap **Save**.
4. Check **Enforce HTTPS**.

### In your domain registrar's DNS settings

Add these records:

**For the bare domain (yourdomain.com):**

| Type | Name/Host | Value |
|------|-----------|-------|
| A    | @         | 185.199.108.153 |
| A    | @         | 185.199.109.153 |
| A    | @         | 185.199.110.153 |
| A    | @         | 185.199.111.153 |

**For www:**

| Type  | Name/Host | Value |
|-------|-----------|-------|
| CNAME | www       | ranzlappen.github.io |

### Update your config

1. Edit `_config.yml` in your repo.
2. Change these two lines:
   ```
   url: "https://www.yourdomain.com"
   baseurl: ""
   ```
3. Create a new file in your repo root called `CNAME` (no extension) containing just:
   ```
   www.yourdomain.com
   ```
4. Commit both changes.

DNS can take up to 48 hours to fully work, but usually it's done within an hour.

</details>

---

<details>
<summary><h2>Change Colors or Fonts</h2></summary>

All design settings are in one file: `assets/css/style.css`. Edit it on GitHub by tapping the pencil icon.

### Colors

At the very top of the file you'll see CSS variables. The main ones to change:

```css
--c-accent:      #4ade80;    /* The green accent color */
--c-accent-dim:  #22c55e;    /* Darker green for hover states */
--c-bg:          #0b1210;    /* Page background */
--c-text:        #dce8e2;    /* Main text color */
```

Change the hex values to any color you want. Use a color picker like [htmlcolorcodes.com](https://htmlcolorcodes.com/) to find hex codes.

There's also a `[data-theme="light"]` section further down — those are the light mode colors.

### Fonts

Find these variables near the top:

```css
--f-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...
--f-heading: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...
```

To use a Google Font instead, add a line in `_includes/head.html` before the CSS link:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet">
```

Then change the variable:

```css
--f-body: 'Inter', sans-serif;
```

</details>

---

<details>
<summary><h2>Tune the Blog Carousel</h2></summary>

The blog page (`/blog/`) has a carousel view where cards snap gently into the viewport center as you scroll. All tuning values live in one place: the CSS variables at the top of `assets/css/style.css`, under `/* Carousel tuning */`.

### Numeric values (CSS custom properties)

| Variable | Default | What it does |
|----------|---------|--------------|
| `--carousel-gap` | `3rem` | Space between cards. Increase for more breathing room. |
| `--carousel-fade-min` | `0.35` | How faded off-center cards get. `0` = fully invisible, `1` = no fading at all. |
| `--carousel-scale-min` | `0.94` | How small off-center cards shrink. `1` = no shrink, `0.8` = very dramatic. |
| `--carousel-tilt-up` | `4` | Tilt angle (degrees) for cards scrolled above center. Higher = more dramatic 3D. |
| `--carousel-tilt-down` | `3` | Tilt angle (degrees) for cards scrolled below center. |
| `--carousel-focus-range` | `0.55` | How far from center (fraction of viewport height) before maximum fade/scale kicks in. **Lower = snappier transitions, higher = gradual.** |
| `--carousel-bottom-pad` | `40vh` | Bottom padding so the last card can reach the viewport center for snapping. |

### Snap behavior (keyword properties)

These control how "sticky" the snapping feels. They can't use CSS variables — edit them directly on their rules in `style.css`:

| Property | Where to find it | Default | Options |
|----------|-----------------|---------|---------|
| `scroll-snap-type` | `.carousel-active` rule | `y mandatory` | `y proximity` (gentle, hybrid) or `y mandatory` (strict, TikTok-like) |
| `overscroll-behavior-y` | `.carousel-active` rule | `auto` | `auto` (allows pull-to-refresh) or `contain` (blocks browser pull-to-refresh) |
| `scroll-snap-align` | `.carousel-active .page-content` rule | `start` | `start`, `center`, or `end` for where top-level page content snaps |
| `scroll-snap-align` | `.carousel-card` rule | `center` | `start`, `center`, or `end` — where the card lands in the viewport |
| `scroll-snap-stop` | `.carousel-card` rule | `always` | `normal` (fast scroll can skip cards) or `always` (must stop at every card) |

> Note: use `.carousel-active .page-content { scroll-snap-align: start; }` so the page can still return to the true top position behind the fixed site header.

### Preset: more like TikTok

```css
/* In .carousel-active: */
scroll-snap-type: y mandatory;

/* In .carousel-card: */
scroll-snap-stop: always;

/* In :root: */
--carousel-focus-range: 0.35;
--carousel-fade-min: 0.15;
--carousel-scale-min: 0.88;
```

### Preset: more like normal scrolling

```css
/* In :root: */
--carousel-focus-range: 0.75;
--carousel-fade-min: 0.6;
--carousel-scale-min: 0.98;
--carousel-tilt-up: 1;
--carousel-tilt-down: 1;
```

</details>

---

<details>
<summary><h2>Moderate Comments and Votes</h2></summary>

### Comments

Comments live in your repo's **Discussions** tab. You can:

- **Delete** any comment by opening the discussion and using the three-dot menu.
- **Lock** a discussion to prevent new comments.
- **Disable comments** on a specific post by editing its file and changing `comments: true` to `comments: false`.
- **Disable all comments** by removing `repo_id` from the `giscus:` section in `_config.yml`.

### Votes

Vote data lives in your Firebase console:

1. Go to [console.firebase.google.com](https://console.firebase.google.com/).
2. Open your project → **Realtime Database**.
3. You'll see the data organized as: `votes` → `post-name` → `section-name` → `up`, `down`, `voters`.
4. To **reset votes** for a post: hover over the post name and tap the **X** to delete it.
5. To **wipe everything**: delete the entire `votes` node.

</details>

---

<details>
<summary><h2>Fullstack Architecture</h2></summary>

This site is a hybrid: a Jekyll static blog plus two embedded React single-page apps (**PolyVote** and **Blog Admin**). All three, plus the Firebase Cloud Functions that back server-side writes, are deployed through two GitHub Actions pipelines. The tables below document every technology in the stack, its role, and why it was chosen.

### Stack Overview

| Technology | Layer | Role | Dependencies | Why This Choice |
|---|---|---|---|---|
| **Jekyll 4.3** | Static Site | Site generator — Liquid templates, Markdown content, auto-built pages | `jekyll ~> 4.3` (Ruby gem) | Native GitHub Pages support, zero-JS content delivery, low maintenance |
| **jekyll-seo-tag** | Static Site | Injects `<meta>` and Open Graph tags into every page | Ruby gem | SEO and social-media link previews out of the box |
| **jekyll-paginate** | Static Site | Splits the blog listing into multiple pages | Ruby gem | Keeps page loads fast as the post count grows |
| **Custom feed + sitemap** | Static Site | `feed.xml` and `sitemap.xml` are custom Liquid templates, not plugins — they filter posts by the `status` frontmatter so drafts/unpublished posts never leak | None | `jekyll-feed`/`jekyll-sitemap` can't filter by frontmatter; custom templates can |
| **Custom CSS** | Static Site | Dark-first theme using CSS custom properties | None (vanilla CSS) | Full control, no build step, tiny footprint |
| **Vanilla JS modules** | Static Site | Dark mode, search, carousel, voting sidebar, read-aloud, charts | Chart.js (CDN) | No bundler needed; each feature is one self-contained file |
| | | | | |
| **React 19** | App (PolyVote, Blog Admin) | UI framework for both SPAs | `react`, `react-dom` | Component model suited for real-time, interactive UIs |
| **TypeScript** | Both apps + Functions | Static type checking | `typescript` (dev) | Catches bugs at build time; self-documenting |
| **Vite 5** | App (PolyVote) | Dev server and production bundler | `vite`, `@vitejs/plugin-react` | Fast HMR, native ESM, minimal config |
| **Vite 8** | App (Blog Admin) | Dev server and production bundler | `vite`, `@vitejs/plugin-react` | Same reasons as above; newer version ships with the `@tailwindcss/vite` plugin |
| **Tailwind CSS 3** | App (PolyVote) | Utility-first CSS framework | `tailwindcss`, `postcss`, `autoprefixer` | Matches the blog's dark theme; class-based dark mode |
| **Tailwind CSS 4** | App (Blog Admin) | Utility-first CSS framework | `@tailwindcss/vite` (no PostCSS config needed) | Newer config style; simpler setup; dark-only app |
| **react-router-dom v6** | App (PolyVote) | Client-side routing | `react-router-dom` | Stable, widely used |
| **react-router-dom v7** | App (Blog Admin) | Client-side routing | `react-router-dom` | Latest major; admin app built fresh so no migration cost |
| **Zustand 5** | Both apps | Global state (auth, toasts, drafts, vote history) | `zustand` | Minimal boilerplate; lightweight store |
| **CodeMirror 6** | App (Blog Admin) | Markdown editor with syntax highlighting | `@codemirror/{state,view,commands,search,lang-markdown,language-data}` | Battle-tested, extensible, works well with Markdown |
| **react-markdown + remark-gfm + rehype-raw** | Both apps | Markdown rendering for previews | npm | GFM tables/tasks + raw HTML passthrough |
| **Chart.js + react-chartjs-2** | App (PolyVote) | Radar chart for multi-metric votes | `chart.js`, `react-chartjs-2` | Vote distribution visible at a glance |
| **Framer Motion 11** | App (PolyVote) | UI animations | `framer-motion` | Declarative animation API for React |
| **Lucide React** | App (PolyVote) | SVG icon library | `lucide-react` | Tree-shakeable, consistent icons |
| **date-fns 4** | App (PolyVote) | Date formatting ("2 hours ago") | `date-fns` | Lightweight, modular |
| | | | | |
| **Firebase Firestore** | Backend | NoSQL database for PolyVote topics/requests/votes and Blog Admin drafts | `firebase` SDK | Real-time listeners, serverless, free tier |
| **Firebase Realtime Database** | Backend | Vote counters for the Jekyll voting sidebar | `firebase` SDK (Jekyll: CDN) | Low-latency counters; simpler than Firestore for flat key-value data |
| **Firebase Anonymous Auth** | Backend (PolyVote) | User identity without signup | `firebase` SDK | Enables per-browser vote rules with zero user friction |
| **Firebase Auth (email/password + custom claims)** | Backend (Blog Admin) | Admin identity + role claims | `firebase` SDK | Role-based access without a Firestore lookup per call |
| **Cloud Functions (Node 22)** | Backend | Server-validated writes — all client mutations go through callables | `firebase-admin`, `firebase-functions`, `gray-matter`, `@octokit/rest`, `js-yaml` | Clients never write to Firestore directly; rules + functions enforce invariants. `blogPublishToGitHub` commits published posts back to the repo via the GitHub API |
| **Giscus** | Backend | Blog comments via GitHub Discussions | Embedded `<script>` | Comments live in the repo — no extra DB |
| **hCaptcha** | Backend | Contact form spam protection | Embedded `<script>` | Free, privacy-respecting CAPTCHA |
| | | | | |
| **GitHub Pages** | Hosting | Static hosting with automatic HTTPS | None | Free, custom domain support |
| **GitHub Actions** | CI/CD | Builds + deploys both SPAs and Cloud Functions | Workflow YAML (`.github/workflows/`) | Two pipelines: `jekyll-gh-pages.yml` for the site, `firebase-deploy.yml` for Firebase resources |
| **Node.js 22** | CI/CD + Functions runtime | Runs all JS builds and the deployed Cloud Functions | Enforced via `engines.node` and workflow config | Required by current Vite/TypeScript toolchains and the Firebase runtime |

### How It All Connects

Two pipelines fire on push to `main` (scoped by path filter — unrelated changes skip):

```
Push to main
  │
  ├─► jekyll-gh-pages.yml ──────────────────────────────► GitHub Pages
  │     ├─ Jekyll build ─────────────────► _site/
  │     ├─ polyvote:    npm ci && build ─► _site/polyvote/
  │     ├─ blog-admin:  npm ci && build ─► _site/blog-admin/
  │     └─ Deploy _site/ to Pages
  │
  └─► firebase-deploy.yml ──────────────────────────────► Firebase
        ├─ functions: npm ci && build
        └─ firebase deploy --only database,firestore,functions:castBlogVote,functions:blog*
```

The result is a single static deployment where:
- `/` serves the Jekyll blog (Markdown → HTML, Liquid templates, vanilla JS)
- `/polyvote/` serves the PolyVote SPA (TypeScript → bundled JS, Tailwind v3)
- `/blog-admin/` serves the Blog Admin SPA (TypeScript → bundled JS, Tailwind v4, auth-gated)
- Firebase (Firestore + RTDB + Cloud Functions) is shared across all three

### Shared Design Tokens

Jekyll and PolyVote share a visual identity so the embedded app feels native: Jekyll defines colors via CSS custom properties (e.g. `--c-accent: #4ade80`) and PolyVote mirrors them in its Tailwind config. Dark mode is class-based in both (`[data-theme="dark"]` for Jekyll, `darkMode: 'class'` for PolyVote). Blog Admin is dark-only by design and uses its own CSS variables on `:root`.

</details>

---

<details>
<summary><h2>Quick Reference</h2></summary>

| I want to...               | Do this                                                        |
|-----------------------------|----------------------------------------------------------------|
| Write a new post            | Create a `.md` file in `_posts/` on GitHub                     |
| Edit a post                 | Open the file on GitHub → tap pencil → edit → commit           |
| Delete a post               | Open the file on GitHub → tap three dots → Delete              |
| Save a post as draft        | Add `status: draft` to the post's frontmatter                  |
| Publish a draft             | Remove the `status` line or change it to `status: published`   |
| Change site name            | Edit `title` in `_config.yml`                                  |
| Change colors               | Edit CSS variables at top of `assets/css/style.css`            |
| Add a nav link              | Edit `_data/pages.yml`                                         |
| Add a new page              | Create a `.md` file in `pages/` with layout/permalink headers  |
| Moderate a comment          | Go to repo → Discussions tab → find and manage it              |
| Check contact messages      | Go to repo → Issues tab → look for `[Contact]` labels         |
| Add an image carousel       | Wrap `<img>` tags in `<div class="carousel">` in your post     |
| Enable a parallax backdrop  | Add `backdrop: /assets/images/.../hero.webp` to the post's front matter |
| Use the author dashboard    | Visit `/blog-admin/` (or `npm run dev` inside `blog-admin/`) and log in |
| Add a bar chart             | Use `<canvas data-chart="bar">` inside `<div class="chart-container">` |
| Add a data table            | Write a plain Markdown table (`\| Col \| Col \|`) — it's auto-styled like the reference pages |
| Add source citations        | Use `<sup><a href="#source-1">[1]</a></sup>` inline + `<ol>` at bottom |
| Upload an image for a post  | Upload to `assets/images/` on GitHub, reference in your post   |
| Run PolyVote locally        | `cd polyvote && npm install && npm run dev`                    |
| Run Blog Admin locally      | `cd blog-admin && npm install && npm run dev`                  |
| Run Cloud Functions emulator | `cd polyvote/functions && npm install && npm run serve`       |

</details>

---

<details>
<summary><h2>Project Structure</h2></summary>

```
your-repo/
├── _config.yml              ← Site settings (name, Giscus, Firebase keys)
├── _data/pages.yml          ← Menu links (header and footer)
├── _posts/                  ← Your blog posts go here (one .md file each)
├── _includes/               ← Page building blocks (don't need to touch)
├── _layouts/                ← Page templates (don't need to touch)
├── assets/css/style.css     ← All design and colors
├── assets/js/               ← Functionality (don't need to touch)
├── assets/images/           ← Put your images here
├── pages/                   ← Static pages (About, Contact, etc.)
├── index.html               ← Homepage
├── feed.xml                 ← RSS/Atom feed (custom Liquid template, filtered by status)
├── sitemap.xml              ← Sitemap (custom Liquid template, filtered by status)
├── 404.html                 ← Page not found page
│
├── polyvote/                ← React 19 voting SPA — see polyvote/README.md
│   └── functions/           ← Firebase Cloud Functions — see polyvote/functions/README.md
├── blog-admin/              ← React 19 publishing dashboard — see blog-admin/README.md
│
├── .github/workflows/       ← CI + two deploy pipelines (Pages, Firebase)
├── CLAUDE.md                ← Architecture source of truth (read this first as a developer)
└── README.md                ← This file
```

**For blog-only maintenance** (no code needed) you only touch:
- `_posts/` — to write articles
- `_config.yml` — to change settings or add API keys
- `assets/css/style.css` — to change the look
- `assets/images/` — to upload images
- `pages/` — to edit About, Contact, etc.

**For app development** see:
- [`polyvote/README.md`](./polyvote/README.md) — PolyVote voting app
- [`blog-admin/README.md`](./blog-admin/README.md) — Blog Admin publishing dashboard
- [`polyvote/functions/README.md`](./polyvote/functions/README.md) — Cloud Functions
- [`CLAUDE.md`](./CLAUDE.md) — architecture, conventions, CI/CD

Everything else runs automatically.

</details>
