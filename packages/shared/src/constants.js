export const DEFAULT_SPAWN_CONFIG = {
  pileSize: 3,
  pileHeight: 1,
  spacing: 16,
  cornerInwardScale: Math.SQRT1_2,
  baseY: 0,
  maxJumpDistance: 6,
};

export const DEFAULT_SIMULATION_CONFIG = {
  fixedDeltaSeconds: 1 / 30,
  moveSpeed: 6,
  jumpVelocity: 7.5,
  gravity: 20,
  chasmY: -20,
  aiPileMotionEnabled: false,
  aiPileMotionStepIntervalTicks: 45,
  aiPileMotionMaxOffset: 2,
  aiPileMotionExcludePlayerId: null,
  aiPileMotionMinDistanceToExcludedAnchor: 0,
  aiPileMotionPlayerIds: null,
};
