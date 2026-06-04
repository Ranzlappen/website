---
title: "Discord Music Bot: A Lightweight Self-Hosted Python Bot for YouTube & Local Music"
description: "A simple yet feature-rich Discord music bot written in Python. Play YouTube videos/playlists or local MP3 files, control playback with an interactive button panel, use text-to-speech, manage queues, and more — all self-hosted and easy to run."
keywords: ["discord music bot", "python discord bot", "youtube music discord", "self hosted discord bot", "discord music player"]
date: 2026-06-04
category: "Projects"
tags: [discord, music-bot, python, self-hosted, youtube, audio]
image: /assets/images/discord-musicbot/discord-musicbot-hero.webp
backdrop: /assets/images/discord-musicbot/discord-musicbot-hero.webp
status: placeholder
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
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="introduction">Introduction</h2>

The Discord Music Bot is a lightweight, self-hosted Python application that brings music playback directly into your Discord server. It supports both YouTube (videos and playlists) and local audio files, with an intuitive interactive control panel, queue management, text-to-speech, and convenient download/upload features.

Built with `discord.py`, `yt-dlp`, and `gTTS`, it offers a clean slash-command experience and runs easily on any machine with Python and FFmpeg installed.

<h2 id="features">Key Features</h2>

- **YouTube & Local Playback** — Stream YouTube videos or playlists, or play from a local `music/` folder.
- **Interactive Control Panel** — A persistent embed with color-coded buttons for play/pause, skip, queue view, autoplay toggle, volume control, and more.
- **Queue Management** — Configurable queue size limit, skip, clear queue, and view current queue.
- **Autoplay** — Per-server autoplay that randomly plays local files when the queue is empty.
- **Text-to-Speech (TTS)** — Speak any text in the voice channel (with language selection). Music automatically pauses during TTS.
- **Recording & Sharing** — Download the currently playing song or any item from the queue/local library directly in Discord.
- **USB/Bluetooth Keyboard Support** — Play notes or control the bot via hardware keyboards (where applicable).
- **Admin Tools** — Channel clearing command for server moderators.

<h2 id="how-it-works">How It Works</h2>

The bot connects to Discord using a bot token and joins voice channels on command. It uses `yt-dlp` to extract audio streams from YouTube and FFmpeg to process and play audio in real time. Local files are played directly from the configured folder.

An interactive control panel is sent as a rich embed with persistent buttons. The bot handles queue logic, autoplay, TTS interruptions, and file uploads/downloads entirely within Discord’s interface.

Everything is configured via a simple `config.json` file (token, embed image, queue limits, TTS language, cooldowns, etc.).

<h2 id="getting-started">Getting Started</h2>

1. Install **FFmpeg** and add it to your system PATH.
2. Install Python dependencies: `pip install -U discord.py yt-dlp gTTS`
3. Create a Discord bot application, generate a token, and add it to `config.json`.
4. Invite the bot to your server with the necessary permissions (Connect, Speak, Embed Links, Use Slash Commands, etc.).
5. Run the bot: `python discordmusicbot.py`

The bot will appear online and be ready to use with slash commands (`/play`, `/controls`, `/tts`, etc.).

Full setup instructions and the latest release (including a convenient `.exe` for Windows) are available in the repository.

<h2 id="key-takeaways">Key Takeaways</h2>

- A lightweight, self-hosted Discord music bot written in Python that supports both YouTube and local files.
- Features an intuitive interactive button control panel instead of relying only on text commands.
- Includes useful extras like per-server autoplay, text-to-speech with music pause, and easy song downloading/uploading.
- Easy to run locally with just Python and FFmpeg — perfect for personal servers or small communities.
- Fully open source (MIT) with active releases and a simple configuration system.

<h2 id="conclusion">Conclusion</h2>

The Discord Music Bot is a practical, no-nonsense solution for adding music to your Discord server without relying on third-party hosting services. Its combination of YouTube + local file support, interactive controls, TTS integration, and easy self-hosting makes it a great choice for personal use or small communities.

If you want a simple, customizable music bot that you fully control, this project is worth checking out.

Repository & Releases: https://github.com/Ranzlappen/discord-musicbot

<h2 id="sources">Sources</h2>

- Discord Music Bot GitHub Repository (README and project files)  
- Project releases and configuration examples (June 2026)
