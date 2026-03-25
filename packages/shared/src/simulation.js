import { DEFAULT_SIMULATION_CONFIG, DEFAULT_SPAWN_CONFIG } from "./constants.js";
import { createArenaBlocks } from "./blocks.js";
import { createMatchState, eliminatePlayer } from "./match.js";

const MAX_STEP_HEIGHT = 0.35;
const PLAYER_BODY_HEIGHT = 1.8;
const PLAYER_HALF_WIDTH = 0.4; // half of 0.8-wide player body
const BLOCK_HALF_WIDTH = 0.5; // half of 1-wide block
const COLLISION_RADIUS = PLAYER_HALF_WIDTH + BLOCK_HALF_WIDTH; // 0.9

const PILE_STEP_DIRECTIONS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function shouldMovePile(playerId, config) {
  if (!config.aiPileMotionEnabled) {
    return false;
  }

  if (playerId === config.aiPileMotionExcludePlayerId) {
    return false;
  }

  if (Array.isArray(config.aiPileMotionPlayerIds) && config.aiPileMotionPlayerIds.length > 0) {
    return config.aiPileMotionPlayerIds.includes(playerId);
  }

  return playerId.startsWith("bot-");
}

function createPileMotionState(players, config) {
  const pileMotion = {};

  for (const player of players) {
    if (!shouldMovePile(player.playerId, config)) {
      continue;
    }

    pileMotion[player.playerId] = {
      anchorX: player.x,
      anchorZ: player.z,
      offsetX: 0,
      offsetZ: 0,
      seed: hashString(player.playerId),
      directionIndex: hashString(player.playerId) % PILE_STEP_DIRECTIONS.length,
      stepsUntilTurn: 3 + (hashString(player.playerId) % 3),
      turnCount: 0,
    };
  }

  return Object.keys(pileMotion).length > 0 ? pileMotion : null;
}

function canStepInDirection(motion, directionIndex, maxOffset) {
  const direction = PILE_STEP_DIRECTIONS[directionIndex];
  const nextOffsetX = motion.offsetX + direction.x;
  const nextOffsetZ = motion.offsetZ + direction.z;

  return Math.abs(nextOffsetX) <= maxOffset && Math.abs(nextOffsetZ) <= maxOffset;
}

function canStepInDirectionWithDistanceLimit(
  motion,
  directionIndex,
  maxOffset,
  protectedAnchor,
  minDistanceToProtectedAnchor,
) {
  if (!canStepInDirection(motion, directionIndex, maxOffset)) {
    return false;
  }

  if (!protectedAnchor || !(minDistanceToProtectedAnchor > 0)) {
    return true;
  }

  const direction = PILE_STEP_DIRECTIONS[directionIndex];
  const nextCenterX = motion.anchorX + motion.offsetX + direction.x;
  const nextCenterZ = motion.anchorZ + motion.offsetZ + direction.z;
  const distanceToProtectedAnchor = Math.hypot(nextCenterX - protectedAnchor.x, nextCenterZ - protectedAnchor.z);

  return distanceToProtectedAnchor >= minDistanceToProtectedAnchor;
}

function getDirectionHoldSteps(motion, nextTick) {
  return 3 + ((motion.seed + motion.turnCount * 11 + nextTick * 5) % 4);
}

function pickNextDirectionIndex(
  ownerId,
  nextTick,
  pileMotion,
  maxOffset,
  protectedAnchor,
  minDistanceToProtectedAnchor,
) {
  const motion = pileMotion[ownerId];
  const startIndex = (motion.seed + motion.turnCount * 23 + nextTick * 7) % PILE_STEP_DIRECTIONS.length;

  for (let attempt = 0; attempt < PILE_STEP_DIRECTIONS.length; attempt += 1) {
    const directionIndex = (startIndex + attempt) % PILE_STEP_DIRECTIONS.length;

    if (directionIndex === motion.directionIndex) {
      continue;
    }

    if (
      canStepInDirectionWithDistanceLimit(
        motion,
        directionIndex,
        maxOffset,
        protectedAnchor,
        minDistanceToProtectedAnchor,
      )
    ) {
      return directionIndex;
    }
  }

  for (let attempt = 0; attempt < PILE_STEP_DIRECTIONS.length; attempt += 1) {
    const directionIndex = (startIndex + attempt) % PILE_STEP_DIRECTIONS.length;
    if (
      canStepInDirectionWithDistanceLimit(
        motion,
        directionIndex,
        maxOffset,
        protectedAnchor,
        minDistanceToProtectedAnchor,
      )
    ) {
      return directionIndex;
    }
  }

  return null;
}

