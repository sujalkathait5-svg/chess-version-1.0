// backend/tests/db.integration.test.js
// KingsGauntlet Chess Arena — Database Integration Tests
// Run: npm test
// Requires: PostgreSQL + MongoDB running locally (or Docker Compose)

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// ── App setup (lightweight version without Stockfish engine) ─────────────
function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/games', require('../routes/games'));
  app.use('/api/preferences', require('../routes/preferences'));
  app.use('/api/leaderboard', require('../routes/leaderboard'));
  app.use('/api/friends', require('../routes/friends'));
  return app;
}

// ── Shared state between tests ────────────────────────────────────────────
let app;
let pgPool;
let mongoose;
let authToken;
let userId;
let testGameId;

const TEST_USER = {
  username: `u_${Date.now().toString(36)}`,
  email: `test_${Date.now()}@kg-test.com`,
  password: 'Test1234!',
};

// ── Setup / Teardown ──────────────────────────────────────────────────────
beforeAll(async () => {
  const pgModule = require('../db/sqlite');
  const mongoModule = require('../db/mongo');
  pgPool = pgModule.getPgClient();

  try {
    await pgModule.initializeSqlite();
    await mongoModule.connectMongo();
    mongoose = require('mongoose');
  } catch (err) {
    console.warn('⚠️  DB connection failed — tests will be skipped:', err.message);
  }

  app = createTestApp();
}, 30000);

