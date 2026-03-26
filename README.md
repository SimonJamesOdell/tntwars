# TNTWARS

Multiplayer last-player-standing arena game built with JavaScript.

## AI notice and warranty disclaimer

This software is 100% generated and maintained by AI.

This project is provided "as is" and "as available", with no guarantee or warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, reliability, availability, or security.

By using this software, you acknowledge that you do so at your own risk.

## MVP rules

- 2..8 players per match.
- Each player spawns on their own pile in a grid layout.
- Pile spacing is intentionally non-jumpable.
- Last player standing wins.
- Simultaneous final eliminations result in a draw.

## Monorepo layout

- `packages/client`: WebGL client (Three.js + Vite)
- `packages/server`: Authoritative multiplayer server (Node.js + Colyseus)
- `packages/shared`: Shared deterministic game rules and tests

## Start

```bash
npm install
npm test
```

## Development

```bash
npm run dev:client
npm run dev:server
```

## Global leaderboard

- Server endpoints:
	- `GET /api/leaderboard` returns top 10 entries.
	- `POST /api/leaderboard/session/start` starts an attestation session.
	- `POST /api/leaderboard/session/update` attests score deltas during gameplay.
	- `POST /api/leaderboard/submit` accepts `{ initials, score, level, sessionId, token }`.
- Initials rules:
	- 1 to 4 letters (`A-Z`) only.
	- No numbers, spaces, punctuation, or symbols.
	- Common offensive combinations are blocked.
- Persistence:
	- Entries are saved to `packages/server/data/leaderboard.json`.
	- Override file path with `LEADERBOARD_DATA_PATH` (recommended on VPS).

Client API base URL resolution:

- Uses `VITE_LEADERBOARD_API_BASE_URL` if set.
- Otherwise uses `http://localhost:5200` on localhost.
- Otherwise uses `http://<current-hostname>:5200`.

## VPS and domain deployment

1. Provision a Node 20+ VPS.
2. Clone repo and install deps: `npm ci`.
3. Build client: `npm run build -w @tntwars/client`.
4. Run server with a process manager (PM2/systemd).
5. Put Nginx/Caddy in front:
	 - Serve static client from `packages/client/dist`.
	 - Reverse proxy `/api/*` to `http://127.0.0.1:5200`.
	 - Reverse proxy `/health` to `http://127.0.0.1:5200`.
6. Attach your domain and enable HTTPS (Let's Encrypt).
7. Persist `packages/server/data` on disk backups.

Optional environment variables for server deployment:

- `PORT`: HTTP port (default `5200`).
- `LEADERBOARD_DATA_PATH`: absolute or relative file path for leaderboard data.

## Server tests

```bash
npm run test:server
```

## TDD process

1. Write/adjust a failing test in `packages/shared/test`.
2. Implement the smallest rules change in `packages/shared/src`.
3. Run tests until green.
4. Integrate rules in server simulation and client rendering.

See `docs/mvp-spec.md` for the current gameplay contract.

## Current shared coverage

- Spawn grid sizing and slot allocation.
- Non-jumpable pile spacing validation.
- Last-player-standing winner resolution.
- Same-tick elimination draw handling.
- Fixed-tick movement, jump, gravity, and chasm elimination.
- TNT projectile arc stepping and blast-radius block destruction.
