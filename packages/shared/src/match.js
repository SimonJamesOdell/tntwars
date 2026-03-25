export function createMatchState(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    throw new Error("A match requires at least 2 players");
  }

  return {
    players: playerIds.map((playerId) => ({
      playerId,
      alive: true,
      eliminatedAtTick: null,
    })),
    status: "running",
    winnerId: null,
    finishedAtTick: null,
  };
}

export function eliminatePlayer(state, playerId, tick) {
  // If the match already finished on a *different* tick, ignore (prevents post-game ghost eliminations).
  // Same-tick eliminations are allowed so simultaneous falls are both recorded.
  if (state.status === "finished" && state.finishedAtTick !== tick) {
    return state;
  }

  const player = state.players.find((entry) => entry.playerId === playerId);

  if (!player || !player.alive) {
    return state;
  }

  player.alive = false;
  player.eliminatedAtTick = tick;

  const alivePlayers = state.players.filter((entry) => entry.alive);

  if (alivePlayers.length === 1) {
    state.status = "finished";
    state.winnerId = alivePlayers[0].playerId;
    state.finishedAtTick = tick;
  }

  if (alivePlayers.length === 0) {
    state.status = "finished";
    state.winnerId = null;
    state.finishedAtTick = tick;
  }

  return state;
}

export function getAlivePlayers(state) {
  return state.players.filter((entry) => entry.alive).map((entry) => entry.playerId);
}
