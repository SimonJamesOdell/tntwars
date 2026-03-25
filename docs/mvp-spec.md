# TNTWARS MVP Spec

## Core loop

- Players spawn on separate block piles in an arena over a chasm.
- Players move using WASD and jump to stay balanced on their structure.
- Players place blocks to maintain/rebuild support.
- Players throw TNT projectiles that arc and explode to remove enemy blocks.
- Last surviving player wins the round.

## Match rules

- Supports 2..N players.
- Spawn slots are assigned on a square grid layout.
- Pile spacing must exceed max jump distance so players cannot jump between piles without building.
- A player is eliminated if they fall into the chasm.
- Winner is declared when only one alive player remains.
- If all players are eliminated in the same tick, the round is a draw.

## Authoritative simulation

- Server runs fixed tick simulation.
- Clients send intents: move, jump, place block, throw TNT.
- Server validates and applies intent effects.
- Shared rules package is the single source of truth for deterministic gameplay rules.

## TDD baseline

Current tests in shared package verify:

- Spawn grid sizing from player count.
- Unique spawn slot allocation.
- Spawn spacing is non-jumpable.
- Last-player-standing winner resolution.
- Simultaneous elimination draw handling.
- Horizontal movement while supported.
- Jump impulse and gravity over fixed ticks.
- Falling off support into the chasm.
- TNT projectile parabolic stepping.
- Explosion radius block removal on impact.
