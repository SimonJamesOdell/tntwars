import { describe, expect, it } from "vitest";
import { allocateSpawnSlots } from "../src/spawn.js";
import { createBlock } from "../src/blocks.js";
import { createSimulationState, stepSimulation } from "../src/simulation.js";

function setupSimulation(config = {}) {
  const playerIds = ["a", "b"];
  const spawnSlots = allocateSpawnSlots(playerIds, {
    pileSize: 3,
    spacing: 16,
    baseY: 0,
    maxJumpDistance: 6,
  });

  return createSimulationState(playerIds, spawnSlots, config);
}

describe("fixed-tick simulation", () => {
  it("moves a grounded player horizontally from input", () => {
    const state = setupSimulation({ fixedDeltaSeconds: 0.25, moveSpeed: 4 });

    stepSimulation(state, { a: { moveX: 1, moveZ: 0 } });

    const player = state.players.find((entry) => entry.playerId === "a");
    expect(player.x).toBe(1);
    expect(player.z).toBe(0);
    expect(player.y).toBe(0);
    expect(player.grounded).toBe(true);
  });

  it("applies jump impulse and gravity", () => {
    const state = setupSimulation({ fixedDeltaSeconds: 0.1, jumpVelocity: 8, gravity: 20 });

    stepSimulation(state, { a: { jump: true } });

    const player = state.players.find((entry) => entry.playerId === "a");
    expect(player.y).toBeCloseTo(0.6);
    expect(player.vy).toBeCloseTo(6);
    expect(player.grounded).toBe(false);
  });

  it("eliminates a player who walks off support into the chasm", () => {
    const state = setupSimulation({
      fixedDeltaSeconds: 0.5,
      moveSpeed: 8,
      gravity: 20,
      chasmY: -4,
    });

    stepSimulation(state, { a: { moveX: 1 } });
    stepSimulation(state, {});

    const player = state.players.find((entry) => entry.playerId === "a");
    expect(player.alive).toBe(false);
    expect(state.match.status).toBe("finished");
    expect(state.match.winnerId).toBe("b");
  });

  it("does not allow a mid-air second jump", () => {
    const state = setupSimulation({ fixedDeltaSeconds: 0.1, jumpVelocity: 8, gravity: 20 });

    stepSimulation(state, { a: { jump: true } });
    const firstJumpVelocity = state.players.find((entry) => entry.playerId === "a").vy;

    stepSimulation(state, { a: { jump: true } });

    const player = state.players.find((entry) => entry.playerId === "a");
    expect(player.vy).toBeLessThan(firstJumpVelocity);
  });

  it("blocks horizontal movement through raised wall blocks", () => {
    const state = setupSimulation({ fixedDeltaSeconds: 0.25, moveSpeed: 4, gravity: 20 });
    const player = state.players.find((entry) => entry.playerId === "a");
    const startX = player.x;
    const startY = player.y;
    const startZ = player.z;

    state.blocks = [
      createBlock("a", startX, startY, startZ),
      createBlock("a", startX + 1, startY + 1, startZ),
    ];

    stepSimulation(state, { a: { moveX: 1, moveZ: 0 } });

    const afterMove = state.players.find((entry) => entry.playerId === "a");
    expect(afterMove.x).toBeLessThan(startX + 0.55);
  });

  it("does not step up to a higher level without a jump", () => {
    const state = setupSimulation({ fixedDeltaSeconds: 0.25, moveSpeed: 4, gravity: 20 });
    const player = state.players.find((entry) => entry.playerId === "a");
    const startX = player.x;
    const startZ = player.z;

    player.y = -0.4;
    player.vy = 0;
    player.grounded = true;

    state.blocks = [
      createBlock("a", startX, -1, startZ),
      createBlock("a", startX + 1, 0, startZ),
    ];

    stepSimulation(state, { a: { moveX: 1, moveZ: 0 } });

    const afterMove = state.players.find((entry) => entry.playerId === "a");
    expect(afterMove.y).toBeLessThan(0);
    expect(afterMove.grounded).toBe(false);
  });

  it("keeps a player grounded while their footprint still overlaps an edge", () => {
    const state = setupSimulation({ fixedDeltaSeconds: 0.1, moveSpeed: 6, gravity: 20 });
    const player = state.players.find((entry) => entry.playerId === "a");
    const startX = player.x;
    const startY = player.y;
    const startZ = player.z;

    state.blocks = [createBlock("a", startX, startY, startZ)];

    // Move 0.6 units in X. The player footprint (half-width 0.4) still overlaps
    // the block footprint (half-width 0.5), so support should remain.
    stepSimulation(state, { a: { moveX: 1, moveZ: 0 } });

    const afterMove = state.players.find((entry) => entry.playerId === "a");
    expect(afterMove.x).toBeCloseTo(startX + 0.6);
    expect(afterMove.y).toBeCloseTo(startY);
    expect(afterMove.grounded).toBe(true);
  });

  it("moves configured AI-owned piles and carries their players", () => {
    const state = setupSimulation({
      aiPileMotionEnabled: true,
      aiPileMotionStepIntervalTicks: 1,
      aiPileMotionMaxOffset: 2,
      aiPileMotionPlayerIds: ["b"],
    });
    const movingPlayerBefore = state.players.find((entry) => entry.playerId === "b");
    const stillPlayerBefore = state.players.find((entry) => entry.playerId === "a");
    const movingBlockBefore = state.blocks.find((block) => block.ownerId === "b");
    const movingPlayerStartX = movingPlayerBefore.x;
    const movingPlayerStartZ = movingPlayerBefore.z;
    const stillPlayerStartX = stillPlayerBefore.x;
    const stillPlayerStartZ = stillPlayerBefore.z;
    const movingBlockStartX = movingBlockBefore.x;
    const movingBlockStartZ = movingBlockBefore.z;

    stepSimulation(state, {});

    const movingPlayerAfter = state.players.find((entry) => entry.playerId === "b");
    const stillPlayerAfter = state.players.find((entry) => entry.playerId === "a");
    const movingBlockAfter = state.blocks.find((block) => block.ownerId === "b");
    const deltaX = movingPlayerAfter.x - movingPlayerStartX;
    const deltaZ = movingPlayerAfter.z - movingPlayerStartZ;

    expect(Math.abs(deltaX) + Math.abs(deltaZ)).toBe(1);
    expect(movingBlockAfter.x - movingBlockStartX).toBe(deltaX);
    expect(movingBlockAfter.z - movingBlockStartZ).toBe(deltaZ);
    expect(stillPlayerAfter.x).toBe(stillPlayerStartX);
    expect(stillPlayerAfter.z).toBe(stillPlayerStartZ);
  });

  it("keeps AI-owned piles roaming when they reach patrol bounds", () => {
    const state = setupSimulation({
      aiPileMotionEnabled: true,
      aiPileMotionStepIntervalTicks: 1,
      aiPileMotionMaxOffset: 1,
      aiPileMotionPlayerIds: ["b"],
    });
    const movingPlayer = state.players.find((entry) => entry.playerId === "b");
    const startX = movingPlayer.x;
    const startZ = movingPlayer.z;
    let previousX = startX;
    let previousZ = startZ;
    let movementSteps = 0;

    for (let index = 0; index < 8; index += 1) {
      stepSimulation(state, {});

      const currentPlayer = state.players.find((entry) => entry.playerId === "b");
      if (currentPlayer.x !== previousX || currentPlayer.z !== previousZ) {
        movementSteps += 1;
      }

      previousX = currentPlayer.x;
      previousZ = currentPlayer.z;
    }

    expect(movementSteps).toBe(8);
    expect(Math.abs(previousX - startX)).toBeLessThanOrEqual(1);
    expect(Math.abs(previousZ - startZ)).toBeLessThanOrEqual(1);
  });

  it("stops moving a pile once its owner is dead", () => {
    const state = setupSimulation({
      aiPileMotionEnabled: true,
      aiPileMotionStepIntervalTicks: 1,
      aiPileMotionMaxOffset: 2,
      aiPileMotionPlayerIds: ["b"],
    });
    const movingPlayer = state.players.find((entry) => entry.playerId === "b");
    const movingBlock = state.blocks.find((block) => block.ownerId === "b");

    stepSimulation(state, {});

    const frozenX = movingPlayer.x;
    const frozenZ = movingPlayer.z;
    const frozenBlockX = movingBlock.x;
    const frozenBlockZ = movingBlock.z;

    movingPlayer.alive = false;

    stepSimulation(state, {});
    stepSimulation(state, {});

    expect(movingPlayer.x).toBe(frozenX);
    expect(movingPlayer.z).toBe(frozenZ);
    expect(movingBlock.x).toBe(frozenBlockX);
    expect(movingBlock.z).toBe(frozenBlockZ);
  });

  it("keeps moving piles away from the protected central anchor", () => {
    const state = setupSimulation({
      aiPileMotionEnabled: true,
      aiPileMotionStepIntervalTicks: 1,
      aiPileMotionMaxOffset: 6,
      aiPileMotionExcludePlayerId: "a",
      aiPileMotionMinDistanceToExcludedAnchor: 15,
      aiPileMotionPlayerIds: ["b"],
    });
    const protectedAnchor = state.pileAnchors.a;

    for (let index = 0; index < 24; index += 1) {
      stepSimulation(state, {});
      const movingPlayer = state.players.find((entry) => entry.playerId === "b");
      const distance = Math.hypot(movingPlayer.x - protectedAnchor.x, movingPlayer.z - protectedAnchor.z);
      expect(distance).toBeGreaterThanOrEqual(15);
    }
  });
});