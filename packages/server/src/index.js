import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import crypto from "node:crypto";

const LEADERBOARD_MAX_ENTRIES = 10;
const SCORE_UPDATE_MAX_DELTA = 8;
const SCORE_UPDATE_MAX_PER_SECOND = 30;
const SCORE_SESSION_IDLE_TTL_MS = 1000 * 60 * 60 * 24;
const BACKFILL_BLOCKS_PER_PILE = 7 * 7 * 3;
const BACKFILL_BLOCKS_DESTROYED_RATIO_PER_LEVEL = 0.75;
const BACKFILL_MAX_ENEMY_PILES = 8;
const INITIALS_REGEX = /^[A-Z]{1,4}$/;
const BLOCKED_INITIALS = new Set([
  "ARSE",
  "ASS",
  "BSTD",
  "COCK",
  "CRAP",
  "CUNT",
  "DICK",
  "FART",
  "FCK",
  "FUCK",
  "PISS",
  "SHIT",
  "SLUT",
  "TWAT",
  "WANK",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_LEADERBOARD_FILE_PATH = path.resolve(__dirname, "../data/leaderboard.json");
const leaderboardPath = process.env.LEADERBOARD_DATA_PATH
  ? path.resolve(process.env.LEADERBOARD_DATA_PATH)
  : DEFAULT_LEADERBOARD_FILE_PATH;

let leaderboard = [];
let writeQueue = Promise.resolve();
const scoreSessions = new Map();

function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

function pruneExpiredScoreSessions(now = Date.now()) {
  for (const [sessionId, session] of scoreSessions.entries()) {
    const idleMs = now - session.lastUpdatedAtMs;
    if (idleMs > SCORE_SESSION_IDLE_TTL_MS || session.submitted) {
      scoreSessions.delete(sessionId);
    }
  }
}

function createScoreSession() {
  const sessionId = generateId();
  const token = generateId();
  const now = Date.now();

  scoreSessions.set(sessionId, {
    token,
    createdAtMs: now,
    lastUpdatedAtMs: now,
    trackedScore: 0,
    submitted: false,
  });

  return {
    sessionId,
    token,
  };
}

function getAuthorizedSession(sessionId, token) {
  if (typeof sessionId !== "string" || typeof token !== "string") {
    return null;
  }

  const session = scoreSessions.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.token !== token) {
    return null;
  }

  return session;
}

function sanitizeInitials(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isInitialsAllowed(initials) {
  return INITIALS_REGEX.test(initials) && !BLOCKED_INITIALS.has(initials);
}

function normalizeInteger(value, min) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < min) {
    return null;
  }

  return Math.floor(numericValue);
}

function normalizeScore(value) {
  return normalizeInteger(value, 0);
}

function normalizeLevel(value) {
  return normalizeInteger(value, 1);
}

function estimateLevelFromScore(score) {
  if (!Number.isFinite(score) || score <= 0) {
    return 1;
  }

  let remainingScore = score;
  let level = 1;

  while (level < 10_000) {
    const enemyPileCount = Math.min(level, BACKFILL_MAX_ENEMY_PILES);
    const totalPiles = enemyPileCount + 1;
    const expectedScoreForLevel = BACKFILL_BLOCKS_PER_PILE * totalPiles * BACKFILL_BLOCKS_DESTROYED_RATIO_PER_LEVEL;

    if (remainingScore < expectedScoreForLevel) {
      return level;
    }

    remainingScore -= expectedScoreForLevel;
    level += 1;
  }

  return level;
}

function sanitizeLeaderboardEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      const initials = sanitizeInitials(entry?.initials);
      const score = normalizeScore(entry?.score);
      const createdAt = typeof entry?.createdAt === "string" ? entry.createdAt : new Date(0).toISOString();

      if (!isInitialsAllowed(initials) || score == null) {
        return null;
      }

      const level = normalizeLevel(entry?.level) ?? estimateLevelFromScore(score);

      return { initials, score, level: level ?? null, createdAt };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.createdAt.localeCompare(right.createdAt);
    })
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

async function persistLeaderboard() {
  const payload = JSON.stringify({ entries: leaderboard }, null, 2);

  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(leaderboardPath), { recursive: true });
    await fs.writeFile(leaderboardPath, payload, "utf8");
  });

  await writeQueue;
}

async function loadLeaderboard() {
  try {
    const raw = await fs.readFile(leaderboardPath, "utf8");
    const parsed = JSON.parse(raw);
    leaderboard = sanitizeLeaderboardEntries(parsed?.entries);
  } catch {
    leaderboard = [];
    await persistLeaderboard();
  }
}

