# Firebase Multiplayer & Offline Mode

Online play is built against a backend-agnostic **`SyncAdapter`** interface
(`src/net/adapter.ts`). Game logic never touches a backend — it talks to the
adapter, and the app chooses one at runtime.

## The two adapters

| Adapter | Backend | When used | Setup |
|---|---|---|---|
| `LocalSyncAdapter` | `localStorage` + `BroadcastChannel` | **Default.** Always available. | None. |
| `FirebaseSyncAdapter` | Firebase Realtime Database | When enabled **and** configured | One-time rules + URL (below). |

`getSyncAdapter()` returns Firebase when the net mode is `firebase` *and*
`firebaseAvailable()`, otherwise the local adapter. The choice is memoized and
the net mode is persisted in `localStorage` (toggle on the **Online** page).

## Offline / local mode (zero config)

The local adapter implements the **entire** contract — rooms, join-by-code,
presence, ready states, authoritative state push — using `localStorage` keys
plus a `BroadcastChannel` (with a `storage`-event fallback). This synchronizes
**across tabs and windows of the same browser**, so you can develop and demo
full multiplayer with no backend at all:

> Create a room, copy the link, open it in a second tab → you're playing
> "online" locally.

It also means the offline experience never loads the Firebase SDK.

## Enabling Firebase (open-internet multiplayer)

Real-time sync uses the Realtime Database. Two one-time steps:

1. **Configure the database URL.** Set `databaseURL` in
   `src/net/firebaseClient.ts` to your project's RTDB URL (the default-region
   value is pre-filled; change it if your RTDB lives elsewhere).
2. **Add RTDB rules** permitting reads/writes under `/games-rooms` and
   `/games-states`. A minimal (development) ruleset:

   ```json
   {
     "rules": {
       "games-rooms":  { ".read": true, ".write": true },
       "games-states": { ".read": true, ".write": true }
     }
   }
   ```

   Then pick **Firebase** as the backend on the Online page.

The adapter dynamically imports `firebase/database` (so it stays out of the main
bundle until used) and wires `onDisconnect` so a closed tab automatically marks
the player disconnected, enabling reconnect/resume.

## Synchronization model

Turn-based, last-writer-by-version: only the **current** player's controls are
enabled (`GameSurface` disables everyone else), so a move is applied locally via
`applyAction`, then `pushState(roomId, newState)` publishes the authoritative
snapshot. Peers receive it through their subscription and re-render.
`pushState` rejects snapshots with an older `version`, guarding against
out-of-order delivery.

## Known limitations

- **Hidden information** (e.g. a card hand) is present in the synced full state,
  so a determined peer could read it. Securing it requires a server that filters
  per-player views (a Cloud Function or trusted host) — see the Roadmap.
- The default-region `databaseURL` is a placeholder until set for your project;
  the app falls back to local mode automatically when Firebase isn't configured.

> No secrets are committed. The Firebase web config is public, client-safe
> config (the same keys used elsewhere on the site); security is enforced by
> rules.
