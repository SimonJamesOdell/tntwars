import { describe, expect, it } from "vitest";
import { allocateSpawnSlots } from "../src/spawn.js";
import { createArenaBlocks } from "../src/blocks.js";
import { hasBlockAt, placeBlock } from "../src/placement.js";
import { createSimulationState, stepSimulation } from "../src/simulation.js";

describe("block placement", () => {
  it("places a new adjacent block on the grid", () => {
    const spawnSlots = allocateSpawnSlots(["a", "b"], {
      pileSize: 3,
      spacing: 16,
      baseY: 0,
      maxJumpDistance: 6,
    });
    const blocks = createArenaBlocks(spawnSlots);

    const result = placeBlock(blocks, "a", 2, 0, 0);

    expect(result.placed).toBe(true);
    expect(hasBlockAt(result.blocks, 2, 0, 0)).toBe(true);
  });

  it("rejects non-adjacent placement", () => {
    const spawnSlots = allocateSpawnSlots(["a", "b"], {
      pileSize: 3,
      spacing: 16,
      baseY: 0,
      maxJumpDistance: 6,
    });
    const blocks = createArenaBlocks(spawnSlots);

    const result = placeBlock(blocks, "a", 5, 0, 0);

    expect(result.placed).toBe(false);
  });

  it("makes support dynamic when a player loses all blocks beneath them", () => {
    const spawnSlots = allocateSpawnSlots(["a", "b"], {
      pileSize: 3,
      spacing: 16,
      baseY: 0,
      maxJumpDistance: 6,
    });
    const state = createSimulationState(["a", "b"], spawnSlots, {
      fixedDeltaSeconds: 0.25,
      gravity: 20,
      chasmY: -4,
    });

    state.blocks = state.blocks.filter((block) => !(block.ownerId === "a" && block.x === 0 && block.z === 0));

    stepSimulation(state, {});
    stepSimulation(state, {});
    stepSimulation(state, {});

    const player = state.players.find((entry) => entry.playerId === "a");
    expect(player.alive).toBe(false);
  });
});