import { DEFAULT_SPAWN_CONFIG } from "./constants.js";

export function getGridDimension(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount <= 0) {
    throw new Error("playerCount must be a positive integer");
  }

  return Math.ceil(Math.sqrt(playerCount));
}

export function canJumpBetweenPiles({ spacing, pileSize, maxJumpDistance }) {
  if (spacing <= 0 || pileSize <= 0 || maxJumpDistance < 0) {
    return false;
  }

  const gapBetweenPileEdges = spacing - pileSize;
  return maxJumpDistance >= gapBetweenPileEdges;
}

export function validateSpawnConfig(config = DEFAULT_SPAWN_CONFIG) {
  const merged = { ...DEFAULT_SPAWN_CONFIG, ...config };

  if (!Number.isFinite(merged.cornerInwardScale) || merged.cornerInwardScale <= 0 || merged.cornerInwardScale > 1) {
    throw new Error("Invalid spawn config: cornerInwardScale must be > 0 and <= 1");
  }

  if (canJumpBetweenPiles(merged)) {
    throw new Error("Invalid spawn config: piles are too close together — players could jump between them");
  }

  return merged;
}

const CENTERED_RING_SLOT_ORDER = [
  { row: 1, col: 1 },
  { row: 0, col: 1 },
  { row: 2, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 2 },
  { row: 0, col: 0 },
  { row: 0, col: 2 },
  { row: 2, col: 0 },
  { row: 2, col: 2 },
];

export function allocateSpawnSlots(playerIds, config = DEFAULT_SPAWN_CONFIG) {
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    throw new Error("playerIds must be a non-empty array");
  }

  const validated = validateSpawnConfig(config);

  if (playerIds.length <= CENTERED_RING_SLOT_ORDER.length) {
    return playerIds.map((playerId, index) => {
      const { row, col } = CENTERED_RING_SLOT_ORDER[index];
      const baseX = col - 1;
      const baseZ = row - 1;
      const isCornerSlot = Math.abs(baseX) === 1 && Math.abs(baseZ) === 1;
      const cornerScale = isCornerSlot ? validated.cornerInwardScale : 1;

      return {
        playerId,
        row,
        col,
        x: baseX * validated.spacing * cornerScale,
        y: validated.baseY + validated.pileHeight - 1,
        z: baseZ * validated.spacing * cornerScale,
        foundationY: validated.baseY,
        pileSize: validated.pileSize,
        pileHeight: validated.pileHeight,
      };
    });
  }

  const gridDimension = getGridDimension(playerIds.length);

  return playerIds.map((playerId, index) => {
    const row = Math.floor(index / gridDimension);
    const col = index % gridDimension;

    return {
      playerId,
      row,
      col,
      x: col * validated.spacing,
      y: validated.baseY + validated.pileHeight - 1,
      z: row * validated.spacing,
      foundationY: validated.baseY,
      pileSize: validated.pileSize,
      pileHeight: validated.pileHeight,
    };
  });
}