function applyPileMotionStep(state, nextTick) {
  const {
    aiPileMotionEnabled,
    aiPileMotionStepIntervalTicks,
    aiPileMotionMaxOffset,
    aiPileMotionExcludePlayerId,
    aiPileMotionMinDistanceToExcludedAnchor,
  } = state.config;

  if (!aiPileMotionEnabled || !state.pileMotion) {
    return;
  }

  if (!Number.isFinite(aiPileMotionStepIntervalTicks) || aiPileMotionStepIntervalTicks <= 0) {
    return;
  }

  if (nextTick % aiPileMotionStepIntervalTicks !== 0) {
    return;
  }

  const protectedAnchor =
    aiPileMotionExcludePlayerId && state.pileAnchors
      ? state.pileAnchors[aiPileMotionExcludePlayerId] ?? null
      : null;

  for (const ownerId of Object.keys(state.pileMotion)) {
    const motion = state.pileMotion[ownerId];
    const player = state.players.find((entry) => entry.playerId === ownerId);

    if (!player?.alive) {
      continue;
    }

    if (
      motion.stepsUntilTurn <= 0 ||
      !canStepInDirectionWithDistanceLimit(
        motion,
        motion.directionIndex,
        aiPileMotionMaxOffset,
        protectedAnchor,
        aiPileMotionMinDistanceToExcludedAnchor,
      )
    ) {
      const nextDirectionIndex = pickNextDirectionIndex(
        ownerId,
        nextTick,
        state.pileMotion,
        aiPileMotionMaxOffset,
        protectedAnchor,
        aiPileMotionMinDistanceToExcludedAnchor,
      );

      if (nextDirectionIndex == null) {
        continue;
      }

      if (nextDirectionIndex !== motion.directionIndex) {
        motion.directionIndex = nextDirectionIndex;
        motion.turnCount += 1;
      }

      motion.stepsUntilTurn = getDirectionHoldSteps(motion, nextTick);
    }

    const direction = PILE_STEP_DIRECTIONS[motion.directionIndex];

    if (
      !canStepInDirectionWithDistanceLimit(
        motion,
        motion.directionIndex,
        aiPileMotionMaxOffset,
        protectedAnchor,
        aiPileMotionMinDistanceToExcludedAnchor,
      )
    ) {
      continue;
    }

    const nextOffsetX = motion.offsetX + direction.x;
    const nextOffsetZ = motion.offsetZ + direction.z;

    motion.offsetX = nextOffsetX;
    motion.offsetZ = nextOffsetZ;
    motion.stepsUntilTurn -= 1;

    for (const block of state.blocks) {
      if (block.ownerId !== ownerId) {
        continue;
      }

      block.x += direction.x;
      block.z += direction.z;
    }

    player.x += direction.x;
    player.z += direction.z;
  }
}

function normalizeMoveIntent(intent = {}) {
  const moveX = Number(intent.moveX ?? 0);
  const moveZ = Number(intent.moveZ ?? 0);
  const magnitude = Math.hypot(moveX, moveZ);

  if (magnitude === 0) {
    return { x: 0, z: 0 };
  }

  return {
    x: moveX / magnitude,
    z: moveZ / magnitude,
  };
}

