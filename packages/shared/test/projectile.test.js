import { describe, expect, it } from "vitest";
import { allocateSpawnSlots } from "../src/spawn.js";
import { createArenaBlocks } from "../src/blocks.js";
import {
  createProjectile,
  explodeBlocks,
  resolveProjectileImpact,
  stepProjectile,
} from "../src/projectile.js";

describe("TNT projectile rules", () => {
  it("creates square starting piles from spawn slots", () => {
    const spawnSlots = allocateSpawnSlots(["a"], {
      pileSize: 3,
      spacing: 16,
      baseY: 0,
      maxJumpDistance: 6,
    });

    const blocks = createArenaBlocks(spawnSlots);
    expect(blocks).toHaveLength(9);
  });

  it("steps projectiles in a parabolic arc", () => {
    const projectile = createProjectile({
      ownerId: "a",
      position: { x: 0, y: 2, z: 0 },
      velocity: { x: 4, y: 6, z: 0 },
      blastRadius: 1.5,
    });

    stepProjectile(projectile, { fixedDeltaSeconds: 0.5, gravity: 10 });

    expect(projectile.position.x).toBeCloseTo(2);
    expect(projectile.position.y).toBeCloseTo(5);
    expect(projectile.velocity.y).toBeCloseTo(1);
  });

  it("destroys one closest exposed block per blast", () => {
    const blocks = [
      { ownerId: "a", x: 0, y: 0, z: 0 },
      { ownerId: "b", x: 1, y: 0, z: 0 },
      { ownerId: "b", x: 3, y: 0, z: 0 },
    ];

    const result = explodeBlocks(blocks, { x: 0, y: 0, z: 0 }, 1.5);

    expect(result.destroyedBlocks).toHaveLength(1);
    expect(result.criticalHit).toBe(false);
    expect(result.destroyedBlocks[0]).toEqual({ ownerId: "a", x: 0, y: 0, z: 0 });
    expect(result.remainingBlocks).toHaveLength(2);
  });

  it("can trigger a critical hit that destroys 3 to 5 exposed blocks", () => {
    const blocks = [
      { ownerId: "a", x: 0, y: 0, z: 0 },
      { ownerId: "a", x: 2, y: 0, z: 0 },
      { ownerId: "a", x: -2, y: 0, z: 0 },
      { ownerId: "a", x: 0, y: 2, z: 0 },
      { ownerId: "a", x: 0, y: 0, z: 2 },
      { ownerId: "a", x: 0, y: 0, z: -2 },
    ];

    const rngValues = [0.05, 0.99, 0.2, 0.8, 0.4, 0.6, 0.1, 0.3];
    const rng = () => rngValues.shift() ?? 0;
    const result = explodeBlocks(blocks, { x: 0, y: 0, z: 0 }, 2, {
      criticalHitChance: 0.1,
      criticalHitMinBlocks: 3,
      criticalHitMaxBlocks: 5,
      rng,
    });

    expect(result.criticalHit).toBe(true);
    expect(result.destroyedBlocks).toHaveLength(5);
    expect(result.destroyedBlocks).toContainEqual({ ownerId: "a", x: 0, y: 0, z: 0 });
    expect(result.remainingBlocks).toHaveLength(1);
  });

  it("explodes on contact and removes impacted enemy blocks", () => {
    const blocks = [{ ownerId: "b", x: 2, y: 0, z: 0 }];
    const projectile = createProjectile({
      ownerId: "a",
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 4, y: 0, z: 0 },
      blastRadius: 1,
    });

    stepProjectile(projectile, { fixedDeltaSeconds: 0.5, gravity: 0 });
    const result = resolveProjectileImpact(projectile, blocks);

    expect(result.exploded).toBe(true);
    expect(result.criticalHit).toBe(false);
    expect(result.impactedBlock).toEqual({ ownerId: "b", x: 2, y: 0, z: 0 });
    expect(result.destroyedBlocks).toHaveLength(1);
    expect(result.remainingBlocks).toEqual([]);
  });

  it("passes critical-hit options through projectile impacts", () => {
    const blocks = [
      { ownerId: "b", x: 2, y: 0, z: 0 },
      { ownerId: "b", x: 4, y: 0, z: 0 },
      { ownerId: "b", x: 2, y: 2, z: 0 },
      { ownerId: "b", x: 2, y: 0, z: 2 },
    ];
    const projectile = createProjectile({
      ownerId: "a",
      position: { x: 2, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      blastRadius: 2,
    });
    const rngValues = [0.01, 0.0, 0.8, 0.2, 0.6, 0.4];
    const rng = () => rngValues.shift() ?? 0;

    const result = resolveProjectileImpact(projectile, blocks, {
      criticalHitChance: 0.1,
      criticalHitMinBlocks: 3,
      criticalHitMaxBlocks: 5,
      rng,
    });

    expect(result.exploded).toBe(true);
    expect(result.criticalHit).toBe(true);
    expect(result.destroyedBlocks).toHaveLength(3);
    expect(result.remainingBlocks).toHaveLength(1);
  });

  it("does not destroy fully enclosed interior blocks", () => {
    const blocks = [];
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          blocks.push({ ownerId: "a", x, y, z });
        }
      }
    }

    const result = explodeBlocks(blocks, { x: 0, y: 0, z: 0 }, 3);
    const destroyedKeys = new Set(result.destroyedBlocks.map((block) => `${block.x}:${block.y}:${block.z}`));

    expect(destroyedKeys.has("0:0:0")).toBe(false);
    expect(result.remainingBlocks).toContainEqual({ ownerId: "a", x: 0, y: 0, z: 0 });
  });

  it("does not destroy blocks exposed on only one side", () => {
    const blocks = [];
    for (let x = -1; x <= 1; x += 1) {
      for (let z = -1; z <= 1; z += 1) {
        blocks.push({ ownerId: "a", x, y: 0, z });
        blocks.push({ ownerId: "a", x, y: 1, z });
      }
    }

    const topCenter = { ownerId: "a", x: 0, y: 1, z: 0 };
    const result = explodeBlocks(blocks, { x: 0, y: 1, z: 0 }, 1.5);

    expect(result.destroyedBlocks).not.toContainEqual(topCenter);
    expect(result.remainingBlocks).toContainEqual(topCenter);
  });

  it("bounces instead of exploding when impacting a non-destroyable top block", () => {
    const blocks = [];
    for (let x = -1; x <= 1; x += 1) {
      for (let z = -1; z <= 1; z += 1) {
        blocks.push({ ownerId: "a", x, y: 0, z });
        blocks.push({ ownerId: "a", x, y: 1, z });
      }
    }

    const projectile = createProjectile({
      ownerId: "b",
      position: { x: 0, y: 1.5, z: 0 },
      velocity: { x: 0, y: -4, z: 0 },
      blastRadius: 1.5,
    });

    const result = resolveProjectileImpact(projectile, blocks);

    expect(result.exploded).toBe(false);
    expect(projectile.alive).toBe(true);
    expect(projectile.velocity.y).toBeGreaterThan(0);
    expect(result.destroyedBlocks).toHaveLength(0);
  });

  it("requires multiple blasts to reach inner blocks", () => {
    const blocks = [];
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          blocks.push({ ownerId: "a", x, y, z });
        }
      }
    }

    let remaining = blocks;
    let blasts = 0;

    while (remaining.some((block) => block.x === 0 && block.y === 0 && block.z === 0) && blasts < 40) {
      remaining = explodeBlocks(remaining, { x: 0, y: 0, z: 0 }, 3).remainingBlocks;
      blasts += 1;
    }

    expect(blasts).toBeGreaterThan(1);
    expect(remaining).not.toContainEqual({ ownerId: "a", x: 0, y: 0, z: 0 });
  });
});