/**
 * Server-authoritative game arbiter.
 *
 * The authoritative match state lives in the Realtime Database at
 * `games-states/<room>/_full` and is written only by these functions (RTDB
 * rules deny all client writes to `games-states`). Clients call
 * `gamesSubmitAction`; the server sets the actor from the authenticated uid (so
 * it can't be spoofed), validates + applies the move with the same deterministic
 * engine as the client, then publishes a per-player redacted view to
 * `games-states/<room>/<uid>` — which is the only slot each client may read.
 *
 * This is the trust layer above the client host-relay: even the host cannot
 * cheat, and a peer cannot read another player's hidden information.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabase } from "firebase-admin/database";
import {
  applyAction,
  createMatch,
  getGame,
  redactFor,
  type GameAction,
  type MatchState,
} from "./engine";
// Register the bundled games server-side (side-effect imports).
import "./defs/crown-rush";
import "./defs/lantern-hunt";
import "./defs/relic-run";

interface RoomPlayer {
  id: string;
  name: string;
  seat: number;
  isHost?: boolean;
}
interface RoomMeta {
  roomId: string;
  gameId: string;
  hostId: string;
  status: string;
  players: RoomPlayer[];
}

const ROOM_CODE_RE = /^[A-Z0-9]{3,8}$/;

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to play online.");
  return uid;
}

function requireRoomId(roomId: unknown): string {
  if (typeof roomId !== "string" || !ROOM_CODE_RE.test(roomId)) {
    throw new HttpsError("invalid-argument", "Invalid room id.");
  }
  return roomId;
}

async function loadRoom(roomId: string): Promise<RoomMeta> {
  const snap = await getDatabase().ref(`games-rooms/${roomId}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Room not found.");
  return snap.val() as RoomMeta;
}

/** Write the per-player redacted state slots (the only slots clients read). */
async function writePlayerSlots(roomId: string, state: MatchState): Promise<void> {
  const def = getGame(state.gameId);
  if (!def) return;
  const updates: Record<string, unknown> = {};
  for (const p of state.players) {
    updates[`games-states/${roomId}/${p.id}`] = def.redact
      ? redactFor(def, state, p.id)
      : state;
  }
  await getDatabase().ref().update(updates);
}

/** Host-only: seed (or restart) the authoritative match for a room. */
export const gamesCreateMatch = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const roomId = requireRoomId((request.data as { roomId?: unknown })?.roomId);
  const room = await loadRoom(roomId);
  if (room.hostId !== uid) {
    throw new HttpsError("permission-denied", "Only the host can start the game.");
  }
  const def = getGame(room.gameId);
  if (!def) {
    throw new HttpsError("failed-precondition", `Unknown game "${room.gameId}".`);
  }
  const players = [...(room.players ?? [])]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ id: p.id, name: p.name }));

  let state: MatchState;
  try {
    state = createMatch(def, {
      matchId: roomId,
      seed: `${roomId}-${Date.now()}`,
      players,
    });
  } catch (e) {
    throw new HttpsError(
      "failed-precondition",
      e instanceof Error ? e.message : "Cannot start the game.",
    );
  }

  await getDatabase().ref(`games-states/${roomId}/_full`).set(state);
  await writePlayerSlots(roomId, state);
  await getDatabase().ref(`games-rooms/${roomId}/status`).set("playing");
  return { ok: true as const };
});

/** Submit a move; the server validates + applies it as the authenticated uid. */
export const gamesSubmitAction = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = request.data as { roomId?: unknown; action?: GameAction };
  const roomId = requireRoomId(data?.roomId);
  const action = data?.action;
  if (!action || typeof action.type !== "string") {
    throw new HttpsError("invalid-argument", "An action with a type is required.");
  }

  const fullRef = getDatabase().ref(`games-states/${roomId}/_full`);
  const base = (await fullRef.get()).val() as MatchState | null;
  if (!base) {
    throw new HttpsError("failed-precondition", "The match has not started.");
  }
  const def = getGame(base.gameId);
  if (!def) throw new HttpsError("failed-precondition", "Unknown game.");

  // The actor is the authenticated caller — clients cannot spoof playerId.
  const result = applyAction(def, base, {
    type: action.type,
    payload: action.payload,
    playerId: uid,
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  // Compare-and-set on version so concurrent submits can't clobber state.
  const tx = await fullRef.transaction((cur: MatchState | null) =>
    !cur || cur.version !== base.version ? undefined : result.state,
  );
  if (!tx.committed) {
    return { ok: false as const, error: "State changed — please retry." };
  }

  await writePlayerSlots(roomId, result.state);
  if (result.state.status === "finished") {
    await getDatabase().ref(`games-rooms/${roomId}/status`).set("finished");
  }
  return { ok: true as const };
});
