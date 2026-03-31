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

The per-section voting feature uses **Google Firebase Realtime Database** to store anonymous votes. Your IP address is fetched via a third-party service (ipify) and hashed — the raw IP is never stored. A hashed identifier is used solely to prevent duplicate voting. No personal information is stored alongside votes.

## Contact Form (hCaptcha)

The contact form uses **hCaptcha** for spam protection. hCaptcha may set cookies and collect data as described in their [privacy policy](https://www.hcaptcha.com/privacy). Contact form submissions are stored as GitHub Issues in the site's repository.

## Analytics

This site does **not** use Google Analytics or any other tracking/analytics service. No tracking cookies are set.

## Cookies

This site uses `localStorage` (not cookies) to remember your theme preference (dark/light) and view mode (grid/list). This data never leaves your browser.

## Third-Party Services Summary

| Service | Purpose | Data collected |
|---------|---------|----------------|
| GitHub Pages | Hosting | Server logs |
| Giscus | Comments | GitHub account (login required) |
| Firebase | Voting | Hashed IP (anonymous) |
| hCaptcha | Spam protection | See hCaptcha privacy policy |
| ipify | IP detection for voting | IP address (hashed, not stored raw) |

## Your Rights

Since no personal data is stored on this site's own infrastructure, there is minimal data to manage. If you want a comment removed, you can delete it yourself on GitHub Discussions or contact me through the [contact page](/contact/).

## Changes

This policy may be updated from time to time. Changes will be reflected on this page.

*Last updated: {{ 'now' | date: '%B %Y' }}*
