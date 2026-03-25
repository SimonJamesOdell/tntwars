import { describe, expect, it } from "vitest";
import { createMatchState, eliminatePlayer, getAlivePlayers } from "../src/match.js";

describe("last-player-standing", () => {
  it("starts with all players alive", () => {
    const state = createMatchState(["a", "b", "c"]);
    expect(getAlivePlayers(state)).toEqual(["a", "b", "c"]);
    expect(state.status).toBe("running");
  });

  it("does not finish until one player remains", () => {
    const state = createMatchState(["a", "b", "c"]);

    eliminatePlayer(state, "a", 10);
    expect(state.status).toBe("running");
    expect(state.winnerId).toBe(null);

    eliminatePlayer(state, "b", 20);
    expect(state.status).toBe("finished");
    expect(state.winnerId).toBe("c");
  });

  it("handles simultaneous total elimination as no winner", () => {
    const state = createMatchState(["a", "b"]);

    eliminatePlayer(state, "a", 5);
    eliminatePlayer(state, "b", 5);

    expect(state.status).toBe("finished");
    expect(state.winnerId).toBe(null);
  });
});
