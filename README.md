# Ranzlappen — Jekyll Blog

A clean, dark-themed personal blog built with Jekyll, vanilla CSS, and zero frameworks. Features include per-section voting, Giscus comments, client-side search, and a contact form that submits to GitHub Issues.

---

## Table of Contents

1. [Local Setup](#local-setup)
2. [Deploy to GitHub Pages](#deploy-to-github-pages)
3. [How to Add a New Post](#how-to-add-a-new-post)
4. [Enable Giscus Comments](#enable-giscus-comments)
5. [Set Up Firebase (Voting Sidebar)](#set-up-firebase-voting-sidebar)
6. [Set Up hCaptcha (Contact Form)](#set-up-hcaptcha-contact-form)
7. [Contact Form — GitHub Issues Proxy](#contact-form--github-issues-proxy)
8. [Connect a Custom Domain (Squarespace)](#connect-a-custom-domain-squarespace)
9. [Customize Colors & Fonts](#customize-colors--fonts)
10. [Moderate Comments & Votes](#moderate-comments--votes)
11. [Project Structure](#project-structure)

---

## Local Setup

### Prerequisites

- Ruby 3.0+ (check with `ruby -v`)
- Bundler (`gem install bundler`)
- Git

### Steps

```bash
git clone https://github.com/Ranzlappen/website.git
cd website
bundle install
bundle exec jekyll serve --livereload
```

Open `http://localhost:4000/website/` in your browser.

> **Tip:** If you remove the `baseurl` in `_config.yml` (set it to `""`), the local URL becomes `http://localhost:4000/`.

---

## Deploy to GitHub Pages

1. Push the repository to `https://github.com/Ranzlappen/website`.
2. Go to **Settings → Pages**.
3. Under **Source**, select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder.
5. Click **Save**. Your site will be live at `https://ranzlappen.github.io/website/` within a few minutes.

> **Note:** If you use a custom domain, update `url` in `_config.yml` to your domain and set `baseurl` to `""`.

---

## How to Add a New Post

Create **one file** in `_posts/` using the naming pattern:

```
YYYY-MM-DD-your-post-title.md
```

### Frontmatter Template

```yaml
---
title: "Your Post Title"
date: 2026-04-01
category: "Projects"          # Single category (appears as a label)
tags: [tag1, tag2, tag3]      # Multiple tags
description: "A short description for SEO and social sharing."
image:                        # Optional: path to a hero image, e.g. /assets/images/my-post.jpg
comments: true                # Set to false to disable comments on this post
---

Your markdown content here. Use ## headings for sections — these
automatically appear in the voting sidebar and the comment context selector.
```

### Important

- Use `## Heading` (H2) for sections — these power the voting sidebar and comment section selector.
- Add images to `/assets/images/` and reference them in your post or frontmatter.
- The `category` field should be a single word or phrase. Common ones: `Projects`, `Workflow`, `Thoughts`, `Tutorials`.
- The excerpt is auto-generated from the first paragraph, or you can set `excerpt:` manually in frontmatter.

That's it — one file, push, done.

---

## Enable Giscus Comments

Giscus uses GitHub Discussions as the comment backend. Here's how to set it up:

### Step 1: Enable Discussions

Go to your repo → **Settings → General** → scroll to **Features** → check **Discussions**.

### Step 2: Create a Category

In your repo's **Discussions** tab, create a new category called **Blog Comments** (or whatever you prefer). Set the format to **Announcement** so only the Giscus bot creates new threads.

### Step 3: Get Your Config

Go to [https://giscus.app](https://giscus.app) and fill in:

- **Repository:** `Ranzlappen/website`
- **Page ↔ Discussion mapping:** `pathname`
- **Category:** `Blog Comments`

The tool will generate values for `data-repo-id` and `data-category-id`.

### Step 4: Update `_config.yml`

```yaml
giscus:
  repo: "Ranzlappen/website"
  repo_id: "R_xxxxx"           # ← paste from giscus.app
  category: "Blog Comments"
  category_id: "DIC_xxxxx"     # ← paste from giscus.app
  mapping: "pathname"
  reactions_enabled: "1"
  theme: "preferred_color_scheme"
```

Push and the comment sections will appear on all posts.

---

## Set Up Firebase (Voting Sidebar)

The voting sidebar uses Firebase Realtime Database (free tier: 1 GB stored, 10 GB/month transfer).

### Step 1: Create a Firebase Project

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/).
2. Click **Add project** → name it (e.g., `ranzlappen-votes`) → disable Google Analytics (optional) → **Create project**.

### Step 2: Create a Realtime Database

1. In the Firebase console, go to **Build → Realtime Database**.
2. Click **Create Database**.
3. Choose a region (e.g., `europe-west1`).
4. Start in **locked mode** (we'll set rules next).

### Step 3: Set Database Rules

Go to **Realtime Database → Rules** and paste:

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

Key security features:
- Anyone can read votes (public counters).
- A visitor hash can only be written **once** (prevents vote manipulation).
- Values are validated (must be `"up"` or `"down"`).

### Step 4: Get Your Config

1. In Firebase console → **Project settings** (gear icon) → scroll to **Your apps**.
2. Click **Add app** → choose **Web** → register (no hosting needed).
3. Copy the config values.

### Step 5: Update `_config.yml`

```yaml
firebase:
  api_key: "AIzaSy..."
  project_id: "ranzlappen-votes"
  database_url: "https://ranzlappen-votes-default-rtdb.europe-west1.firebasedatabase.app"
```

Push and the voting sidebar will be functional.

---

## Set Up hCaptcha (Contact Form)

### Step 1: Create an Account

1. Go to [https://www.hcaptcha.com/signup-interstitial](https://www.hcaptcha.com/signup-interstitial).
2. Sign up (free tier is fine for personal sites).

### Step 2: Get Your Site Key

1. In the hCaptcha dashboard, go to **Sites** → **+ New Site**.
2. Add your domain(s): `ranzlappen.github.io` (and your custom domain if applicable).
3. Copy the **Site Key**.

### Step 3: Update `_config.yml`

```yaml
hcaptcha:
  site_key: "your-site-key-here"
```

The hCaptcha widget will appear on the contact page.

---

## Contact Form — GitHub Issues Proxy

The contact form can work in two modes:

### Mode 1: Direct GitHub Link (No Setup Required)

If you leave `contact_form.endpoint` empty in `_config.yml`, the form opens a pre-filled GitHub Issue URL in a new tab. The visitor submits it themselves. This works immediately with zero setup.

### Mode 2: Serverless Proxy (Cloudflare Worker)

For a seamless experience where the visitor never leaves your site, deploy a small Cloudflare Worker that creates GitHub Issues on their behalf:

1. Create a **GitHub Personal Access Token** with `repo` scope at [https://github.com/settings/tokens](https://github.com/settings/tokens).
2. Create a free Cloudflare account at [https://workers.cloudflare.com/](https://workers.cloudflare.com/).
3. Create a new Worker with this code:

```javascript
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { title, body, captcha } = await request.json();

    // Verify hCaptcha
    const captchaResp = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${env.HCAPTCHA_SECRET}&response=${captcha}`,
    });
    const captchaData = await captchaResp.json();
    if (!captchaData.success) {
      return new Response(JSON.stringify({ error: 'CAPTCHA failed' }), { status: 403 });
    }

    // Create GitHub Issue
    const ghResp = await fetch('https://api.github.com/repos/Ranzlappen/website/issues', {
      method: 'POST',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Ranzlappen-Contact-Form',
      },
      body: JSON.stringify({ title, body, labels: ['contact-form'] }),
    });

    if (!ghResp.ok) {
      return new Response(JSON.stringify({ error: 'GitHub API error' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

4. In the Worker settings, add **Environment Variables**:
   - `GITHUB_TOKEN` → your personal access token (encrypt it)
   - `HCAPTCHA_SECRET` → your hCaptcha secret key

5. Deploy the worker and copy its URL (e.g., `https://contact-form.your-subdomain.workers.dev`).

6. Update `_config.yml`:

```yaml
contact_form:
  endpoint: "https://contact-form.your-subdomain.workers.dev"
```

---

## Connect a Custom Domain (Squarespace)

### Step 1: In GitHub

1. Go to repo **Settings → Pages → Custom domain**.
2. Enter your domain (e.g., `www.yourdomain.com`) and click **Save**.
3. Check **Enforce HTTPS**.

### Step 2: In Squarespace DNS

If your domain is registered with Squarespace, go to **Domains → DNS Settings** and add:

**For `yourdomain.com` (apex domain):**

| Type | Host | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

**For `www.yourdomain.com`:**

| Type | Host | Value |
|------|------|-------|
| CNAME | www | ranzlappen.github.io |

### Step 3: Update `_config.yml`

```yaml
url: "https://www.yourdomain.com"
baseurl: ""
```

### Step 4: Create a CNAME File

Create a file called `CNAME` in the repo root containing just your domain:

```
www.yourdomain.com
```

DNS propagation takes up to 48 hours. HTTPS will be provisioned automatically by GitHub.

---

## Customize Colors & Fonts

All visual settings are controlled via CSS variables in `assets/css/style.css` at the top of the file.

### Colors

Edit the `:root` block for dark theme and `[data-theme="light"]` for light theme:

```css
:root {
  --c-bg:          #0b1210;    /* Page background */
  --c-surface:     #15201b;    /* Cards, header */
  --c-accent:      #4ade80;    /* Primary accent (green) */
  --c-accent-dim:  #22c55e;    /* Hover state */
  --c-text:        #dce8e2;    /* Main text */
  --c-text-muted:  #7e948a;    /* Secondary text */
  /* ... more variables */
}
```

### Fonts

Replace the `--f-body` and `--f-heading` values. For Google Fonts, add a `<link>` in `_includes/head.html` and update the variable:

```css
--f-body: 'Inter', sans-serif;
--f-heading: 'Space Grotesk', sans-serif;
```

### Spacing & Layout

```css
--max-width: 72rem;      /* Max page width */
--content-width: 48rem;  /* Max post/page width */
--border-radius: 0.5rem; /* Corner rounding */
```

---

## Moderate Comments & Votes

### Comments (Giscus / GitHub Discussions)

- Comments live in your repo's **Discussions** tab.
- Delete, lock, or hide individual comments directly on GitHub.
- To disable comments on a specific post, set `comments: false` in its frontmatter.
- To disable comments site-wide, remove `giscus.repo_id` from `_config.yml`.

### Votes (Firebase)

- View and manage vote data in the [Firebase Console](https://console.firebase.google.com/) → **Realtime Database**.
- Data is organized as `votes / [post-slug] / [section-id] / { up, down, voters }`.
- To reset votes for a post, delete its node in the database.
- To ban a voter, delete their hash from the `voters` node (they can then vote again — but the IP-hash system prevents most abuse).
- To wipe all votes, delete the entire `votes` node.

---

## Project Structure

```
website/
├── _config.yml              # Site configuration
├── _data/
│   └── navigation.yml       # Header & footer nav links
├── _includes/
│   ├── head.html            # <head> meta, CSS, OG tags
│   ├── header.html          # Sticky header + mobile menu
│   ├── footer.html          # Footer with social links
│   ├── hero.html            # Homepage hero section
│   ├── post-card.html       # Blog card (grid view)
│   ├── post-list-item.html  # Blog row (list view)
│   ├── giscus.html          # Giscus comment widget
│   └── search-modal.html    # Search overlay
├── _layouts/
│   ├── default.html         # Base HTML shell
│   ├── home.html            # Homepage with hero + posts
│   ├── page.html            # Static pages
│   └── post.html            # Blog post with sidebar + comments
├── _posts/
│   ├── 2026-03-10-automating-garden-raspberry-pi.md
│   ├── 2026-03-20-tracking-everything-plain-text.md
│   └── 2026-03-28-building-custom-mechanical-keyboard.md
├── assets/
│   ├── css/
│   │   └── style.css        # All styles (CSS variables, responsive)
│   ├── js/
│   │   ├── main.js          # Header, theme, menu, progress bar
│   │   ├── search.js        # Lunr.js search
│   │   └── voting-sidebar.js # Firebase voting + scroll spy
│   └── images/
│       └── favicon.png      # ← Replace with your favicon
├── pages/
│   ├── about.md
│   ├── blog.html
│   ├── categories.html
│   ├── contact.html
│   ├── disclaimer.md
│   ├── privacy.md
│   └── tags.html
├── 404.html
├── index.html
├── search.json              # Search index (auto-generated)
├── robots.txt
├── Gemfile
├── .gitignore
└── README.md
```

---

## License

This project's code is open source. Content (blog posts) is copyrighted by the author unless stated otherwise.
