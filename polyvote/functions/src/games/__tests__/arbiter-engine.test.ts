import { describe, it, expect } from "vitest";
import {
  applyAction,
  createMatch,
  getGame,
  redactFor,
  type MatchState,
} from "../engine";
// Register the games server-side (side-effect imports), as the arbiter does.
import "../defs/crown-rush";
import "../defs/lantern-hunt";
import "../defs/relic-run";
import type { CrownState } from "../defs/crown-rush";

const players = [
  { id: "p0", name: "Ann" },
  { id: "p1", name: "Bo" },
];

describe("server engine copy", () => {
  it("registers all three games", () => {
    expect(getGame("crown-rush")).toBeTruthy();
    expect(getGame("lantern-hunt")).toBeTruthy();
    expect(getGame("relic-run")).toBeTruthy();
  });

  it("createMatch is deterministic for a seed (matches the client copy)", () => {
    const def = getGame("crown-rush")!;
    const a = createMatch(def, { matchId: "m", seed: "s", players });
    const b = createMatch(def, { matchId: "m", seed: "s", players });
    expect(a.game).toEqual(b.game);
  });

  it("rejects an out-of-turn action (the arbiter sets actor = uid)", () => {
    const def = getGame("crown-rush")!;
    const m = createMatch(def, { seed: "s", players });
    // Simulate the server forcing playerId to a non-current player.
    const r = applyAction(def, m, {
      type: "DRAW",
      payload: { from: "stock" },
      playerId: "p1",
    });
    expect(r.ok).toBe(false);
  });

  it("redactFor hides opponents' hands for online slots", () => {
    const def = getGame("crown-rush")!;
    const m: MatchState<CrownState> = createMatch(def, { seed: "s", players });
    const view = redactFor(def, m, "p0") as MatchState<CrownState>;
    expect(view.game.hands.p0).toEqual(m.game.hands.p0);
    expect(view.game.hands.p1.every((c) => c.rank === undefined)).toBe(true);
  });
});
