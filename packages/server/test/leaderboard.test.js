import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const SCORE_UPDATE_MAX_DELTA = 8;
const SCORE_UPDATE_MAX_PER_SECOND = 30;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForHealth(baseUrl, timeoutMs = 6000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }

    await wait(100);
  }

  throw new Error("Server did not become healthy in time.");
}

async function startIsolatedServer(t) {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tntwars-server-test-"));
  const leaderboardDataPath = path.join(temporaryRoot, "leaderboard.json");
  const port = 27000 + Math.floor(Math.random() * 2000);
  const baseUrl = `http://127.0.0.1:${port}`;

  const processRef = spawn(process.execPath, ["src/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      LEADERBOARD_DATA_PATH: leaderboardDataPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    processRef.kill();
    await wait(80);
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  });

  await waitForHealth(baseUrl);

  return {
    baseUrl,
  };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  return {
    response,
    json,
  };
}

async function startScoreSession(baseUrl) {
  const started = await postJson(`${baseUrl}/api/leaderboard/session/start`, {});
  assert.equal(started.response.status, 200);
  assert.equal(started.json.ok, true);
  assert.equal(typeof started.json.sessionId, "string");
  assert.equal(typeof started.json.token, "string");

  return {
    sessionId: started.json.sessionId,
    token: started.json.token,
    startedAtMs: Date.now(),
    trackedScore: 0,
  };
}

async function attestScore(baseUrl, session, score) {
  let remaining = score;

  while (remaining > 0) {
    const delta = Math.min(SCORE_UPDATE_MAX_DELTA, remaining);
    const expectedScoreAfterUpdate = session.trackedScore + delta;
    const minimumElapsedMs = Math.ceil((expectedScoreAfterUpdate / SCORE_UPDATE_MAX_PER_SECOND) * 1000);
    const elapsedMs = Date.now() - session.startedAtMs;

    if (elapsedMs < minimumElapsedMs) {
      await wait(minimumElapsedMs - elapsedMs + 5);
    }

    const updated = await postJson(`${baseUrl}/api/leaderboard/session/update`, {
      sessionId: session.sessionId,
      token: session.token,
      delta,
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.json.ok, true);
    assert.equal(updated.json.trackedScore, expectedScoreAfterUpdate);

    session.trackedScore = expectedScoreAfterUpdate;
    remaining -= delta;
  }
}

async function submitAttestedScore(baseUrl, initials, score, level = 1) {
  const session = await startScoreSession(baseUrl);
  await attestScore(baseUrl, session, score);

  return postJson(`${baseUrl}/api/leaderboard/submit`, {
    initials,
    score,
    level,
    sessionId: session.sessionId,
    token: session.token,
  });
}

test("rejects offensive and invalid initials", async (t) => {
  const { baseUrl } = await startIsolatedServer(t);

  const offensive = await submitAttestedScore(baseUrl, "fuck", 1);

  assert.equal(offensive.response.status, 400);
  assert.equal(offensive.json.ok, false);

  const nonAlphabetic = await submitAttestedScore(baseUrl, "AB1", 1);

  assert.equal(nonAlphabetic.response.status, 400);
  assert.equal(nonAlphabetic.json.ok, false);
});

test("requires a valid gameplay session for submit", async (t) => {
  const { baseUrl } = await startIsolatedServer(t);

  const noSession = await postJson(`${baseUrl}/api/leaderboard/submit`, {
    initials: "ABCD",
    score: 3,
  });

  assert.equal(noSession.response.status, 401);
  assert.equal(noSession.json.ok, false);

  const started = await startScoreSession(baseUrl);
  await attestScore(baseUrl, started, 2);

  const mismatchedScore = await postJson(`${baseUrl}/api/leaderboard/submit`, {
    initials: "ABCD",
    score: 3,
    sessionId: started.sessionId,
    token: started.token,
  });

  assert.equal(mismatchedScore.response.status, 400);
  assert.equal(mismatchedScore.json.ok, false);
});

test("keeps only top 10 scores and enforces qualification", async (t) => {
  const { baseUrl } = await startIsolatedServer(t);
  const initials = [
    "AAAA",
    "AAAB",
    "AAAC",
    "AAAD",
    "AAAE",
    "AAAF",
    "AAAG",
    "AAAH",
    "AAAI",
    "AAAJ",
  ];

  for (let index = 0; index < initials.length; index += 1) {
    const submitted = await submitAttestedScore(baseUrl, initials[index], index + 1, index + 1);

    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.json.ok, true);
    assert.equal(submitted.json.qualified, true);
  }

  const tooLow = await submitAttestedScore(baseUrl, "BBBB", 0);

  assert.equal(tooLow.response.status, 200);
  assert.equal(tooLow.json.ok, true);
  assert.equal(tooLow.json.qualified, false);

  const newTop = await submitAttestedScore(baseUrl, "ZZZZ", 50, 12);

  assert.equal(newTop.response.status, 200);
  assert.equal(newTop.json.ok, true);
  assert.equal(newTop.json.qualified, true);

  const listResponse = await fetch(`${baseUrl}/api/leaderboard`);
  assert.equal(listResponse.status, 200);

  const listPayload = await listResponse.json();
  assert.equal(listPayload.ok, true);
  assert.equal(listPayload.entries.length, 10);
  assert.equal(listPayload.entries[0].initials, "ZZZZ");
  assert.equal(listPayload.entries[0].score, 50);
  assert.equal(listPayload.entries[0].level, 12);

  const scores = listPayload.entries.map((entry) => entry.score);
  assert.equal(scores.includes(1), false);
});
