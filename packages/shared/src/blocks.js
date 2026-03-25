export function createBlock(ownerId, x, y, z) {
  return { ownerId, x, y, z };
}

export function createStartingPile(slot) {
  const blocks = [];
  const half = Math.floor(slot.pileSize / 2);
  const pileHeight = slot.pileHeight ?? 1;
  const foundationY = slot.foundationY ?? slot.y;

  for (let offsetY = 0; offsetY < pileHeight; offsetY += 1) {
    for (let offsetX = -half; offsetX <= half; offsetX += 1) {
      for (let offsetZ = -half; offsetZ <= half; offsetZ += 1) {
        blocks.push(createBlock(slot.playerId, slot.x + offsetX, foundationY + offsetY, slot.z + offsetZ));
      }
    }
  }

  return blocks;
}

export function createArenaBlocks(spawnSlots) {
  return spawnSlots.flatMap((slot) => createStartingPile(slot));
}