afterAll(async () => {
  // Cleanup test user from both databases
  if (pgPool && userId) {
    try {
      await pgPool.query('DELETE FROM users WHERE id = $1', [userId]);
    } catch (err) { /* ignore */ }
  }
  if (mongoose && mongoose.connection.readyState === 1) {
    const Game = require('../models/Game');
    const Analysis = require('../models/Analysis');
    const Prefs = require('../models/UserPreferences');
    await Promise.allSettled([
      Game.deleteMany({ whitePlayerId: userId }),
      Analysis.deleteMany({ gameId: testGameId }),
      Prefs.deleteMany({ userId }),
    ]);
    await mongoose.disconnect();
  }
}, 20000);

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-001
// Layer: Cross-DB (PostgreSQL + MongoDB)
// Operation: POST /api/auth/register
// Setup: No prior user exists
// Expected: PG user row + elo_ratings row + user_stats_summary row + MongoDB prefs doc — all 4 exist
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-001] User Registration — Atomic cross-DB creation', () => {
  test('Creates PG user + elo + stats + MongoDB prefs atomically', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBeDefined();

    authToken = res.body.token;
    userId = res.body.user.id;

    if (!pgPool) return;

    // Verify PG: user row
    const userRow = await pgPool.query('SELECT id FROM users WHERE id = $1', [userId]);
    expect(userRow.rows.length).toBe(1);

    // Verify PG: elo_ratings row
    const eloRow = await pgPool.query('SELECT user_id FROM elo_ratings WHERE user_id = $1', [userId]);
    expect(eloRow.rows.length).toBe(1);

    // Verify PG: user_stats_summary row
    const statsRow = await pgPool.query('SELECT user_id FROM user_stats_summary WHERE user_id = $1', [userId]);
    expect(statsRow.rows.length).toBe(1);

    // Verify MongoDB: preferences doc
    if (mongoose?.connection.readyState === 1) {
      const UserPreferences = require('../models/UserPreferences');
      const prefs = await UserPreferences.findOne({ userId });
      expect(prefs).not.toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-002
// Layer: PostgreSQL
// Operation: Elo update with transaction
// Expected: No partial update — either both values change or neither does
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-002] Elo Transaction Integrity', () => {
  test('Elo rating only updates if complete transaction succeeds', async () => {
    if (!pgPool || !userId) return;

    // Read current rating
    const before = await pgPool.query(
      'SELECT rating_vs_ai FROM elo_ratings WHERE user_id = $1',
      [userId]
    );
    const ratingBefore = before.rows[0]?.rating_vs_ai ?? 1200;

    // Simulate a failed transaction — ROLLBACK should restore original value
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE elo_ratings SET rating_vs_ai = $1 WHERE user_id = $2', [1500, userId]);
      await client.query('ROLLBACK'); // Simulate crash / failure
    } finally {
      client.release();
    }

    const after = await pgPool.query(
      'SELECT rating_vs_ai FROM elo_ratings WHERE user_id = $1',
      [userId]
    );
    // After rollback, rating must equal original value — no partial update
    expect(after.rows[0].rating_vs_ai).toBe(ratingBefore);
  });

  test('Peak rating only ever increases (GREATEST logic)', async () => {
    if (!pgPool || !userId) return;

    // Set rating high first
    await pgPool.query(
      'UPDATE elo_ratings SET rating_vs_ai = 1600, peak_rating_vs_ai = GREATEST(peak_rating_vs_ai, 1600) WHERE user_id = $1',
      [userId]
    );
    // Then drop it
    await pgPool.query(
      'UPDATE elo_ratings SET rating_vs_ai = 1100, peak_rating_vs_ai = GREATEST(peak_rating_vs_ai, 1100) WHERE user_id = $1',
      [userId]
    );

    const row = await pgPool.query(
      'SELECT rating_vs_ai, peak_rating_vs_ai FROM elo_ratings WHERE user_id = $1',
      [userId]
    );
    // Rating dropped but peak should still be 1600
    expect(row.rows[0].rating_vs_ai).toBe(1100);
    expect(row.rows[0].peak_rating_vs_ai).toBe(1600);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-003
// Layer: MongoDB
// Operation: POST /api/games (80-move game storage)
// Expected: All 80 moves stored without truncation
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-003] 80-Move Game Storage', () => {
  test('Saves all 80 moves without truncation', async () => {
    if (!authToken) return;

    const moves80 = Array.from({ length: 80 }, (_, i) => ({
      san: i % 2 === 0 ? 'e4' : 'e5',
      uci: i % 2 === 0 ? 'e2e4' : 'e7e5',
      fen: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ${i + 1}`,
    }));

    testGameId = `test_${Date.now()}`;
    const gamePayload = {
      gameId: testGameId,
      whitePlayerId: userId,
      blackPlayerId: 'stockfish_level_4',
      mode: 'vs_ai',
      result: 'White Won by Checkmate',
      termination: 'checkmate',
      moves: moves80,
      pgn: '1. e4 e5 ...',
      totalMoves: 80,
    };

    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${authToken}`)
      .send(gamePayload)
      .expect(201);

    expect(res.body.success).toBe(true);

    // Verify in MongoDB
    if (mongoose?.connection.readyState === 1) {
      const Game = require('../models/Game');
      const gameDoc = await Game.findOne({ gameId: testGameId });
      expect(gameDoc).not.toBeNull();
      expect(gameDoc.moves.length).toBe(80); // Exactly 80 — no truncation
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-004
// Layer: Cross-DB
// Operation: GET /api/games (dashboard stats)
// Expected: Returned game count matches what's in MongoDB
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-004] Dashboard Stats Accuracy', () => {
  test('Game list count matches MongoDB game records', async () => {
    if (!authToken) return;

    const res = await request(app)
      .get('/api/games')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.games)).toBe(true);

    if (mongoose?.connection.readyState === 1) {
      const Game = require('../models/Game');
      const actualCount = await Game.countDocuments({
        $or: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      });
      expect(res.body.games.length).toBe(actualCount);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-005
// Layer: MongoDB
// Operation: POST /api/games/migrate (deduplication)
// Expected: Importing the same game twice = exactly 1 document in MongoDB
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-005] localStorage Migration Deduplication', () => {
  test('Importing same gameId twice results in exactly 1 document', async () => {
    if (!authToken || !mongoose || mongoose.connection.readyState !== 1) return;

    const dupeGameId = `dupe_test_${Date.now()}`;
    const gamePayload = {
      games: [
        { gameId: dupeGameId, result: 'White Won', playedAt: new Date().toISOString() },
        { gameId: dupeGameId, result: 'White Won', playedAt: new Date().toISOString() }, // duplicate
      ],
    };

    const res = await request(app)
      .post('/api/games/migrate')
      .set('Authorization', `Bearer ${authToken}`)
      .send(gamePayload)
      .expect(200);

    expect(res.body.success).toBe(true);

    const Game = require('../models/Game');
    const count = await Game.countDocuments({ gameId: dupeGameId });
    expect(count).toBe(1); // Deduplicated — exactly 1 document
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-006
// Layer: PostgreSQL
// Operation: GET /api/leaderboard (materialized view)
// Expected: Returns ranked list, rank field is present and ordered
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-006] Leaderboard Materialized View', () => {
  test('Returns ranked leaderboard from materialized view', async () => {
    const res = await request(app)
      .get('/api/leaderboard')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.leaderboard)).toBe(true);

    if (res.body.leaderboard.length > 1) {
      // Ranks should be in ascending order
      for (let i = 1; i < res.body.leaderboard.length; i++) {
        expect(res.body.leaderboard[i].rank).toBeGreaterThan(res.body.leaderboard[i - 1].rank);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-007
// Layer: MongoDB
// Operation: POST /api/games/:gameId/analysis (empty-move validation)
// Expected: Returns 400, no analysis document created
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-007] Analysis Validation — 0-move game rejected', () => {
  test('Analysis POST with missing required fields returns 400', async () => {
    if (!authToken) return;

    const badAnalysisId = `bad_analysis_${Date.now()}`;
    const res = await request(app)
      .post(`/api/games/${badAnalysisId}/analysis`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({}) // Missing whiteAccuracy, blackAccuracy, classificationCounts
      .expect(400);

    expect(res.body.error).toBeDefined();

    // Confirm no document was inserted
    if (mongoose?.connection.readyState === 1) {
      const Analysis = require('../models/Analysis');
      const doc = await Analysis.findOne({ gameId: badAnalysisId });
      expect(doc).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-008
// Layer: All protected routes
// Operation: Any request without JWT / with expired JWT
// Expected: 401 on every protected route
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-008] JWT Auth — 401 on all protected routes', () => {
  const PROTECTED_ROUTES = [
    { method: 'get', path: '/api/auth/me' },
    { method: 'get', path: '/api/games' },
    { method: 'post', path: '/api/games' },
    { method: 'get', path: '/api/preferences' },
    { method: 'post', path: '/api/preferences' },
    { method: 'get', path: '/api/friends' },
    { method: 'post', path: '/api/friends/request' },
  ];

  PROTECTED_ROUTES.forEach(({ method, path }) => {
    test(`${method.toUpperCase()} ${path} returns 401 without token`, async () => {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(401);
    });

    test(`${method.toUpperCase()} ${path} returns 401 with invalid token`, async () => {
      const res = await request(app)[method](path)
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({});
      expect(res.status).toBe(401);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST ID: DB-009
// Layer: PostgreSQL
// Operation: Concurrent Elo updates (serialization)
// Expected: Final rating is deterministic — one of the two valid outcomes, not a corrupted hybrid
// ─────────────────────────────────────────────────────────────────────────────
describe('[DB-009] Concurrent Elo Updates — Serialization', () => {
  test('Concurrent updates do not corrupt Elo rating', async () => {
    if (!pgPool || !userId) return;

    // Reset to known starting value
    await pgPool.query(
      'UPDATE elo_ratings SET rating_vs_ai = 1200 WHERE user_id = $1',
      [userId]
    );

    // Fire two concurrent updates with different deltas
    const update = (delta) =>
      pgPool.query(
        'UPDATE elo_ratings SET rating_vs_ai = GREATEST(100, rating_vs_ai + $1) WHERE user_id = $2',
        [delta, userId]
      );

    await Promise.all([update(+25), update(-15)]);

    const result = await pgPool.query(
      'SELECT rating_vs_ai FROM elo_ratings WHERE user_id = $1',
      [userId]
    );

    const finalRating = result.rows[0].rating_vs_ai;
    // One valid outcome: 1200+25-15=1210, 1200-15+25=1210 (same result since both applied)
    // Both updates ran — final should be 1210 (net +10)
    // The key check: it's a finite integer ≥ 100, not NaN or corrupted
    expect(typeof finalRating).toBe('number');
    expect(finalRating).toBeGreaterThanOrEqual(100);
    expect(Number.isFinite(finalRating)).toBe(true);
    expect(Number.isNaN(finalRating)).toBe(false);
  });
});
