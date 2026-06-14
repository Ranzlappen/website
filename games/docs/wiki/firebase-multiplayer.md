# Firebase Multiplayer & Offline Mode

Online play is built against a backend-agnostic **`SyncAdapter`** interface
(`src/net/adapter.ts`). Game logic never touches a backend — it talks to the
adapter, and the app chooses one at runtime.

## The two adapters

| Adapter | Backend | When used | Setup |
|---|---|---|---|
| `LocalSyncAdapter` | `localStorage` + `BroadcastChannel` | **Default.** Always available. | None. |
| `FirebaseSyncAdapter` | Firebase RTDB + Cloud Functions (server arbiter) | When enabled **and** configured | One-time setup (below). |

The two backends use **different trust models** behind the same interface,
selected by `adapter.serverAuthoritative`:

- **Local** — *client* host-authoritative: a client host relays the action queue,
  applies moves, and publishes per-viewer redacted state. Great for cross-tab dev
  and friendly play.
- **Firebase** — *server* authoritative: a Cloud Function validates and applies
  every move (the actor is the **authenticated uid**, so it can't be spoofed) and
  writes each player's redacted slot. Even the host can't cheat, and a peer can't
  read another player's hidden state.

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

## Enabling Firebase (open-internet, server-authoritative)

Most of the wiring ships in the repo and deploys automatically. One-time setup:

1. **Database URL.** Set `databaseURL` in `src/net/firebaseClient.ts` to your
   project's RTDB URL (the default-region value is pre-filled; change it if your
   RTDB lives elsewhere).
2. **Enable Anonymous Auth** in the Firebase console (Authentication →
   Sign-in method). Online play signs each client in anonymously; the uid is the
   player identity that both the RTDB rules and the arbiter key off.
3. **Deploy** — already automated. The arbiter callables
   (`gamesCreateMatch`, `gamesSubmitAction`, in `polyvote/functions/src/games/`)
   and the RTDB rules (`polyvote/database.rules.json`) deploy via
   `firebase-deploy.yml`. The committed rules are:

   ```json
   "games-rooms":  { "$room": { ".read": "auth != null", ".write": "auth != null" } },
   "games-states": { "$room": { "$slot": { ".read": "$slot === auth.uid", ".write": false } } }
   ```

   i.e. only authenticated clients touch the lobby, **no client may write game
   state** (only the server, via the admin SDK), and a client may read **only its
   own slot** (`games-states/<room>/<uid>`). The authoritative `_full` slot is
   server-only and unreadable by any client.
4. Pick **Firebase** as the backend on the Online page.

The adapter lazy-loads `firebase/database`, `firebase/auth` and
`firebase/functions` (kept out of the main bundle until used) and wires
`onDisconnect` on `presence/<uid>` so a closed tab marks the right player
offline even after the roster reindexes — enabling reconnect/resume.

## Synchronization model (server-authoritative)

1. The current player's UI is the only one enabled (`GameSurface` disables
   everyone else). They `submitAction(roomId, action)`, which calls the
   `gamesSubmitAction` Cloud Function.
2. The function reads the authoritative `_full` state, sets the **actor from the
   authenticated uid** (clients can't spoof it), runs the same deterministic
   `applyAction`, and — on a legal move — commits the new state with a
   **version compare-and-set** so concurrent submits can't clobber.
3. It then writes each player's **redacted** view to `games-states/<room>/<uid>`
   (via `redactFor`), the only slot that client can read. Illegal moves are
   rejected and surfaced in the UI; state is never written.
4. `gamesCreateMatch` (host-gated by `room.hostId === uid`) seeds/restarts the
   match server-side.

The local backend keeps the lighter *client* host-relay (action queue +
per-viewer push) for zero-config cross-tab play; the model differences are
isolated behind `adapter.serverAuthoritative`.

## Known limitations / notes

- **Lobby integrity is light.** Room metadata (join/ready/presence) is still
  client-written under `auth != null`; a crafted client could tamper with lobby
  fields. The security-critical paths — match creation and every move — are
  fully server-validated, and `gamesCreateMatch` re-checks the host. Tighten the
  lobby with `.validate` rules if you need it.
- **Host reconnect** (local backend) reseeds from the shared slot; on the
  Firebase backend the server owns state, so any client (including a reloaded
  host) simply resubscribes.
- The default-region `databaseURL` is a placeholder until set; the app falls back
  to local mode automatically when Firebase isn't configured.

> No secrets are committed. The Firebase web config is public, client-safe
> config; security is enforced by RTDB rules + the server arbiter.
