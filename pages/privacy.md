---
layout: page
title: Privacy Policy
subtitle: How your data is handled
permalink: /privacy/
---

# Privacy Policy — RanzLappen

**Last updated: 30 May 2026**

## Controller
The controller within the meaning of the General Data Protection Regulation (GDPR) is me as a private individual:

**RanzLappen**  
Contact: Via the [Contact page](https://www.ranzlappen.com/contact) or by opening a GitHub issue in the repository.

## Scope
This privacy policy applies to the website https://www.ranzlappen.com/ (including all subpages and the PolyVote feature). The site is purely private and non-commercial.

## Legal bases for processing
I process personal data exclusively on the following legal bases of the GDPR:
- **Art. 6(1)(a) GDPR** – Consent (for all “Functional Services” via the cookie consent banner)
- **Art. 6(1)(f) GDPR** – Legitimate interest (e.g. GitHub Pages hosting logs, abuse prevention in voting)
- **Art. 6(1)(b) GDPR** – Performance of a contract (where applicable for comments or contact form)

## Overview
This website respects your privacy. Here's exactly what data is collected and why.

## Static Hosting (GitHub Pages)
This site is hosted on **GitHub Pages**. GitHub may collect basic server logs (IP addresses, browser info) as part of their hosting service.  
**Legal basis:** Legitimate interest (technical provision of the site).  
Further information: [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Comments (Giscus)
Comments are powered by **Giscus**, which uses GitHub Discussions. To leave a comment, you log in with your GitHub account. Giscus does not track you beyond what GitHub itself collects. No additional cookies are set by the comment system.  
**Legal basis:** Consent.

## Voting System & PolyVote (Firebase)
The per-section voting feature on blog posts uses **Google Firebase Realtime Database** to store anonymous votes. Your IP address is fetched via ipify and hashed — the raw IP is never stored. A hashed identifier is used solely to prevent duplicate voting.

**PolyVote** uses:
- Firebase Authentication (anonymous user ID only — no email, name or other personal information)
- Cloud Firestore (topics, votes, change requests, topic requests linked only to the anonymous ID)

Firebase may set cookies or use browser storage for App Check and session management as part of its normal operation. Security is enforced via Firestore security rules.  
**Legal basis:** Consent (via consent banner).  
Firebase is certified under the **EU-U.S. Data Privacy Framework**.

## Contact Form (hCaptcha)
The contact form uses **hCaptcha** for spam protection. hCaptcha may set cookies and collect data as described in their privacy policy.  
Contact form submissions are created as **public** GitHub Issues in the site's repository.  
**Legal basis:** Consent + legitimate interest (abuse prevention).

## Search & Charts (Lunr.js & Chart.js via CDN)
The site's full-text search loads **Lunr.js** from the unpkg CDN, and blog posts that include charts load **Chart.js** from the jsDelivr CDN. Both libraries run entirely in your browser; loading them from a CDN exposes your IP address and browser info to that CDN. Both are blocked until you grant functional consent.  
**Legal basis:** Consent.

## Reference Pages & Interactive Tools
The reference pages (Electromagnetic Spectrum, Electronics Fundamentals, CLI Command Cheat Sheet) and all of their interactive tools — the electronics calculators, the formula wheel, the resistor decoder, and the chmod / find / regex / curl builders — run **entirely in your browser**. No input you type into them is sent to any server. Any state these tools remember (e.g. a calculator's last values) is stored only in your browser's `localStorage` and never leaves your device.  
**Legal basis:** Not applicable — no personal data is processed.

## Read Aloud
The read aloud feature uses the browser’s built-in **Web Speech API**. No data is sent to any external service — everything happens locally.

## Analytics
This site does **not** use Google Analytics or any other tracking/analytics service. No tracking cookies are set.

## Cookie Consent Banner & Consent Management
This site implements a **cookie consent banner** in compliance with GDPR and TTDSG. Before any third-party services are loaded, you are asked for explicit consent. You can choose between two categories:

- **Essential** (always active): localStorage for theme preference, view mode, and consent choice.
- **Functional Services** (opt-in): Firebase (voting & PolyVote), Giscus (comments), hCaptcha (spam protection), Lunr.js/unpkg (search), Chart.js/jsDelivr (charts on posts).

Third-party scripts are **blocked by default** and only loaded after your explicit consent. You can change your choice at any time via the “Cookie Settings” link in the footer.  
Consent is stored in `localStorage` under the key `cookie_consent` for 365 days.

## Cookies & Local Storage
This site does not set any first-party cookies. It only uses `localStorage`, which stays on your device and is never transmitted. The site's own `localStorage` keys are:

- `theme` — light/dark theme preference
- `viewMode` — blog image view mode (e.g. carousel)
- `headerSticky` — whether the site header stays pinned
- `cookie_consent` — your consent choice (kept for 365 days)
- `voted_<post-slug>` — per-post vote deduplication
- `ef:state:*` — saved input values for the Electronics Fundamentals interactive widgets

You can inspect every one of these (and any cookies set by third-party services) at any time via the **Storage Inspector** (the 🍪 button in the footer).  
Third-party services (Firebase, hCaptcha) may set their own functional cookies **only after consent**.

## Third-Party Services Summary

| Service | Purpose | Data collected | Sets cookies? |
|---|---|---|:---:|
| **GitHub Pages** | Hosting | Server logs | No |
| **Giscus** | Comments | GitHub account (login required) | No |
| **Firebase Realtime DB** | Blog post voting | Hashed IP (anonymous) | May set functional cookies |
| **Firebase Auth** | PolyVote authentication | Anonymous user ID | May set functional cookies |
| **Firebase Firestore** | PolyVote data storage | Topics, votes, requests (anonymous ID) | May set functional cookies |
| **hCaptcha** | Spam protection | See hCaptcha privacy policy | Yes (bot detection) |
| **ipify** | IP detection for voting | IP address (hashed only) | No |
| **unpkg CDN** | Search library (Lunr.js) delivery | IP address, browser info | No |
| **jsDelivr CDN** | Chart library (Chart.js) delivery | IP address, browser info | No |
| **Ko-fi** | External donation link | Only if you click through | See Ko-fi policy |

## Transfers to third countries
Some services (Google Firebase, GitHub, unpkg, hCaptcha) are based in the USA.  
- Google Firebase is certified under the **EU-U.S. Data Privacy Framework**.  
- In addition, the European Commission’s Standard Contractual Clauses (SCCs) apply.  
Further information can be found in the respective privacy policies of the providers.

## Your rights (data subject rights)
You have the following rights at any time:
- **Access** to your stored data  
- **Rectification** of inaccurate data  
- **Erasure** (“right to be forgotten”)  
- **Restriction** of processing  
- **Objection** to processing  
- **Data portability**  
- **Withdrawal** of consent at any time (via “Cookie Settings” in the footer)

Since almost no personal data is permanently stored on my own infrastructure, you can exercise most rights yourself (e.g. delete your own comments). For anything else, simply contact me via the contact page.

## Storage period
- Consent settings: 365 days (localStorage)  
- Hashed voting IDs: only for the duration of the voting cooldown  
- GitHub Issues / Discussions: as long as they are not deleted  
- GitHub server logs: according to GitHub’s own retention policy

## Browser Storage Viewer
This site includes a transparency tool (accessible via the 🍪 icon in the footer) that lets you inspect all cookies, localStorage, sessionStorage, and Cache Storage entries set by this site and its third-party services. Everything happens locally.

## Changes to this privacy policy
This policy may be updated if necessary. The current version is always available on this page. Changes are marked with a new “Last updated” date.

*Last updated: {{ 'now' | date: '%B %Y' }}* 