function findSupportingBlock(player, blocks) {
  const supportingBlocks = blocks.filter(
    (block) =>
      block.ownerId === player.playerId &&
      Math.abs(player.x - block.x) < COLLISION_RADIUS &&
      Math.abs(player.z - block.z) < COLLISION_RADIUS &&
      block.y <= player.y + 0.5,
  );

  if (supportingBlocks.length === 0) {
    return null;
  }

  return supportingBlocks.reduce((highestBlock, block) => (block.y > highestBlock.y ? block : highestBlock));
}

function collidesWithWall(player, x, z, blocks) {
  // When grounded, allow stepping up to MAX_STEP_HEIGHT seamlessly.
  // When airborne, use no step allowance — the player must not drift into a
  // wall that temporarily fell below the step threshold during the jump arc.
  const stepThreshold = player.grounded ? MAX_STEP_HEIGHT : 0;
  return blocks.some(
    (block) =>
      block.y > player.y + stepThreshold &&
      block.y < player.y + PLAYER_BODY_HEIGHT &&
      Math.abs(x - block.x) < COLLISION_RADIUS &&
      Math.abs(z - block.z) < COLLISION_RADIUS,
  );
}

export function createSimulationState(playerIds, spawnSlots, config = {}) {
  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    throw new Error("Simulation requires at least 2 players");
  }

  if (!Array.isArray(spawnSlots) || spawnSlots.length !== playerIds.length) {
    throw new Error("spawnSlots must match playerIds length");
  }

  const simulationConfig = {
    ...DEFAULT_SIMULATION_CONFIG,
    baseY: DEFAULT_SPAWN_CONFIG.baseY,
    ...config,
  };

  return {
    tick: 0,
    config: simulationConfig,
    blocks: createArenaBlocks(spawnSlots),
    match: createMatchState(playerIds),
    players: spawnSlots.map((slot) => ({
      playerId: slot.playerId,
      x: slot.x,
      y: slot.y,
      z: slot.z,
      vy: 0,
      grounded: true,
      alive: true,
    })),
    pileAnchors: Object.fromEntries(spawnSlots.map((slot) => [slot.playerId, { x: slot.x, z: slot.z }])),
    pileMotion: null,
  };
}

export function stepSimulation(state, inputByPlayerId = {}) {
  const nextTick = state.tick + 1;
  const { fixedDeltaSeconds, moveSpeed, jumpVelocity, gravity, chasmY } = state.config;

  if (state.pileMotion == null) {
    state.pileMotion = createPileMotionState(state.players, state.config);
  }

  applyPileMotionStep(state, nextTick);

  for (const player of state.players) {
    if (!player.alive) {
      continue;
    }

    const input = inputByPlayerId[player.playerId] ?? {};
    const move = normalizeMoveIntent(input);
    const horizontalDeltaX = move.x * moveSpeed * fixedDeltaSeconds;
    const horizontalDeltaZ = move.z * moveSpeed * fixedDeltaSeconds;
    const previousY = player.y;

    const nextX = player.x + horizontalDeltaX;
    if (!collidesWithWall(player, nextX, player.z, state.blocks)) {
      player.x = nextX;
    }

    const nextZ = player.z + horizontalDeltaZ;
    if (!collidesWithWall(player, player.x, nextZ, state.blocks)) {
      player.z = nextZ;
    }

    const supportBlock = findSupportingBlock(player, state.blocks);

    if (input.jump && player.grounded && supportBlock) {
      player.vy = jumpVelocity;
      player.grounded = false;
    }

    if (!supportBlock || !player.grounded) {
      player.vy -= gravity * fixedDeltaSeconds;
      player.y += player.vy * fixedDeltaSeconds;
    }

    const landingBlock = findSupportingBlock(player, state.blocks);
    const crossedTopSurfaceFromAbove = previousY >= (landingBlock?.y ?? Number.POSITIVE_INFINITY);

    if (landingBlock && player.vy <= 0 && player.y <= landingBlock.y && crossedTopSurfaceFromAbove) {
      player.y = landingBlock.y;
      player.vy = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }

    if (player.y < chasmY) {
      player.alive = false;
      player.grounded = false;
      eliminatePlayer(state.match, player.playerId, nextTick);
    }
  }

  state.tick = nextTick;
  return state;
}