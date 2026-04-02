---
layout: page
title: Privacy Policy
subtitle: How your data is handled
permalink: /privacy/
---

## Overview

This website respects your privacy. Here's exactly what data is collected and why.

## Static Hosting

This site is hosted on **GitHub Pages**. GitHub may collect basic server logs (IP addresses, browser info) as part of their hosting service. See [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) for details.

## Comments (Giscus)

Comments are powered by **Giscus**, which uses GitHub Discussions. To leave a comment, you log in with your GitHub account. Giscus does not track you beyond what GitHub itself collects. No additional cookies are set by the comment system.

## Voting System (Firebase)

The per-section voting feature uses **Google Firebase Realtime Database** to store anonymous votes. Your IP address is fetched via a third-party service (ipify) and hashed — the raw IP is never stored. A hashed identifier is used solely to prevent duplicate voting. No personal information is stored alongside votes. Firebase may set cookies or use browser storage for App Check and session management as part of its normal operation.

## Contact Form (hCaptcha)

The contact form uses **hCaptcha** for spam protection. hCaptcha may set cookies and collect data as described in their [privacy policy](https://www.hcaptcha.com/privacy). Contact form submissions are created as **public** GitHub Issues in the site's repository. This means your name (or alias), email address (if provided), and message content will be publicly visible on GitHub. Do not include sensitive personal information in your submission.

## Search (Lunr.js)

The site's full-text search feature loads the **Lunr.js** library from the unpkg CDN (`unpkg.com`). When you use search, your browser makes a request to unpkg's servers, which may receive your IP address and browser information as part of a standard HTTP request. The search itself runs entirely in your browser — no search queries are sent to any server.

## Read Aloud

The read aloud feature uses your browser's built-in **Web Speech API** to convert article text to speech. No data is sent to any external service — all processing happens locally on your device.

## Analytics

This site does **not** use Google Analytics or any other tracking/analytics service. No tracking cookies are set.

## Browser Storage Viewer

This site includes a transparency tool (accessible via the 🍪 icon in the footer) that lets you inspect all cookies, localStorage, sessionStorage, and Cache Storage entries set by this site and its third-party services. This viewer is purely informational — it reads browser storage but does not transmit any data. Everything happens locally in your browser.

## Cookies & Local Storage

This site does not set any first-party cookies. It uses `localStorage` (not cookies) to remember your theme preference (dark/light), view mode (grid/list), voting state, and a fallback visitor identifier for vote deduplication. This data never leaves your browser.

Third-party services loaded on this site — specifically **Firebase** (on pages with voting) and **hCaptcha** (on the contact form) — may set their own cookies for functionality such as bot detection and session management. These are not used for tracking or advertising.

## Third-Party Services Summary

| Service | Purpose | Data collected | Sets cookies? |
|---------|---------|----------------|---------------|
| GitHub Pages | Hosting | Server logs | No |
| Giscus | Comments | GitHub account (login required) | No |
| Firebase | Voting | Hashed IP (anonymous) | May set functional cookies |
| hCaptcha | Spam protection | See hCaptcha privacy policy | Yes (bot detection) |
| ipify | IP detection for voting | IP address (hashed, not stored raw) | No |
| unpkg CDN | Search library delivery | IP address, browser info (standard HTTP request) | No |
| Ko-fi | Donation/support (external link) | Only if you click the link and visit Ko-fi | See Ko-fi's policy |

The footer contains a link to **Ko-fi** for optional support/donations. Clicking this link takes you to Ko-fi's website, which is governed by their own [privacy policy](https://more.ko-fi.com/privacy). No data is shared with Ko-fi unless you voluntarily visit their site.

## Your Rights

Since no personal data is stored on this site's own infrastructure, there is minimal data to manage. If you want a comment removed, you can delete it yourself on GitHub Discussions or contact me through the [contact page](/contact/).

## Changes

This policy may be updated from time to time. Changes will be reflected on this page.

*Last updated: {{ 'now' | date: '%B %Y' }}*
