---
title: "Discord Music Bot: A Lightweight Self-Hosted Python Bot for YouTube & Local Music"
description: "A simple yet feature-rich Discord music bot written in Python. Play YouTube videos/playlists or local MP3 files, control playback with an interactive button panel, use text-to-speech, manage queues, and more — all self-hosted and easy to run."
keywords: ["discord music bot", "python discord bot", "youtube music discord", "self hosted discord bot", "discord music player"]
date: 2026-06-04
category: "Projects"
tags: [discord, music-bot, python, self-hosted, youtube, audio]
image: /assets/images/discord-musicbot/discord-musicbot-hero.webp
backdrop: /assets/images/discord-musicbot/discord-musicbot-hero.webp
status: published
series: "project-showcases"
series_order: 5
comments: true
---

<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#introduction">Introduction</a></li>
    <li><a href="#features">Key Features</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#architecture">Architecture & Tech Stack</a></li>
    <li><a href="#commands">Command Reference</a></li>
    <li><a href="#configuration">Configuration</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#troubleshooting">Troubleshooting & Pitfalls</a></li>
    <li><a href="#security">Security Notes</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="introduction">Introduction</h2>

The Discord Music Bot is a lightweight, self-hosted Python application that brings music playback directly into your Discord server. It supports both YouTube (videos and playlists) and local audio files, with an intuitive interactive control panel, queue management, text-to-speech, and convenient download/upload features.

Built with `discord.py`<sup><a href="#source-3">[3]</a></sup>, `yt-dlp`<sup><a href="#source-4">[4]</a></sup>, and `gTTS`<sup><a href="#source-5">[5]</a></sup>, it offers a clean slash-command experience and runs on any machine with Python 3 and FFmpeg<sup><a href="#source-6">[6]</a></sup> installed. A pre-built Windows `.exe` is available in the releases for those who prefer not to manage a Python environment.

