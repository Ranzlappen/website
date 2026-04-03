# RanzLappen — Personal Blog

A clean, dark-themed personal blog. No coding required to set up or maintain — everything is done through GitHub's website (works on your phone).

---

## Table of Contents

1. [Get Your Blog Online (5 minutes)](#get-your-blog-online)
2. [How to Write a New Post](#how-to-write-a-new-post)
3. [Article Status (Draft / Unpublished)](#article-status)
4. [Add an Image Carousel](#add-an-image-carousel)
5. [Add a Bar Chart](#add-a-bar-chart)
6. [Add a Pie Chart](#add-a-pie-chart)
7. [Add a Line Chart](#add-a-line-chart)
8. [Built-in Features](#built-in-features)
9. [Enable Comments (Giscus)](#enable-comments-giscus)
10. [Enable Voting Sidebar (Firebase)](#enable-voting-sidebar-firebase)
11. [Enable Contact Form CAPTCHA (hCaptcha)](#enable-contact-form-captcha-hcaptcha)
12. [Connect Your Own Domain](#connect-your-own-domain)
13. [Change Colors or Fonts](#change-colors-or-fonts)
14. [Moderate Comments and Votes](#moderate-comments-and-votes)

---

<details>
<summary><h2>Get Your Blog Online</h2></summary>

You already have the repo at [github.com/Ranzlappen/website](https://github.com/Ranzlappen/website). If the files from the zip aren't uploaded yet:

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
| `placeholder` | **Visible in all listings** (homepage, blog, categories, tags, search, feeds, sitemap) with a status badge. Still shows a banner on the article page: *"This article is a draft and may be incomplete or subject to change."* Use this for articles that are in progress but should already appear on the site. |
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

The post itself **remains fully accessible** if someone visits its URL directly — they'll just see a small disclaimer banner at the top of the article.

**Note:** `placeholder` articles are **not** hidden. They appear in all listings with a yellow "Placeholder" badge, making them useful for reserving spots on the site while the content is still being written.

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

<!--
CHANGE: Complete rewrite of chart documentation with accessibility, all three chart types, and real-world examples
REASON: Chart system overhaul — new WCAG 2.1 AA accessible chart presets
DATE: 2026-04-03
-->

<details>
<summary><h2>Add a Bar Chart</h2></summary>

Embed responsive, accessible bar charts directly in any post — no JavaScript, no external libraries, just HTML + CSS. Charts adapt to dark/light theme, respect `prefers-reduced-motion`, and support screen readers via ARIA attributes.

### Minimal example

```html
<div class="bar-chart" role="figure" aria-label="Monthly sales">
  <div class="bar" style="--h:42%" role="meter" aria-valuenow="42" aria-valuemin="0" aria-valuemax="100" aria-label="Jan: 42" tabindex="0"><span>42</span><div class="bar-label">Jan</div></div>
  <div class="bar" style="--h:68%" role="meter" aria-valuenow="68" aria-valuemin="0" aria-valuemax="100" aria-label="Feb: 68" tabindex="0"><span>68</span><div class="bar-label">Feb</div></div>
  <div class="bar" style="--h:89%" role="meter" aria-valuenow="89" aria-valuemin="0" aria-valuemax="100" aria-label="Apr: 89" tabindex="0"><span>89</span><div class="bar-label">Apr</div></div>
</div>
```

Each bar needs:
- `style="--h:XX%"` — bar height as a percentage (0–100%)
- `<span>` — value label shown above the bar
- `<div class="bar-label">` — category label shown below
- **Accessibility:** `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`, and `tabindex="0"`

The container should have:
- `role="figure"` and `aria-label="Chart description"` — provides a text alternative for screen readers

### Add a title

```html
<div class="bar-chart" role="figure" aria-label="Monthly Revenue">
  <div class="bar-chart__title">Monthly Revenue</div>
  <div class="bar" style="--h:65%" role="meter" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100" aria-label="Q1: $650" tabindex="0"><span>$650</span><div class="bar-label">Q1</div></div>
  <div class="bar" style="--h:82%" role="meter" aria-valuenow="82" aria-valuemin="0" aria-valuemax="100" aria-label="Q2: $820" tabindex="0"><span>$820</span><div class="bar-label">Q2</div></div>
  <div class="bar" style="--h:91%" role="meter" aria-valuenow="91" aria-valuemin="0" aria-valuemax="100" aria-label="Q3: $910" tabindex="0"><span>$910</span><div class="bar-label">Q3</div></div>
</div>
```

### Color each bar individually

Add a color class to any bar:

| Class | Color |
|-------|-------|
| *(default)* | Green (site accent) |
| `bar--blue` | Blue |
| `bar--red` | Red |
| `bar--amber` | Amber / Yellow |
| `bar--purple` | Purple |
| `bar--pink` | Pink |
| `bar--cyan` | Cyan |
| `bar--slate` | Grey |
| `bar--green` | Green (explicit) |

Or use any custom color inline: `style="--h:70%; --bar-bg:#ff6600"`

### Change the chart size

| Class | Height |
|-------|--------|
| `bar-chart--sm` | `10rem` |
| *(default)* | `16rem` |
| `bar-chart--lg` | `22rem` |
| `bar-chart--xl` | `30rem` |

Or set an exact height inline: `style="--chart-height: 20rem;"`

### Customize everything

All visual properties can be overridden with CSS variables on the `.bar-chart` container:

| Variable | What it controls | Default |
|----------|-----------------|---------|
| `--chart-height` | Total chart height | `16rem` (responsive) |
| `--chart-max-width` | Maximum chart width | `100%` |
| `--chart-bg` | Chart background color | Theme surface color |
| `--chart-border` | Chart border color | Theme border color |
| `--chart-gap` | Space between bars | Fluid `4px–14px` |
| `--chart-pad-x` | Left/right padding | Fluid `10px–24px` |
| `--chart-pad-top` | Top padding | Fluid `28px–40px` |
| `--bar-color` | Default bar color | Theme accent color |
| `--bar-radius` | Bar corner rounding | Small radius |
| `--val-color` | Value label color | Theme text color |
| `--val-size` | Value label font size | Fluid `0.6–0.8rem` |
| `--label-color` | Category label color | Theme muted text |
| `--label-size` | Category label font size | Fluid `0.6–0.78rem` |

### Real-world example (from a post)

```html
<div class="bar-chart bar-chart--lg" role="figure" aria-label="Cognitive Load by Mode and Ambient Light">
  <div class="bar-chart__title">Cognitive Load by Mode and Ambient Light</div>
  <div class="bar bar--cyan" style="--h:58%" role="meter" aria-valuenow="58" aria-valuemin="0" aria-valuemax="100" aria-label="Search Time (Light): 58" tabindex="0"><span>58</span><div class="bar-label">Search Time (Light)</div></div>
  <div class="bar bar--slate" style="--h:74%" role="meter" aria-valuenow="74" aria-valuemin="0" aria-valuemax="100" aria-label="Search Time (Dark): 74" tabindex="0"><span>74</span><div class="bar-label">Search Time (Dark)</div></div>
</div>
```

### Accessibility and responsive behavior

- **Screen readers:** `role="figure"` + `aria-label` on the container; `role="meter"` + `aria-valuenow/min/max` + `aria-label` on each bar
- **Keyboard:** All bars are focusable via `tabindex="0"` with a visible focus ring (3px accent outline)
- **Reduced motion:** Transitions are automatically disabled when `prefers-reduced-motion: reduce` is active
- **High contrast:** Windows High Contrast Mode is fully supported via `forced-colors: active`
- **Print:** Charts render correctly when printed with `print-color-adjust: exact`
- **Mobile** (<600px): shorter height, tighter spacing, smaller text, horizontal scroll for many bars
- **Tablet** (600–900px): medium height
- **Desktop** (900px+): full height, fluid scaling

</details>

---

<details>
<summary><h2>Add a Pie Chart</h2></summary>

Embed responsive, accessible pie charts directly in any post — pure CSS `conic-gradient`, no JavaScript, supports up to 8 slices, with donut variant.

### Minimal example

```html
<div class="pie-chart" style="--s1:42; --s2:28; --s3:18; --s4:12;" role="figure" aria-label="Browser market share">
  <div class="pie-chart__legend" role="list">
    <div class="slice slice--green" data-val="42%" role="listitem" aria-label="Chrome: 42%" tabindex="0"><span>Chrome</span></div>
    <div class="slice slice--blue" data-val="28%" role="listitem" aria-label="Firefox: 28%" tabindex="0"><span>Firefox</span></div>
    <div class="slice slice--amber" data-val="18%" role="listitem" aria-label="Safari: 18%" tabindex="0"><span>Safari</span></div>
    <div class="slice slice--purple" data-val="12%" role="listitem" aria-label="Edge: 12%" tabindex="0"><span>Edge</span></div>
  </div>
</div>
```

Each pie chart needs:
- `--s1`, `--s2`, … `--s8` on the container — slice sizes as unitless numbers (0–100)
- `.slice` elements inside `.pie-chart__legend` with:
  - A color class (e.g. `slice--blue`) — sets the legend swatch
  - `data-val="..."` — displayed value (e.g. `"42%"`)
  - `<span>` — the label text
- **Accessibility:** `role="figure"` + `aria-label` on container; `role="list"` on legend; `role="listitem"` + `aria-label` + `tabindex="0"` on each slice

### Add a title

```html
<div class="pie-chart" style="--s1:55; --s2:30; --s3:15;" role="figure" aria-label="Market Share">
  <div class="pie-chart__title">Market Share</div>
  <div class="pie-chart__legend" role="list">
    <div class="slice slice--green" data-val="55%" role="listitem" aria-label="Product A: 55%" tabindex="0"><span>Product A</span></div>
    <div class="slice slice--blue" data-val="30%" role="listitem" aria-label="Product B: 30%" tabindex="0"><span>Product B</span></div>
    <div class="slice slice--amber" data-val="15%" role="listitem" aria-label="Product C: 15%" tabindex="0"><span>Product C</span></div>
  </div>
</div>
```

### Color each slice

| Class | Color |
|-------|-------|
| *(default)* | Green (site accent) |
| `slice--blue` | Blue |
| `slice--red` | Red |
| `slice--amber` | Amber / Yellow |
| `slice--purple` | Purple |
| `slice--pink` | Pink |
| `slice--cyan` | Cyan |
| `slice--slate` | Grey |
| `slice--green` | Green (explicit) |

Custom colors: override `--c1`–`--c8` on the container and `--slice-color` on each legend entry.

### Donut variant

```html
<div class="pie-chart pie-chart--donut" style="--s1:50; --s2:30; --s3:20;" role="figure" aria-label="Project progress">
  <div class="pie-chart__legend" role="list">
    <div class="slice slice--green" data-val="50%" role="listitem" aria-label="Complete: 50%" tabindex="0"><span>Complete</span></div>
    <div class="slice slice--amber" data-val="30%" role="listitem" aria-label="In Progress: 30%" tabindex="0"><span>In Progress</span></div>
    <div class="slice slice--slate" data-val="20%" role="listitem" aria-label="Remaining: 20%" tabindex="0"><span>Remaining</span></div>
  </div>
</div>
```

Custom donut thickness: `style="--pie-donut:60%;"`

### Change the chart size

| Class | Pie diameter |
|-------|-------------|
| `pie-chart--sm` | `7–10rem` |
| *(default)* | `10–18rem` |
| `pie-chart--lg` | `14–22rem` |
| `pie-chart--xl` | `18–28rem` |

Or set an exact size inline: `style="--pie-size: 20rem;"`

### Customize everything

| Variable | What it controls | Default |
|----------|-----------------|---------|
| `--pie-size` | Diameter of the pie circle | Fluid `10–18rem` |
| `--pie-bg` | Chart background color | Theme surface color |
| `--pie-border` | Chart border color | Theme border color |
| `--pie-donut` | Donut hole size (`0%` = full pie) | `0%` |
| `--c1` – `--c8` | Slice colors in the pie | Built-in 8-color palette |
| `--s1` – `--s8` | Slice sizes (unitless, 0–100) | `0` |
| `--legend-label-color` | Legend label text color | Theme text color |
| `--legend-label-size` | Legend label font size | Fluid `0.65–0.82rem` |
| `--legend-val-color` | Legend value text color | Theme muted text |
| `--legend-val-size` | Legend value font size | Fluid `0.6–0.78rem` |

### Real-world example (from a post)

```html
<div class="pie-chart" style="--s1:34; --s2:12; --s3:26; --s4:16; --s5:12;" role="figure" aria-label="Trust in Journalists by Type 2025">
  <div class="pie-chart__title">Trust in Journalists by Type 2025</div>
  <div class="pie-chart__legend" role="list">
    <div class="slice slice--green" data-val="34%" role="listitem" aria-label="Independent / Online: 34%" tabindex="0"><span>Independent / Online</span></div>
    <div class="slice slice--blue" data-val="12%" role="listitem" aria-label="National Outlets: 12%" tabindex="0"><span>National Outlets</span></div>
    <div class="slice slice--amber" data-val="26%" role="listitem" aria-label="Local News: 26%" tabindex="0"><span>Local News</span></div>
    <div class="slice slice--purple" data-val="16%" role="listitem" aria-label="Social Media: 16%" tabindex="0"><span>Social Media</span></div>
    <div class="slice slice--slate" data-val="12%" role="listitem" aria-label="Other: 12%" tabindex="0"><span>Other</span></div>
  </div>
</div>
```

### Accessibility and responsive behavior

- **Screen readers:** `role="figure"` + `aria-label` on container; `role="list"` / `role="listitem"` with `aria-label` on legend entries
- **Keyboard:** All legend entries are focusable (`tabindex="0"`) with 3px accent focus ring
- **Reduced motion:** Hover transitions disabled for `prefers-reduced-motion: reduce`
- **High contrast:** Pie gradient preserved with `forced-color-adjust: none` in Windows High Contrast
- **Print:** Pie renders with preserved colours via `print-color-adjust: exact`
- **Mobile** (<600px): pie and legend stack vertically, smaller pie, tighter spacing
- **Tablet** (600–900px): medium pie, side-by-side layout
- **Desktop** (900px+): full size, side-by-side layout
- If slices don't add up to 100, the remaining arc is left transparent

</details>

---

<details>
<summary><h2>Add a Line Chart</h2></summary>

Embed responsive, accessible line charts using inline SVG — no JavaScript. Supports multiple data series, grid lines, axis labels, and interactive data points.

### Minimal example

```html
<div class="line-chart" role="figure" aria-label="Monthly Visitors">
  <div class="line-chart__title">Monthly Visitors</div>
  <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Line chart showing monthly visitors from Jan to Apr">
    <g class="line-chart__grid">
      <line x1="40" y1="20" x2="290" y2="20" />
      <line x1="40" y1="65" x2="290" y2="65" />
      <line x1="40" y1="110" x2="290" y2="110" />
      <line x1="40" y1="155" x2="290" y2="155" />
    </g>
    <text class="line-chart__y-label" x="36" y="20">100</text>
    <text class="line-chart__y-label" x="36" y="65">75</text>
    <text class="line-chart__y-label" x="36" y="110">50</text>
    <text class="line-chart__y-label" x="36" y="155">25</text>
    <text class="line-chart__x-label" x="65" y="175">Jan</text>
    <text class="line-chart__x-label" x="140" y="175">Feb</text>
    <text class="line-chart__x-label" x="215" y="175">Mar</text>
    <text class="line-chart__x-label" x="290" y="175">Apr</text>
    <polyline class="line-chart__line line--green" points="65,110 140,65 215,88 290,30" />
    <circle class="line-chart__dot line--green" cx="65" cy="110" tabindex="0"><title>Jan: 50</title></circle>
    <circle class="line-chart__dot line--green" cx="140" cy="65" tabindex="0"><title>Feb: 75</title></circle>
    <circle class="line-chart__dot line--green" cx="215" cy="88" tabindex="0"><title>Mar: 60</title></circle>
    <circle class="line-chart__dot line--green" cx="290" cy="30" tabindex="0"><title>Apr: 95</title></circle>
  </svg>
  <div class="line-chart__legend">
    <div class="line-legend line-legend--green"><span>Visitors</span></div>
  </div>
</div>
```

Each line chart needs:
- `<svg>` with `viewBox` — scales proportionally
- `<polyline class="line-chart__line">` — data line via `points="x,y"` pairs
- `<circle class="line-chart__dot">` — data point markers
- **Accessibility:** `role="figure"` + `aria-label` on container; `role="img"` + `aria-label` on SVG; `tabindex="0"` + `<title>` on dots

### How to map data to SVG coordinates

SVG `(0,0)` is top-left. Typical layout:

| Area | X range | Y range |
|------|---------|---------|
| Y-axis labels | `0–40` | — |
| Plot area | `40–290` | `20–155` |
| X-axis labels | — | `175+` |

Formula: `y = plotBottom - ((value - minValue) / (maxValue - minValue)) * plotHeight`

Example (value 50 in range 0–100): `y = 155 - (50/100) * 135 = 87.5`

### Multiple data series

Add multiple `<polyline>` + `<circle>` groups with different color classes:

```html
<div class="line-chart" role="figure" aria-label="US vs Europe Trust">
  <div class="line-chart__title">US vs Europe Trust (%)</div>
  <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Two-line chart comparing US and Europe trust from 2015 to 2025">
    <g class="line-chart__grid">
      <line x1="40" y1="20" x2="290" y2="20" />
      <line x1="40" y1="65" x2="290" y2="65" />
      <line x1="40" y1="110" x2="290" y2="110" />
      <line x1="40" y1="155" x2="290" y2="155" />
    </g>
    <text class="line-chart__y-label" x="36" y="20">60</text>
    <text class="line-chart__y-label" x="36" y="65">50</text>
    <text class="line-chart__y-label" x="36" y="110">40</text>
    <text class="line-chart__y-label" x="36" y="155">30</text>
    <text class="line-chart__x-label" x="65" y="175">2015</text>
    <text class="line-chart__x-label" x="140" y="175">2018</text>
    <text class="line-chart__x-label" x="215" y="175">2021</text>
    <text class="line-chart__x-label" x="290" y="175">2025</text>
    <polyline class="line-chart__line line--blue" points="65,65 140,88 215,110 290,155" />
    <circle class="line-chart__dot line--blue" cx="65" cy="65" tabindex="0"><title>US 2015: 50%</title></circle>
    <circle class="line-chart__dot line--blue" cx="140" cy="88" tabindex="0"><title>US 2018: 43%</title></circle>
    <circle class="line-chart__dot line--blue" cx="215" cy="110" tabindex="0"><title>US 2021: 37%</title></circle>
    <circle class="line-chart__dot line--blue" cx="290" cy="155" tabindex="0"><title>US 2025: 30%</title></circle>
    <polyline class="line-chart__line line--amber" points="65,20 140,55 215,88 290,110" />
    <circle class="line-chart__dot line--amber" cx="65" cy="20" tabindex="0"><title>Europe 2015: 60%</title></circle>
    <circle class="line-chart__dot line--amber" cx="140" cy="55" tabindex="0"><title>Europe 2018: 48%</title></circle>
    <circle class="line-chart__dot line--amber" cx="215" cy="88" tabindex="0"><title>Europe 2021: 40%</title></circle>
    <circle class="line-chart__dot line--amber" cx="290" cy="110" tabindex="0"><title>Europe 2025: 37%</title></circle>
  </svg>
  <div class="line-chart__legend">
    <div class="line-legend line-legend--blue"><span>United States</span></div>
    <div class="line-legend line-legend--amber"><span>Europe</span></div>
  </div>
</div>
```

### Color classes

| Line class | Legend class | Color |
|------------|-------------|-------|
| *(default)* | *(default)* | Green (site accent) |
| `line--blue` | `line-legend--blue` | Blue |
| `line--red` | `line-legend--red` | Red |
| `line--amber` | `line-legend--amber` | Amber / Yellow |
| `line--purple` | `line-legend--purple` | Purple |
| `line--cyan` | `line-legend--cyan` | Cyan |
| `line--pink` | `line-legend--pink` | Pink |
| `line--slate` | `line-legend--slate` | Grey |
| `line--green` | `line-legend--green` | Green (explicit) |

Custom: `style="stroke:#ff6600"` on polyline, `style="fill:#ff6600; stroke:var(--chart-bg)"` on circles.

### Data-point labels

```html
<text class="line-chart__dot-label" x="65" y="100">50</text>
```

### Change the chart size

| Class | Height |
|-------|--------|
| `line-chart--sm` | `10rem` |
| *(default)* | `16rem` |
| `line-chart--lg` | `22rem` |
| `line-chart--xl` | `30rem` |

Or set an exact height inline: `style="--chart-height: 20rem;"`

### Customize everything

| Variable | What it controls | Default |
|----------|-----------------|---------|
| `--chart-height` | Total chart height | `16rem` (responsive) |
| `--chart-max-width` | Maximum chart width | `100%` |
| `--chart-bg` | Chart background color | Theme surface color |
| `--chart-border` | Chart border color | Theme border color |
| `--chart-pad-x` | Left/right padding | Fluid `10px–24px` |
| `--chart-pad-top` | Top padding (space for title) | Fluid `32px–44px` |
| `--grid-color` | Horizontal grid line color | Theme border-light color |
| `--axis-color` | Axis label text color | Theme faint text |
| `--axis-size` | Axis label font size | Fluid `0.5–0.7rem` |
| `--line-width` | Data line stroke width | `2.5` |
| `--legend-label-color` | Legend label text color | Theme text color |
| `--legend-label-size` | Legend label font size | Fluid `0.65–0.82rem` |

### Accessibility and responsive behavior

- **Screen readers:** `role="figure"` + `aria-label` on container; `role="img"` + `aria-label` on SVG; `<title>` inside each dot for value announcements
- **Keyboard:** All data points focusable (`tabindex="0"`) with enlarged focus ring
- **Reduced motion:** Dot hover transitions disabled for `prefers-reduced-motion: reduce`
- **High contrast:** Lines and dots use `LinkText`/`Canvas` in Windows High Contrast Mode
- **Print:** Charts render with preserved colours
- **Mobile** (<600px): shorter height, tighter padding, smaller dots and labels
- **Tablet** (600–900px): medium height
- **Desktop** (900px+): full height, SVG scales via `viewBox`

</details>

---

<details>
<summary><h2>Built-in Features</h2></summary>

These features work automatically on every post — no setup needed:

| Feature | What it does |
|---------|-------------|
| **Read Aloud** | Converts your article to speech with play/pause, speed, and volume controls (desktop only) |
| **Search** | Full-text search across all posts — press `Ctrl+K` (or `Cmd+K` on Mac) to open |
| **Reading Progress Bar** | Shows how far down the page the reader has scrolled |
| **Dark / Light Theme** | Toggle between dark and light mode — preference is saved |
| **Grid / List View** | Readers can switch between grid cards and a compact list on the blog page |

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
| Add a nav link              | Edit `_data/navigation.yml`                                    |
| Add a new page              | Create a `.md` file in `pages/` with layout/permalink headers  |
| Moderate a comment          | Go to repo → Discussions tab → find and manage it              |
| Check contact messages      | Go to repo → Issues tab → look for `[Contact]` labels         |
| Add an image carousel       | Wrap `<img>` tags in `<div class="carousel">` in your post     |
| Add a bar chart             | Use `<div class="bar-chart">` with `.bar` divs in your post    |
| Upload an image for a post  | Upload to `assets/images/` on GitHub, reference in your post   |

</details>

---

<details>
<summary><h2>Project Structure</h2></summary>

```
your-repo/
├── _config.yml              ← Site settings (name, Giscus, Firebase keys)
├── _data/navigation.yml     ← Menu links (header and footer)
├── _posts/                  ← Your blog posts go here (one .md file each)
├── _includes/               ← Page building blocks (don't need to touch)
├── _layouts/                ← Page templates (don't need to touch)
├── assets/css/style.css     ← All design and colors
├── assets/js/               ← Functionality (don't need to touch)
├── assets/images/           ← Put your images here
├── pages/                   ← Static pages (About, Contact, etc.)
├── index.html               ← Homepage
├── feed.xml                 ← RSS/Atom feed (auto-generated, filtered by status)
├── sitemap.xml              ← Sitemap (auto-generated, filtered by status)
├── 404.html                 ← Page not found page
└── README.md                ← This file
```

**You only ever need to touch these:**
- `_posts/` — to write articles
- `_config.yml` — to change settings or add API keys
- `assets/css/style.css` — to change the look
- `assets/images/` — to upload images
- `pages/` — to edit About, Contact, etc.

Everything else runs automatically.

</details>
