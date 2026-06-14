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
       "games-rooms":   { ".read": true, ".write": true },
       "games-states":  { ".read": true, ".write": true },
       "games-actions": { ".read": true, ".write": true }
     }
   }
   ```

   These dev rules are permissive. For a hardened deployment, restrict the
   `games-states/<room>/_shared` (full authoritative state) slot so only the
   host may read it, and validate writes per node — see *Known limitations*.

   Then pick **Firebase** as the backend on the Online page.

The adapter dynamically imports `firebase/database` (so it stays out of the main
bundle until used) and wires `onDisconnect` so a closed tab automatically marks
the player disconnected, enabling reconnect/resume.

## Synchronization model (host-authoritative)

Non-host clients **never write game state**. The flow:

1. The current player's UI is the only one enabled (`GameSurface` disables
   everyone else). They `submitAction(roomId, playerId, action)` — written to
   the `games-actions` queue.
2. The **host** consumes the queue, validates + applies each action with the
   pure `applyAction`, and publishes the resulting state.
3. For games that declare a `redact` hook, the host writes a **per-player
   redacted** view to `games-states/<room>/<playerId>` (so a peer's slot can't
   contain another player's hand) plus the full authoritative state to a
   `_shared` slot it reads for reconnect/recovery. Games with no hidden
   information just use `_shared`.
4. `pushState` and the action queue use transactions / version guards, so
   simultaneous joins, ready toggles, presence updates and state writes can't
   clobber each other, and stale snapshots are rejected.

Because only the host mutates state, a malicious client can't push an arbitrary
board; the worst it can do is submit an action, which the host validates and
drops if illegal.

## Known limitations

- **Full trust still rests on the host.** A custom client could submit
  out-of-turn actions; the host rejects them via `validate`, but there is no
  *server* arbiter. For untrusted, competitive play, move the validation into a
  Cloud Function (reusing the repo's callable pattern) — see the Roadmap.
- **Hidden information is enforced for honest clients, not yet cryptographically.**
  Per-player slots are redacted, but the `_shared` full state is readable under
  the permissive dev rules. Lock `_shared` to the host in production rules (above)
  to close that gap; the UI never reads it on non-host clients.
- **Host reconnect:** if the host reloads mid-game it reseeds authority from the
  `_shared` slot; if that slot was locked down or cleared, the host can restart
  the round with **Play again**.
- The default-region `databaseURL` is a placeholder until set for your project;
  the app falls back to local mode automatically when Firebase isn't configured.

> No secrets are committed. The Firebase web config is public, client-safe
> config (the same keys used elsewhere on the site); security is enforced by
> rules.
