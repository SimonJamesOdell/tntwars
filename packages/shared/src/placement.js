import { createBlock } from "./blocks.js";

export function getBlockKey(x, y, z) {
  return `${x}:${y}:${z}`;
}

export function snapToGrid(value) {
  return Math.round(value);
}

export function hasBlockAt(blocks, x, y, z) {
  const key = getBlockKey(x, y, z);
  return blocks.some((block) => getBlockKey(block.x, block.y, block.z) === key);
}

export function canPlaceBlock(blocks, ownerId, x, y, z) {
  if (hasBlockAt(blocks, x, y, z)) {
    return false;
  }

  return blocks.some((block) => {
    if (block.ownerId !== ownerId || block.y !== y) {
      return false;
    }

    const manhattanDistance = Math.abs(block.x - x) + Math.abs(block.z - z);
    return manhattanDistance === 1;
  });
}

export function placeBlock(blocks, ownerId, rawX, rawY, rawZ) {
  const x = snapToGrid(rawX);
  const y = snapToGrid(rawY);
  const z = snapToGrid(rawZ);

  if (!canPlaceBlock(blocks, ownerId, x, y, z)) {
    return {
      placed: false,
      blocks,
      block: null,
    };
  }

  const block = createBlock(ownerId, x, y, z);
  return {
    placed: true,
    blocks: [...blocks, block],
    block,
  };
}