function getPublicLeaderboard() {
  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    initials: entry.initials,
    score: entry.score,
    level: entry.level,
    createdAt: entry.createdAt,
  }));
}

function scoreQualifies(score) {
  if (leaderboard.length < LEADERBOARD_MAX_ENTRIES) {
    return true;
  }

  const cutoffScore = leaderboard[leaderboard.length - 1]?.score ?? 0;
  return score >= cutoffScore;
}

function createApp() {
  const app = express();

  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "tntwars-server" });
  });

  app.get("/api/leaderboard", (_req, res) => {
    const entries = getPublicLeaderboard();
    const cutoffScore = entries.length < LEADERBOARD_MAX_ENTRIES ? null : entries[entries.length - 1].score;
    res.json({
      ok: true,
      entries,
      maxEntries: LEADERBOARD_MAX_ENTRIES,
      cutoffScore,
    });
  });

  app.post("/api/leaderboard/session/start", (_req, res) => {
    pruneExpiredScoreSessions();
    const session = createScoreSession();
    res.json({
      ok: true,
      sessionId: session.sessionId,
      token: session.token,
    });
  });

  app.post("/api/leaderboard/session/update", (req, res) => {
    pruneExpiredScoreSessions();

    const sessionId = String(req.body?.sessionId ?? "");
    const token = String(req.body?.token ?? "");
    const delta = normalizeScore(req.body?.delta);

    if (delta == null || delta <= 0 || delta > SCORE_UPDATE_MAX_DELTA) {
      res.status(400).json({ ok: false, error: "Score delta must be a positive integer within allowed limits." });
      return;
    }

    const session = getAuthorizedSession(sessionId, token);
    if (!session || session.submitted) {
      res.status(401).json({ ok: false, error: "Invalid or expired score session." });
      return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.max(0.001, (now - session.createdAtMs) / 1000);
    const nextScore = session.trackedScore + delta;
    const maxAllowedScore = Math.floor(elapsedSeconds * SCORE_UPDATE_MAX_PER_SECOND);

    if (nextScore > maxAllowedScore) {
      res.status(400).json({ ok: false, error: "Score growth exceeded gameplay limits." });
      return;
    }

    session.trackedScore = nextScore;
    session.lastUpdatedAtMs = now;

    res.json({
      ok: true,
      trackedScore: session.trackedScore,
    });
  });

  app.post("/api/leaderboard/submit", async (req, res) => {
    const initials = sanitizeInitials(req.body?.initials);
    const score = normalizeScore(req.body?.score);
    const level = normalizeLevel(req.body?.level) ?? 1;
    const sessionId = String(req.body?.sessionId ?? "");
    const token = String(req.body?.token ?? "");

    if (score == null) {
      res.status(400).json({ ok: false, error: "Score must be a non-negative number." });
      return;
    }

    if (!isInitialsAllowed(initials)) {
      res.status(400).json({ ok: false, error: "Initials must be 1-4 letters and cannot be offensive." });
      return;
    }

    pruneExpiredScoreSessions();
    const session = getAuthorizedSession(sessionId, token);
    if (!session || session.submitted) {
      res.status(401).json({ ok: false, error: "A valid gameplay session is required to submit a score." });
      return;
    }

    if (session.trackedScore !== score) {
      res.status(400).json({ ok: false, error: "Submitted score does not match tracked gameplay score." });
      return;
    }

    if (!scoreQualifies(score)) {
      session.submitted = true;
      res.json({
        ok: true,
        qualified: false,
        entries: getPublicLeaderboard(),
      });
      return;
    }

    leaderboard.push({
      initials,
      score,
      level,
      createdAt: new Date().toISOString(),
    });
    leaderboard = sanitizeLeaderboardEntries(leaderboard);

    try {
      await persistLeaderboard();
    } catch {
      res.status(500).json({ ok: false, error: "Failed to persist leaderboard entry." });
      return;
    }

    session.submitted = true;

    res.json({
      ok: true,
      qualified: true,
      entries: getPublicLeaderboard(),
    });
  });

  return app;
}

async function startServer(options = {}) {
  await loadLeaderboard();

  const app = createApp();
  const port = Number(options.port ?? process.env.PORT ?? 5200);

  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(port, () => {
      resolve(listeningServer);
    });
  });

  return {
    app,
    server,
    port,
  };
}

function isDirectRun() {
  if (!process.argv[1]) {
    return false;
  }

  return pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isDirectRun()) {
  const { port } = await startServer();
  console.log(`TNTWARS server listening on http://localhost:${port}`);
}

export {
  createApp,
  startServer,
};