Repository: [github.com/Ranzlappen/discord-musicbot](https://github.com/Ranzlappen/discord-musicbot)

<h2 id="features">Key Features</h2>

- **YouTube & Local Playback** — Stream YouTube videos or playlists via URL, or play from a local `music/` folder.
- **Interactive Control Panel** — A persistent embed with colour-coded buttons: play/pause (green), skip (blue), queue view (blue), autoplay toggle (blue/grey), volume ±5%, and more.
- **Queue Management** — Configurable max queue size (default 100), per-track skip, full queue clear, and paginated queue browser.
- **Autoplay** — Per-server autoplay that randomly picks local files when the queue runs empty.
- **Text-to-Speech (TTS)** — Speak any text in the voice channel with 30+ language options. Music fades out, TTS plays, then music resumes at the same position.
- **Song Download & Upload** — Download the currently playing song or any track from the queue/local library directly into Discord.
- **Admin Tools** — `/__clear_channel__` purges all messages in the current channel (requires `Manage Messages` permission).

<h2 id="how-it-works">How It Works</h2>

The bot authenticates with Discord using a bot token via `discord.py`’s slash-command framework<sup><a href="#source-3">[3]</a></sup>. When a user runs `/play <youtube-url>`, the bot calls `yt-dlp`<sup><a href="#source-4">[4]</a></sup> with `format: bestaudio/best` to extract a direct audio stream URL, then passes that URL to `FFmpeg`<sup><a href="#source-6">[6]</a></sup> for real-time audio processing and playback into the Discord voice channel.

For **playlists**, `yt-dlp` first runs a flat extraction (`extract_flat: True`) to enumerate playlist entries, then streams them one by one from the queue.

For **local files**, the `music/` directory is enumerated at startup. `/local` lists available files; `/autoplay` toggles random local playback when the YouTube queue is empty.

**TTS** works via `gTTS`<sup><a href="#source-5">[5]</a></sup> (Google Text-to-Speech, v2.5.4 as of late 2024): the bot generates an `mp3` file from the text, fades out the current track, plays the speech file through FFmpeg, then restores music.

The **control panel embed** is sent by `/controls` as a persistent Discord message with interactive buttons. The view has `timeout=None` (no expiry) — buttons work indefinitely until the bot restarts. Paginated file selectors use a `timeout=120` seconds.

<h2 id="architecture">Architecture & Tech Stack</h2>

| Component | Library / Tool | Role |
|---|---|---|
| Discord API | discord.py v2<sup><a href="#source-3">[3]</a></sup> | Slash commands, voice, embeds, buttons |
| Audio extraction | yt-dlp<sup><a href="#source-4">[4]</a></sup> | YouTube stream URL extraction |
| Audio processing | FFmpeg<sup><a href="#source-6">[6]</a></sup> | Decode, transcode, stream to Discord |
| Text-to-speech | gTTS 2.5.4<sup><a href="#source-5">[5]</a></sup> | Convert text to mp3 via Google TTS API |
| Configuration | `config.json` | Token, queue size, TTS defaults |
| Local library | `music/` folder | MP3 files for local playback & autoplay |

**FFmpeg options used at runtime:**

```
# YouTube streaming
before_options: ‘-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -nostdin’
options: ‘-vn’

# Local file playback
before_options: ‘-nostdin’
options: ‘-vn’
```

The `-reconnect` flags handle transient network hiccups during long streams without the bot falling silent. `-vn` strips video so only the audio stream is processed.

**File structure expected on disk:**

```
your-folder/
├── discordmusicbot.py   # Bot entry point
├── config.json          # Configuration (see below)
└── music/               # Local MP3 library
    ├── song1.mp3
    └── ...
```

<h2 id="commands">Command Reference</h2>

| Command | Description | Notes |
|---|---|---|
| `/play <url>` | Stream a YouTube video or playlist | Supports full playlist URLs |
| `/local` | List all local MP3 files | Paginated selector |
| `/skip` | Skip the current track | Also available via control panel |
| `/pause` | Pause playback | |
| `/resume` | Resume paused playback | |
| `/join` | Bot joins your voice channel | Optional: clears queue on join |
| `/clearqueue` | Clear the entire song queue | |
| `/autoplay` | Toggle per-server autoplay from local library | Does not affect other servers |
| `/download` | Download current song or choose from queue/library | Respects upload cooldown |
| `/tts <text>` | Text-to-speech in the voice channel | Max 500 chars; 30+ language options |
| `/controls` | Show the interactive control panel embed | Buttons are persistent |
| `/__clear_channel__` | Delete all messages in the channel | Requires `Manage Messages` |

<h2 id="configuration">Configuration</h2>

All settings live in `config.json` in the same directory as `discordmusicbot.py`. The full default structure<sup><a href="#source-1">[1]</a></sup>:

```json
{
  "BOT_TOKEN": "YOUR BOT TOKEN",
  "EMBED_TITLE": "Music Controls",
  "EMBED_DESCRIPTION": "Use the buttons below to control music.",
  "EMBED_IMAGE_URL": "https://fonts.gstatic.com/s/e/notoemoji/latest/1f916/512.webp",
  "COOLDOWN_PER_UPLOAD_IN_SECONDS": 10,
  "MAX_SONG_QUEUE": 100,
  "MESSAGE_CLUTTER_REMOVAL_DELAY": 5,
  "DEFAULT_TTS_LANGUAGE": "en"
}
```

| Field | Default | Description |
|---|---|---|
| `BOT_TOKEN` | — | Your Discord bot token from the Developer Portal |
| `EMBED_TITLE` | `"Music Controls"` | Heading of the control panel embed |
| `EMBED_DESCRIPTION` | `"Use the buttons…"` | Subtext in the control panel embed |
| `EMBED_IMAGE_URL` | robot emoji WebP | Thumbnail shown in the control embed |
| `COOLDOWN_PER_UPLOAD_IN_SECONDS` | `10` | Rate-limit on song downloads per user |
| `MAX_SONG_QUEUE` | `100` | Maximum tracks allowed in the queue |
| `MESSAGE_CLUTTER_REMOVAL_DELAY` | `5` | Seconds before ephemeral status messages are auto-deleted |
| `DEFAULT_TTS_LANGUAGE` | `"en"` | Default language for `/tts` (BCP 47 code) |

<h2 id="getting-started">Getting Started</h2>

1. **Install FFmpeg** and add it to your system PATH (required for audio processing).
2. **Install Python dependencies:**

   ```bash
   pip install -U discord.py yt-dlp gTTS
   ```

3. **Create a Discord Application** at the [Discord Developer Portal](https://discord.com/developers/applications), generate a bot token, and enable the *Message Content* and *Server Members* intents.
4. **Edit `config.json`** — paste your token into `BOT_TOKEN`. Adjust `MAX_SONG_QUEUE`, `DEFAULT_TTS_LANGUAGE`, etc. as needed.
5. **Invite the bot** to your server with these permissions: Connect, Speak, Send Messages, Embed Links, Attach Files, Use Slash Commands, Manage Messages (for `/__clear_channel__`).
6. **Run the bot:**

   ```bash
   python discordmusicbot.py
   ```

The bot goes online and registers slash commands. Use `/controls` in any text channel to post the persistent control panel embed.

**Windows shortcut:** A pre-built `.exe` is available in the [releases](https://github.com/Ranzlappen/discord-musicbot/releases) — download, place `config.json` and your `music/` folder alongside it, and double-click to run without needing Python installed.

<h2 id="troubleshooting">Troubleshooting & Pitfalls</h2>

**Bot joins the voice channel but no audio plays**  
FFmpeg must be on your system PATH. Run `ffmpeg -version` in a terminal to verify. If the command is not found, install FFmpeg and add its `bin/` directory to `PATH`.

**YouTube playback stops mid-stream with no error**  
The `-reconnect` FFmpeg flags handle most network blips, but very long streams or throttled connections can still drop. Use `/skip` and re-queue the track if this happens.

**Heavy YouTube usage warning**  
The README explicitly notes that heavy YouTube usage may trigger rate limiting or temporary account flags on the IP running the bot. Self-hosting on a residential connection is usually fine for personal/small-server use.

**Buttons no longer respond after a bot restart**  
The control panel embed is re-registered at runtime. After restarting the bot, run `/controls` again to post a fresh embed with live button listeners.

**TTS message is cut off**  
`/tts` has a hard 500-character limit. Split long texts into multiple commands.

**Autoplay does not trigger**  
Autoplay requires at least one MP3 file in the `music/` folder and must be toggled on per-server via `/autoplay`.

<h2 id="security">Security Notes</h2>

- **Never commit `config.json` to a public repository.** The `BOT_TOKEN` field is a secret credential. The README includes this warning explicitly<sup><a href="#source-1">[1]</a></sup>. Add `config.json` to your `.gitignore` before making any fork public.
- The bot uses `/__clear_channel__` (double underscore) as a deliberate naming convention to make it harder to trigger accidentally; it also requires the `Manage Messages` Discord permission.
- The bot operates with minimal permissions — only what is listed in the invite URL. Do not grant `Administrator` unless you have a specific reason.
- The download feature streams file uploads into Discord and is rate-limited by `COOLDOWN_PER_UPLOAD_IN_SECONDS` to prevent abuse.

<h2 id="key-takeaways">Key Takeaways</h2>

- A lightweight, self-hosted Discord music bot written in Python that supports both YouTube and local MP3 files.
- Features an interactive button control panel with persistent embeds — no need to remember command names for day-to-day use.
- Includes per-server autoplay, TTS with music-pause, paginated queue browser, and easy song downloading.
- Simple one-file setup with `config.json` — easy to run locally, on a server, or via the Windows `.exe` release.
- Fully open-source (MIT) with a straightforward architecture built on `discord.py`<sup><a href="#source-3">[3]</a></sup>, `yt-dlp`<sup><a href="#source-4">[4]</a></sup>, `gTTS`<sup><a href="#source-5">[5]</a></sup>, and FFmpeg<sup><a href="#source-6">[6]</a></sup>.

<h2 id="conclusion">Conclusion</h2>

The Discord Music Bot is a practical, no-nonsense solution for adding music to your Discord server without relying on third-party hosted bots. Its combination of YouTube and local file support, interactive controls, TTS integration, and easy self-hosting makes it a great choice for personal use or small communities. Full ownership of the bot means no surprise shutdowns, no premium tiers, and complete control over what it can do.

---

**More project showcases:** [Ticked](/blog/2026/03/31/ticked-html-app/) · [MoodRadar](/blog/2026/04/03/twitch-mood-radar/) · [Flipper Zero Framework](/blog/2026/06/04/flipper/) · [Synth Piano](/blog/2026/06/04/synth-piano-web/) · [repo-standards](/blog/2026/06/04/repo-standards/) · [tools.ranzlappen.com](/blog/2026/06/04/tools/)

<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://github.com/Ranzlappen/discord-musicbot" target="_blank" rel="noopener">Ranzlappen/discord-musicbot — GitHub repository (README, config.json, source code).</a></li>
  <li id="source-2"><a href="https://github.com/Ranzlappen/discord-musicbot/releases" target="_blank" rel="noopener">discord-musicbot releases — pre-release v1 (includes Windows .exe).</a></li>
  <li id="source-3"><a href="https://discordpy.readthedocs.io/en/stable/" target="_blank" rel="noopener">discord.py v2.7.1 documentation — Python Discord API wrapper.</a></li>
  <li id="source-4"><a href="https://github.com/yt-dlp/yt-dlp" target="_blank" rel="noopener">yt-dlp — feature-rich YouTube/audio downloader (fork of youtube-dl).</a></li>
  <li id="source-5"><a href="https://pypi.org/project/gTTS/" target="_blank" rel="noopener">gTTS 2.5.4 — Google Text-to-Speech Python library (PyPI).</a></li>
  <li id="source-6"><a href="https://ffmpeg.org/documentation.html" target="_blank" rel="noopener">FFmpeg documentation — audio/video processing used for Discord voice streaming.</a></li>
  <li id="source-7"><a href="https://discord.com/developers/docs/topics/permissions" target="_blank" rel="noopener">Discord Developer Documentation — Bot permissions reference.</a></li>
</ol>
