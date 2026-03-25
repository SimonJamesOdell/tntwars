import { createArenaBlocks } from "./blocks.js";
import { getBlockKey } from "./placement.js";

function isPointInsideBlock(position, block) {
  return (
    Math.abs(position.x - block.x) <= 0.5 &&
    Math.abs(position.y - block.y) <= 0.5 &&
    Math.abs(position.z - block.z) <= 0.5
  );
}

export function createProjectile({ ownerId, position, velocity, blastRadius = 1.5 }) {
  return {
    ownerId,
    position: { ...position },
    velocity: { ...velocity },
    blastRadius,
    alive: true,
    ageTicks: 0,
  };
}

export function stepProjectile(projectile, config = {}) {
  const { fixedDeltaSeconds = 1 / 30, gravity = 20 } = config;

  projectile.position.x += projectile.velocity.x * fixedDeltaSeconds;
  projectile.position.y += projectile.velocity.y * fixedDeltaSeconds;
  projectile.position.z += projectile.velocity.z * fixedDeltaSeconds;
  projectile.velocity.y -= gravity * fixedDeltaSeconds;
  projectile.ageTicks += 1;

  return projectile;
}

export function getBlocksWithinRadius(blocks, center, radius) {
  return blocks.filter((block) => {
    const distance = Math.hypot(block.x - center.x, block.y - center.y, block.z - center.z);
    return distance <= radius;
  });
}

function randomIntegerInclusive(min, max, rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

function pickRandomBlocks(blocks, count, rng) {
  const pool = [...blocks];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, count);
}

function isBlockExposed(block, blockKeys) {
  const neighbors = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  const exposedFaces = neighbors.reduce((count, [dx, dy, dz]) => {
    const hasNeighbor = blockKeys.has(getBlockKey(block.x + dx, block.y + dy, block.z + dz));
    return count + (hasNeighbor ? 0 : 1);
  }, 0);

  return exposedFaces >= 2;
}

export function explodeBlocks(blocks, center, radius, options = {}) {
  const {
    criticalHitChance = 0,
    criticalHitMinBlocks = 3,
    criticalHitMaxBlocks = 5,
    rng = Math.random,
  } = options;
  const blockKeys = new Set(blocks.map((block) => getBlockKey(block.x, block.y, block.z)));
  const candidates = getBlocksWithinRadius(blocks, center, radius).filter((block) => isBlockExposed(block, blockKeys));
  const [closestExposedBlock] = candidates
    .map((block) => ({
      block,
      distance: Math.hypot(block.x - center.x, block.y - center.y, block.z - center.z),
    }))
    .sort((a, b) => a.distance - b.distance);
  const criticalHitCount = Math.max(criticalHitMinBlocks, 1);
  const canCriticalHit = closestExposedBlock && candidates.length >= criticalHitCount;
  const didCriticalHit = canCriticalHit && rng() < criticalHitChance;
  let destroyedBlocks = closestExposedBlock ? [closestExposedBlock.block] : [];

  if (didCriticalHit && closestExposedBlock) {
    const targetCount = Math.min(
      candidates.length,
      randomIntegerInclusive(criticalHitMinBlocks, criticalHitMaxBlocks, rng),
    );
    const additionalBlocks = pickRandomBlocks(
      candidates.filter((block) => block !== closestExposedBlock.block),
      Math.max(0, targetCount - 1),
      rng,
    );
    destroyedBlocks = [closestExposedBlock.block, ...additionalBlocks];
  }

  const destroyedKeys = new Set(destroyedBlocks.map((block) => getBlockKey(block.x, block.y, block.z)));
  const remainingBlocks = blocks.filter(
    (block) => !destroyedKeys.has(getBlockKey(block.x, block.y, block.z)),
  );

  return {
    criticalHit: didCriticalHit,
    destroyedBlocks,
    remainingBlocks,
  };
}

export function resolveProjectileImpact(projectile, blocks, options = {}) {
  const impactedBlock = blocks.find((block) => isPointInsideBlock(projectile.position, block)) ?? null;

  if (!impactedBlock) {
    return {
      exploded: false,
      impactedBlock: null,
      destroyedBlocks: [],
      remainingBlocks: blocks,
    };
  }

  const blockKeys = new Set(blocks.map((block) => getBlockKey(block.x, block.y, block.z)));
  if (!isBlockExposed(impactedBlock, blockKeys)) {
    // Non-destroyable impacts should deflect the projectile instead of exploding.
    projectile.position.y = impactedBlock.y + 0.56;
    projectile.velocity.y = Math.max(1.5, Math.abs(projectile.velocity.y) * 0.58);
    projectile.velocity.x *= 0.74;
    projectile.velocity.z *= 0.74;

    return {
      exploded: false,
      impactedBlock,
      criticalHit: false,
      destroyedBlocks: [],
      remainingBlocks: blocks,
    };
  }

  projectile.alive = false;

  const { destroyedBlocks, remainingBlocks } = explodeBlocks(
    blocks,
    projectile.position,
    projectile.blastRadius,
    options,
  );

  return {
    exploded: true,
    impactedBlock,
    criticalHit: destroyedBlocks.length > 1,
    destroyedBlocks,
    remainingBlocks,
  };
}

