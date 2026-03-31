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

The contact form uses **hCaptcha** for spam protection. hCaptcha may set cookies and collect data as described in their [privacy policy](https://www.hcaptcha.com/privacy). Contact form submissions are stored as GitHub Issues in the site's repository.

## Analytics

This site does **not** use Google Analytics or any other tracking/analytics service. No tracking cookies are set.

## Cookies & Local Storage

This site does not set any first-party cookies. It uses `localStorage` (not cookies) to remember your theme preference (dark/light), view mode (grid/list), and voting state. This data never leaves your browser.

Third-party services loaded on this site — specifically **Firebase** (on pages with voting) and **hCaptcha** (on the contact form) — may set their own cookies for functionality such as bot detection and session management. These are not used for tracking or advertising.

## Third-Party Services Summary

| Service | Purpose | Data collected | Sets cookies? |
|---------|---------|----------------|---------------|
| GitHub Pages | Hosting | Server logs | No |
| Giscus | Comments | GitHub account (login required) | No |
| Firebase | Voting | Hashed IP (anonymous) | May set functional cookies |
| hCaptcha | Spam protection | See hCaptcha privacy policy | Yes (bot detection) |
| ipify | IP detection for voting | IP address (hashed, not stored raw) | No |

## Your Rights

Since no personal data is stored on this site's own infrastructure, there is minimal data to manage. If you want a comment removed, you can delete it yourself on GitHub Discussions or contact me through the [contact page](/contact/).

## Changes

This policy may be updated from time to time. Changes will be reflected on this page.

*Last updated: {{ 'now' | date: '%B %Y' }}*
