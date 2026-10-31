# WvW Hub (`wvw/`)

A cross-guild, cross-team **raid calendar for Guild Wars 2 World vs. World**, plus matchups, a guild directory with activity/raid stats,
attendee-only ratings and a Discord hub bot. Live at **https://ranzlappen.com/wvw/** (React 19 + Vite SPA on GitHub Pages, backend in the
shared Firebase project `proven-concept-436717-q3`).

```
wvw/                       React SPA (this module)          → GitHub Pages /wvw/
├── src/shared/            MIRRORED from polyvote/functions/src/wvw/shared (scripts/check-mirror.mjs)
├── voice-worker/          optional always-on Discord gateway worker (voice headcounts)
polyvote/functions/src/wvw/  all server logic, exported as ONE function group `wvw-*`
polyvote/firestore.rules     `wvw*` rules (public index docs, own member doc, public runs/guild pages)
```

## The four phases (all shipped)

| Phase | What | Where |
|---|---|---|
| **0 — public data** | Matchups, relink/lockout/reset countdowns, guild directory filled from public objective claims (`claimed_by`/`claimed_at`), weekly activity per guild, per-map K/D samples. Works with zero sign-ups. | `poller.ts` (every 5 min), `maintenance.ts` (every 10 min), `indexes.ts` |
| **1 — verified calendar** | Discord login → custom token; API-key verification with a name challenge; guild-leader claims + commander invite codes; raids (one-off/weekly, tz-correct); two visibility tiers; reports + moderation; iCal feeds. | `auth.ts`, `members.ts`, `guilds.ts`, `events.ts`, `reports.ts`, `ical.ts`, `admin.ts` |
| **2 — Discord** | HTTP interactions bot (`/raid schedule\|list\|live\|end\|cancel`, `/wvw me\|verify\|matchup\|relink`, Details/Check-in buttons), announcements synced both ways, automatic role sync (Verified / Commander / Guild Leader / EU / NA / Team), one-click hub provisioning (roles, channel groups, per-region squad voice channels, rules, welcome, AutoMod incl. an API-key blocker). | `discord/*` |
| **3 — metrics** | Runs (go live → check-ins → end), squad size from dps.report logs › voice headcount › check-ins › reported, team K/D on the map during the window, objectives claimed, guild 30-day stats, attendee-only multi-axis ratings (shown at ≥5 raters, each rater counts once). | `runs.ts`, `metrics.ts`, `voice.ts`, `voice-worker/` |

## Privacy & visibility model

- **No account names in public.** Public surfaces identify raids by guild tag/name only. GW2 account names live on the member's own doc
  (owner-read) and server-only docs; a guild leader sees the names of the commanders they appointed (already on their in-game roster).
- **Tiers are enforced by which docs exist**, not by UI: the browser reads `wvwPublic/*` index docs (no map/voice/goals), `wvwGuildDir/*`,
  `wvwRuns/*` (no identities, no map) and its own `wvwMembers/{uid}`. Everything else is server-only. Team-only details come from the
  `getEventDetails` callable, which checks *verified + same team*.
- **Voice links**: a Discord link to a hub channel is turned into a personal **single-use, 1-hour invite** per viewer.
- **API keys**: must be *named* with the member's challenge code (proves the key was made for us), stored AES-256-GCM-encrypted, used only
  to re-check the team after relinks; "Forget my key" / "Delete my data" on the Account page.
- **Ratings**: only checked-in, same-team attendees, 72 h window, four axes, no free text, per-rater averaging.
- **WvW Hub roles are NOT Firebase custom claims** (the existing `setUserRole` replaces the whole claims object, and WvW mods must never get
  blog `admin`). Roles live in `wvwMembers.role`; admins are bootstrapped from `WVW_SECRETS.adminDiscordIds`.
- WvW users have uids `wvw-discord-<id>`; `auth/onCreate.ts` skips them so they never appear in PolyVote's `users`.
- The client uses a **named Firebase app** (`wvw-hub`) so its auth session doesn't collide with Blog Admin / PolyVote / Tabletop on the same
  origin.

