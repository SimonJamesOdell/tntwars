import { describe, expect, it } from "vitest";
import {
  allocateSpawnSlots,
  canJumpBetweenPiles,
  getGridDimension,
  validateSpawnConfig,
} from "../src/spawn.js";

describe("spawn grid", () => {
  it("computes grid dimension for N players", () => {
    expect(getGridDimension(2)).toBe(2);
    expect(getGridDimension(4)).toBe(2);
    expect(getGridDimension(5)).toBe(3);
    expect(getGridDimension(10)).toBe(4);
  });

  it("allocates one unique slot per player", () => {
    const playerIds = ["p1", "p2", "p3", "p4", "p5"];
    const slots = allocateSpawnSlots(playerIds, {
      pileSize: 3,
      pileHeight: 1,
      spacing: 16,
      baseY: 0,
      maxJumpDistance: 6,
    });

    expect(slots).toHaveLength(playerIds.length);

    const uniquePositions = new Set(slots.map((slot) => `${slot.x}:${slot.z}`));
    expect(uniquePositions.size).toBe(playerIds.length);
  });

  it("fills enemy slots around the centered player in ring order", () => {
    const spacing = 16;
    const cornerInwardScale = Math.SQRT1_2;
    const playerIds = ["you", "bot-1", "bot-2", "bot-3", "bot-4", "bot-5", "bot-6", "bot-7", "bot-8"];
    const slots = allocateSpawnSlots(playerIds, {
      pileSize: 3,
      pileHeight: 1,
      spacing,
      cornerInwardScale,
      baseY: 0,
      maxJumpDistance: 6,
    });

    expect(slots.map((slot) => slot.playerId)).toEqual(playerIds);

    expect(slots[0].x).toBe(0);
    expect(slots[0].z).toBe(0);

    expect(slots[1].x).toBe(0);
    expect(slots[1].z).toBe(-spacing);
    expect(slots[2].x).toBe(0);
    expect(slots[2].z).toBe(spacing);
    expect(slots[3].x).toBe(-spacing);
    expect(slots[3].z).toBe(0);
    expect(slots[4].x).toBe(spacing);
    expect(slots[4].z).toBe(0);

    const expectedCornerOffset = spacing * cornerInwardScale;
    expect(slots[5].x).toBeCloseTo(-expectedCornerOffset);
    expect(slots[5].z).toBeCloseTo(-expectedCornerOffset);
    expect(slots[6].x).toBeCloseTo(expectedCornerOffset);
    expect(slots[6].z).toBeCloseTo(-expectedCornerOffset);
    expect(slots[7].x).toBeCloseTo(-expectedCornerOffset);
    expect(slots[7].z).toBeCloseTo(expectedCornerOffset);
    expect(slots[8].x).toBeCloseTo(expectedCornerOffset);
    expect(slots[8].z).toBeCloseTo(expectedCornerOffset);

    const centerDistanceToEdge = Math.hypot(slots[1].x, slots[1].z);
    const centerDistanceToCorner = Math.hypot(slots[5].x, slots[5].z);
    expect(centerDistanceToCorner).toBeCloseTo(centerDistanceToEdge);
  });

  it("rejects configs where players can jump between piles", () => {
    expect(() =>
      validateSpawnConfig({
        pileSize: 4,
        pileHeight: 1,
        spacing: 8,
        baseY: 0,
        maxJumpDistance: 5,
      }),
    ).toThrow(/too close/i);
  });

  it("validates default config as non-jumpable", () => {
    expect(canJumpBetweenPiles({ spacing: 16, pileSize: 3, maxJumpDistance: 6 })).toBe(false);
  });

  it("places spawn height on top of a multi-layer pile", () => {
    const [slot] = allocateSpawnSlots(["p1"], {
      pileSize: 5,
      pileHeight: 3,
      spacing: 20,
      baseY: 0,
      maxJumpDistance: 6,
    });

    expect(slot.foundationY).toBe(0);
    expect(slot.y).toBe(2);
    expect(slot.pileHeight).toBe(3);
  });
});
