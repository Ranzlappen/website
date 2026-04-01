# Ranzlappen — Personal Blog

A clean, dark-themed personal blog. No coding required to set up or maintain — everything is done through GitHub's website (works on your phone).

---

## Table of Contents

1. [Get Your Blog Online (5 minutes)](#get-your-blog-online)
2. [How to Write a New Post](#how-to-write-a-new-post)
3. [Article Status (Draft / Unpublished)](#article-status)
4. [Add an Image Carousel](#add-an-image-carousel)
5. [Built-in Features](#built-in-features)
6. [Enable Comments (Giscus)](#enable-comments-giscus)
7. [Enable Voting Sidebar (Firebase)](#enable-voting-sidebar-firebase)
8. [Enable Contact Form CAPTCHA (hCaptcha)](#enable-contact-form-captcha-hcaptcha)
9. [Connect Your Own Domain](#connect-your-own-domain)
10. [Change Colors or Fonts](#change-colors-or-fonts)
11. [Moderate Comments and Votes](#moderate-comments-and-votes)

---

## Get Your Blog Online

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

---

## How to Write a New Post

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

---

## Article Status

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

---

## Add an Image Carousel

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

---

## Built-in Features

These features work automatically on every post — no setup needed:

| Feature | What it does |
|---------|-------------|
| **Read Aloud** | Converts your article to speech with play/pause, speed, and volume controls (desktop only) |
| **Search** | Full-text search across all posts — press `Ctrl+K` (or `Cmd+K` on Mac) to open |
| **Reading Progress Bar** | Shows how far down the page the reader has scrolled |
| **Dark / Light Theme** | Toggle between dark and light mode — preference is saved |
| **Grid / List View** | Readers can switch between grid cards and a compact list on the blog page |

---

## Enable Comments (Giscus)

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

---

## Enable Voting Sidebar (Firebase)

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

---

## Enable Contact Form CAPTCHA (hCaptcha)

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

---

## Connect Your Own Domain

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

---

## Change Colors or Fonts

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

---

## Moderate Comments and Votes

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

---

## Quick Reference

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
| Upload an image for a post  | Upload to `assets/images/` on GitHub, reference in your post   |

---

## Project Structure

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