## Relinks

ArenaNet rebuilds teams at every relink (`/v2/wvw/timers/teamAssignment`). The maintenance job notices the timer advancing, waits 30 min,
then re-verifies every member of that region with their stored key (40 per run): new team → events retargeted, Discord team role swapped.
Members whose key is gone become `stale` (events "on hold", roles removed) until they re-verify. Team ids are stable-ish but names aren't
in the API — they're in `shared/teams.ts` (from the Elite Insights shard list) and overridable at runtime in Moderation → Settings.

## One-time setup (admin)

1. **Secret** — the deploy fails until it exists (CLAUDE.md "Required secrets"). From `polyvote/`:
   ```bash
   firebase functions:secrets:set WVW_SECRETS   # paste JSON; '{}' is enough to unblock deploys
   ```
   Full value:
   ```json
   {
     "discordApplicationId": "…", "discordClientId": "…", "discordClientSecret": "…",
     "discordBotToken": "…", "discordPublicKey": "<hex from the developer portal>",
     "keyEncryptionKey": "<openssl rand -base64 32>",
     "voiceWorkerSecret": "<openssl rand -hex 32>",
     "adminDiscordIds": ["<your Discord user id>"],
     "allowedRedirectUris": ["https://ranzlappen.com/wvw/auth/discord", "http://localhost:5173/wvw/auth/discord"]
   }
   ```
2. **Custom tokens** — give the Functions runtime service account
   (`420991269376-compute@developer.gserviceaccount.com`) the **Service Account Token Creator** role on itself and enable the *IAM Service
   Account Credentials API*, otherwise `createCustomToken` fails ("Discord login failed").
3. **Discord application** (discord.com/developers): OAuth2 redirect `https://ranzlappen.com/wvw/auth/discord`; Bot token; Interactions
   Endpoint URL `https://us-central1-proven-concept-436717-q3.cloudfunctions.net/wvw-discordInteractions`. Put the client id in
   `wvw/src/config.ts` (`DISCORD_CLIENT_ID`).
4. Deploy (merge to `main` → `firebase-deploy.yml` deploys rules, indexes and `functions:wvw`; Pages deploys the SPA).
5. Sign in on the site → **Moderation → Settings**: hub server id, hub invite URL → **Discord**: invite the bot (link shown), drag its role
   above the Verified/Team roles, **Provision hub server**, **Register slash commands**. Enable Community + Onboarding manually.
6. *(Optional)* voice headcounts: deploy `voice-worker/` (Dockerfile has the Cloud Run command) with `DISCORD_BOT_TOKEN`,
   `VOICE_ENDPOINT=https://us-central1-proven-concept-436717-q3.cloudfunctions.net/wvw-voiceSamples`, `VOICE_SECRET`.

The first `wvw-poll` run fills matchups and the guild directory within 5 minutes — no other setup needed for Phase 0.

## Develop

```bash
cd wvw
npm install
npm run dev          # http://localhost:5173/wvw/ (reads production Firestore public docs)
npm run lint
npm test             # vitest + voice-worker tests + shared-file mirror check
npm run build        # WVW_BASE=/ npm run build → for a future custom-domain root
```

Server code: `cd polyvote/functions && npm test` (unit tests in `src/wvw/__tests__/`).

**Shared files**: `wvw/src/shared/{teams,constants,time,types}.ts` ⇄ `polyvote/functions/src/wvw/shared/*` must stay identical apart from
the "MIRRORED FILE" header line — `npm test` fails otherwise. Edit one, copy to the other.

**Adding an option** (event type, language, playstyle, report reason): add it to `shared/constants.ts` in both copies — server validation
and every UI picker follow.

## Custom domain later

The build is base-agnostic (`WVW_BASE`, router basename from `import.meta.env.BASE_URL`). GitHub Pages serves one custom domain per
repository, so a separate domain means a second Pages site (e.g. a tiny repo whose workflow builds `wvw/` with `WVW_BASE=/`) — then update
`allowedRedirectUris`, the Discord OAuth redirect, `public/manifest.webmanifest` and Settings → Site URL.
