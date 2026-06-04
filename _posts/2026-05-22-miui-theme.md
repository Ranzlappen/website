---
title: "MIUI Theme"
description: "A custom dark theme for Xiaomi's MIUI Android skin — reskinning the system UI, icons, lock screen, and status bar with a cohesive minimal aesthetic."
keywords: ["miui theme", "xiaomi theme", "miui customisation", "android theme", "miui designer", "dark theme", "xiaomi"]
date: 2026-05-22
category: "Projects"
tags: [android, theme, miui, design]
image: /assets/images/miui-theme/miui-theme-hero.svg
backdrop: /assets/images/miui-theme/miui-theme-hero.svg
status: published
series: "project-showcases"
series_order: 10
comments: true
---

<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="overview">Overview</h2>

MIUI<sup><a href="#source-2">[2]</a></sup> — Xiaomi's Android skin — ships with a built-in theming engine that goes significantly deeper than most Android OEM theme systems. A properly authored `.mtz` theme file can replace the system launcher icons, lock screen, status bar, notification shade, widget styles, sounds, and fonts all in one installable package. The MIUI Theme Store hosts thousands of these, but finding one that is minimal, dark, and free of the rounded-everything aesthetic that dominates commercial offerings is harder than it should be.

This project — [Ranzlappen/Miui_theme](https://github.com/Ranzlappen/Miui_theme) — is a custom `.mtz` theme built for personal use: a dark, low-visual-noise reskin of the MIUI shell. The design goal was a system UI that stays out of the way — consistent dark surfaces, reduced colour noise in the icon set, and a lock screen that shows information without competing with the wallpaper.

<h2 id="features">Features</h2>

- **Dark system surfaces throughout** — The notification shade, quick-settings panel, and app-switcher overlay all use deep-neutral backgrounds so the UI recedes behind content rather than competing with it. AMOLED panels benefit from the near-black palette: true-black pixels draw no current<sup><a href="#source-3">[3]</a></sup>, which is a measurable battery saving at the system-UI level.
- **Custom icon set** — The app icon grid is redesigned with a consistent shape language and reduced use of gradient fills. Icons follow a unified corner-radius and stroke-weight system so the home screen reads as a set rather than a collage of individually branded logos.
- **Minimal lock screen layout** — The lock screen removes decorative chrome and centres the clock with generous spacing. The ambient information layer (date, charge indicator) is typeset rather than iconified.
- **Status bar and notification style** — Status bar icons are redrawn at a consistent optical size. Notification cards in the shade adopt the dark surface, matching the quick-settings strip rather than floating as white rectangles.
- **Packaged as a standard `.mtz` file** — MIUI's `.mtz` format is a ZIP archive with a defined folder structure<sup><a href="#source-4">[4]</a></sup>. The theme installs through the official Themes app (Settings → Themes) without any root access or sideloading tools.

<h2 id="how-it-works">How It Works</h2>

**The `.mtz` format**

A MIUI theme is a renamed ZIP file. Inside, each component of the UI has its own subdirectory containing replacement assets and, where behaviour needs changing, XML configuration files. The top-level structure typically includes:

```
mytheme.mtz (ZIP)
├── icons/          # App icon replacements (PNG, named by package)
├── lockscreen/     # Lock screen layout assets
├── wallpaper/      # Packaged wallpapers
├── sounds/         # Optional ringtone/notification replacements
├── fonts/          # Optional font replacement
└── description.xml # Theme metadata (name, author, target MIUI version)
```

Icons are mapped by Android package name — `com.android.settings.png` replaces the Settings icon, `com.tencent.mm.png` replaces WeChat, and so on. System UI assets use reserved MIUI-specific names documented in community reverse-engineering projects<sup><a href="#source-4">[4]</a></sup>.

**Design workflow**

The assets are authored in a vector design tool and exported as PNG at the pixel densities MIUI expects (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`). The icon grid uses a master template — a fixed canvas with guides for the safe area, corner radius, and drop shadow — so every icon in the set is consistent without manually checking each one against the others.

Once assets are laid out in the folder structure, the directory is zipped and renamed `.mtz`. The theme is transferred to the device via USB or AirDrop equivalent, then opened from the Themes app.

**Limitations of the theming engine**

MIUI's theming API exposes most of the launcher and system UI surface, but third-party app interiors are untouched — the theme only affects what MIUI controls directly. Certain system apps (especially those updated through the app store rather than OTA) can also reset to their default assets after an update, requiring the theme to be reapplied.

<h2 id="getting-started">Getting Started</h2>

1. Clone or download the repository: [github.com/Ranzlappen/Miui_theme](https://github.com/Ranzlappen/Miui_theme).
2. The repository contains the theme source — the asset folders and `description.xml` described above. Zip the contents (not the folder itself) and rename the resulting archive `<name>.mtz`.
3. Transfer the `.mtz` file to your MIUI device. The Files app, USB transfer, or any cloud sync service all work.
4. Open the file from the device file manager. MIUI will prompt to install via the Themes app.
5. After installation, go to **Settings → Themes → Mine** and apply the theme.

**Compatibility note**: The theme was developed against MIUI 12/13. Some asset names changed between major MIUI versions, so older or newer versions may not pick up every replacement. Check the MIUI theming community resources<sup><a href="#source-4">[4]</a></sup> for updated asset maps if applying to a significantly different version.

<h2 id="roadmap">Roadmap</h2>

- [ ] Complete the icon set — extend coverage beyond the most-used apps to the full Xiaomi system app suite and top social/utility apps
- [ ] MIUI 14 / HyperOS compatibility pass — verify and update asset names against the revised HyperOS<sup><a href="#source-5">[5]</a></sup> theming API introduced on newer Xiaomi devices
- [ ] Add a light variant — a white-surface counterpart using the same icon geometry and spacing, for daytime use without the dark-mode contrast inversion
- [ ] Automate `.mtz` packaging — a small shell or Python script that zips the source tree into a correctly structured `.mtz` so the repo can serve as a build system rather than just a file archive

<h2 id="key-takeaways">Key Takeaways</h2>

- MIUI's `.mtz` theming system is more powerful than most Android OEM theme APIs — replacing icons, lock screen, status bar, and notification shade from a single package without root is genuinely useful, and the format is approachable once you understand the ZIP + named-asset convention.
- Consistency in a large icon set comes from a master template enforced at export time, not from eyeballing each icon individually.
- AMOLED dark themes have a real energy argument behind them<sup><a href="#source-3">[3]</a></sup>, not just an aesthetic one — true-black system UI pixels genuinely reduce display power draw on pixel-type panels.
- OEM skinning APIs age fast: MIUI versions change asset names between releases, and the transition to HyperOS added further drift. Any theme that targets a specific version needs a maintenance plan.

<h2 id="conclusion">Conclusion</h2>

The MIUI Theme project is a focused design exercise — taking the MIUI theming engine seriously as a platform and authoring a cohesive system-wide reskin rather than swapping a handful of icons. The result is a personal daily-driver theme that answers a simple question: what does a Xiaomi phone look like when the UI is built around restraint instead of flourish?

The source is available on GitHub for anyone who wants to use it as a starting point for their own MIUI or HyperOS theme: [github.com/Ranzlappen/Miui_theme](https://github.com/Ranzlappen/Miui_theme).

---

**More project showcases:** [Dynamic Buttons](/blog/2026/05/16/dynamic-buttons/) · [Exif Metadata Viewer](/blog/2026/05/18/exif/) · [D2App Watch Face](/blog/2026/05/20/d2app/) · [Pageside Extension](/blog/2026/06/04/pageside/) · [tools.ranzlappen.com](/blog/2026/06/04/tools/)

<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://github.com/Ranzlappen/Miui_theme">github.com/Ranzlappen/Miui_theme — MIUI Theme repository</a></li>
  <li id="source-2"><a href="https://en.wikipedia.org/wiki/MIUI">Wikipedia — MIUI (Xiaomi's Android skin)</a></li>
  <li id="source-3"><a href="https://en.wikipedia.org/wiki/AMOLED">Wikipedia — AMOLED: power consumption properties of OLED pixel technology</a></li>
  <li id="source-4"><a href="https://xdaforums.com/t/guide-how-to-create-miui-themes.2832918/">XDA Forums — Community guide: How to create MIUI themes (.mtz structure and asset naming)</a></li>
  <li id="source-5"><a href="https://en.wikipedia.org/wiki/Xiaomi_HyperOS">Wikipedia — Xiaomi HyperOS (successor to MIUI)</a></li>
</ol>
