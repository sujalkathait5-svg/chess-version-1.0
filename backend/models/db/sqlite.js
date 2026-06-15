// backend/db/sqlite.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const crypto = require('crypto');

let dbInstance;

async function initializeSqlite() {
  console.log('Initializing SQLite database...');
  dbInstance = await open({
    filename: './database2.sqlite',
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await dbInstance.run('PRAGMA foreign_keys = ON');

  try {
    // 1. Users Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT DEFAULT 'default_avatar.svg',
        is_active INTEGER DEFAULT 1 NOT NULL,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Indexes for users
    await dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);

    // 2. Elo Ratings Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS elo_ratings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        rating_vs_human INTEGER DEFAULT 1500 NOT NULL,
        rating_vs_ai INTEGER DEFAULT 1500 NOT NULL,
        peak_rating_vs_human INTEGER DEFAULT 1500 NOT NULL,
        peak_rating_vs_ai INTEGER DEFAULT 1500 NOT NULL,
        puzzle_rating INTEGER DEFAULT 1500 NOT NULL,
        games_played_human INTEGER DEFAULT 0 NOT NULL,
        games_played_ai INTEGER DEFAULT 0 NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    try {
      await dbInstance.exec(`ALTER TABLE elo_ratings ADD COLUMN puzzle_rating INTEGER DEFAULT 1500 NOT NULL;`);
    } catch (e) {}

    // 3. Games Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        white_id TEXT,
        black_id TEXT,
        mode TEXT,
        time_control TEXT,
        result TEXT,
        termination TEXT,
        opening TEXT,
        moves TEXT,
        pgn TEXT,
        total_moves INTEGER,
        duration INTEGER,
        elo_change_white INTEGER,
        elo_change_black INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 3.5 Analysis Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS game_analysis (
        game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
        white_accuracy NUMERIC(5,2),
        black_accuracy NUMERIC(5,2),
        classification_counts TEXT,
        move_analysis TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Friendships Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS friendships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (user_id, friend_id)
      );
    `);

    // 5. Notifications Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link_url TEXT,
        is_read INTEGER DEFAULT 0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Ensure link_url column exists
    try {
      await dbInstance.exec(`ALTER TABLE notifications ADD COLUMN link_url TEXT;`);
    } catch (e) {
      // Column already exists or table does not exist yet
    }

    // 6. Tournaments Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK (type IN ('arena', 'swiss')),
        status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
        time_control TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await dbInstance.exec(`ALTER TABLE tournaments ADD COLUMN duration INTEGER DEFAULT 60;`);
      await dbInstance.exec(`ALTER TABLE tournaments ADD COLUMN is_public INTEGER DEFAULT 1;`);
      await dbInstance.exec(`ALTER TABLE tournaments ADD COLUMN password TEXT;`);
      await dbInstance.exec(`ALTER TABLE tournaments ADD COLUMN max_players INTEGER;`);
    } catch (e) {
      // Columns likely already exist
    }

    // 7. Tournament Participants Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS tournament_participants (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER DEFAULT 0 NOT NULL,
        tiebreak INTEGER DEFAULT 0 NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tournament_id, user_id)
      );
    `);

    // 8. Tournament Games Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS tournament_games (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        round INTEGER,
        white_id TEXT NOT NULL REFERENCES users(id),
        black_id TEXT NOT NULL REFERENCES users(id),
        result TEXT CHECK (result IN ('white_win', 'black_win', 'draw', 'ongoing')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Puzzles Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS puzzles (
        id TEXT PRIMARY KEY,
        fen TEXT NOT NULL,
        moves TEXT NOT NULL,
        rating INTEGER DEFAULT 1500,
        themes TEXT DEFAULT '[]'
      );
    `);

    // 10. User Puzzles Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS user_puzzles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        puzzle_id TEXT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
        solved INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER DEFAULT 1,
        time_taken INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, puzzle_id)
      );
    `);

    // 10.5 Match Requests Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS match_requests (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        time_control TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
        qr_token TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 11. User Stats Summary Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS user_stats_summary (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        total_games INTEGER DEFAULT 0 NOT NULL,
        wins INTEGER DEFAULT 0 NOT NULL,
        losses INTEGER DEFAULT 0 NOT NULL,
        draws INTEGER DEFAULT 0 NOT NULL,
        avg_accuracy NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
        total_blunders INTEGER DEFAULT 0 NOT NULL,
        best_win_streak INTEGER DEFAULT 0 NOT NULL,
        current_win_streak INTEGER DEFAULT 0 NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 12. User Preferences Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        board_theme TEXT DEFAULT 'blue',
        piece_style TEXT DEFAULT 'neo',
        sound_enabled INTEGER DEFAULT 1,
        move_hints INTEGER DEFAULT 1,
        auto_flip INTEGER DEFAULT 0
      );
    `);

    // 13. Create Leaderboard View (SQLite dynamic view)
    await dbInstance.exec(`
      CREATE VIEW IF NOT EXISTS m_leaderboard AS
      SELECT
        ROW_NUMBER() OVER (ORDER BY r.rating_vs_human DESC) AS rank,
        u.id         AS user_id,
        u.username,
        u.avatar_url,
        r.rating_vs_human  AS rating,
        r.peak_rating_vs_human AS peak_rating,
        s.total_games,
        CASE
          WHEN s.total_games = 0 THEN 0.00
          ELSE ROUND((CAST(s.wins AS NUMERIC) / CAST(s.total_games AS NUMERIC)) * 100, 2)
        END AS win_rate
      FROM users u
      JOIN elo_ratings r       ON u.id = r.user_id
      JOIN user_stats_summary s ON u.id = s.user_id
      WHERE u.is_active = 1;
    `);

    // 14. Saved Positions Table
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS saved_positions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        fen TEXT NOT NULL,
        folders TEXT DEFAULT '[]',
        times_played INTEGER DEFAULT 0,
        analysis_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Seed 24 unique, diverse tactical puzzles (upserted on every startup) ──
    // Covers: mateIn1, mateIn2, fork, pin, skewer, discovered attack,     const uniquePuzzles = [
      // ── MATE IN 1 ──────────────────────────────────────────────────────────
      // 1. Back-rank smothered mate: Rf1→f8, Black King trapped on h8 by f7+g7+h7 pawns
      { id:'u01', fen:'7k/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1',         moves:'["f1f8"]',               rating:600,  themes:'["mateIn1","backRankMate","mate"]' },
      // 2. Promotion checkmate: Black pawn g2→g1=Q, mates White King on h1
      { id:'u02', fen:'8/8/8/8/8/8/5kp1/7K b - - 0 1',           moves:'["g2g1q"]',              rating:620,  themes:'["mateIn1","promotion","mate"]' },
      // 3. Pawn checkmate: White g-pawn mates Black King on h8 (Kf6 covers g7 escape)
      { id:'u03', fen:'6bk/7p/5KP1/8/8/8/8/8 w - - 0 1',              moves:'["g6g7"]',               rating:650,  themes:'["mateIn1","pawnMate","mate"]' },
      // 4. Smothered knight mate: Nh6→f7, King on h8 smothered by Rg8 + pawns g7/h7
      { id:'u04', fen:'6rk/6pp/7N/8/8/8/8/7K w - - 0 1',            moves:'["h6f7"]',               rating:700,  themes:'["mateIn1","smotheredMate","mate"]' },
      // 5. Queen + Knight mate: Qh5→h7, Nf6 covers g8; King on h8 mated
      { id:'u05', fen:'7k/8/5N2/7Q/8/8/8/7K w - - 0 1',            moves:'["h5h7"]',               rating:680,  themes:'["mateIn1","mate"]' },
      // 6. Rook sweeps back rank: Ra8→a1, White King on h1 mated (all escapes covered)
      { id:'u06', fen:'r5k1/8/8/8/8/8/5PPP/7K b - - 0 1',             moves:'["a8a1"]',               rating:600,  themes:'["mateIn1","backRankMate","mate"]' },
      // ── MATE IN 2 ─────────────────────────────────────────────────────────
      // 7. Smothered queen sacrifice: 1.Qg8+! Rxg8 2.Nf7# (arabian/smothered hybrid)
      { id:'u07', fen:'5r1k/4N1pp/6Q1/8/8/8/8/7K w - - 0 1',            moves:'["g6g8","f8g8","e7f7"]', rating:900,  themes:'["mateIn2","smotheredMate","mate"]' },
      // 8. Anastasia mate: 1.Qxh7+! Kxh7 2.Rh1#
      { id:'u08', fen:'7k/4N1pp/8/7Q/8/8/8/3R2K1 w - - 0 1',        moves:'["h5h7","h8h7","d1h1"]', rating:1000, themes:'["mateIn2","queenSacrifice","mate"]' },
      // 9. Anastasia mate (Black): 1...Qxf1+ 2.Bxf1 Nf2# (Nf2 attacks h1)
      { id:'u09', fen:'6k1/8/8/8/3q4/4n1PP/8/5RBK b - - 0 1', moves:'["d3f1","g1f1","e4f2"]', rating:1050, themes:'["mateIn2","queenSacrifice","mate"]' },
      // 10. Two-rook ladder: 1.Rb8+ Rxb8 2.Rxb8#
      { id:'u10', fen:'5r1k/R5pp/8/8/8/8/8/1R5K w - - 0 1',          moves:'["b1b8","f8b8","a7b8"]', rating:900,  themes:'["mateIn2","doubleRooks","mate"]' },
      // 11. Smothered queen sacrifice: 1.Qxg8+! Rxg8 2.Nf7# (Arabian/smothered hybrid)
      { id:'u11', fen:'5rrk/6pp/7N/8/8/8/8/6QK w - - 0 1',          moves:'["g1g8","f8g8","h6f7"]', rating:1100, themes:'["mateIn2","smotheredMate","queenSacrifice","mate"]' },
      // ── FORK ──────────────────────────────────────────────────────────────
      // 12. Knight fork (Black): Nd4→c2+ attacks King on e1 AND Rook on a1
      { id:'u12', fen:'3rk3/8/8/8/3n4/8/8/R3K3 b - - 0 1',         moves:'["d4c2"]',               rating:950,  themes:'["fork","knightFork"]' },
      // 13. Knight fork (White): Ng5→f7 attacks Queen on d8 AND Rook on h8
      { id:'u13', fen:'r1bqkb1r/pppppppp/2n2n2/4p1N1/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 4 5', moves:'["g5f7"]', rating:1000, themes:'["fork","knightFork","sacrifice"]' },
      // 14. Queen fork (White): Qd5+ attacks King on f7 AND Rook on a8 simultaneously
      { id:'u14', fen:'r7/5k2/8/8/8/8/8/3Q3K w - - 0 1',          moves:'["d1d5"]',               rating:850,  themes:'["fork","queenFork"]' },
      // 15. Pawn fork (White): d2→d4 attacks both c5 bishop and e5 pawn diagonally
      { id:'u15', fen:'r1bqkb1r/ppp2ppp/2n2n2/2bpp3/8/2N2N2/PPPPPPPP/R1BQKB1R w KQkq - 0 5', moves:'["d2d4"]', rating:800, themes:'["fork","pawnFork"]' },
      // ── PIN ───────────────────────────────────────────────────────────────
      // 16. Absolute pin (White): Bc4→b5 pins Nc6 to Black King on e8 (diagonal b5-c6-d7-e8)
      { id:'u16', fen:'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq e6 0 4', moves:'["c4b5"]', rating:900, themes:'["pin","absolutePin"]' },
      // 17. Relative pin capture (White): Bg5 pins Nf6 to Queen d8; 1.Bxf6 wins knight
      { id:'u17', fen:'r1bqkb1r/pppp1ppp/2n2n2/4p1G1/2B1P3/2N2N2/PPPP1PPP/R2QK2R w KQkq - 4 5', moves:'["g5f6"]', rating:1050, themes:'["pin","relativePin","capture"]' },
      // 18. Break the pin (Black): 1...a6 attacks Bb5 pinning Nc6, forces bishop retreat
      { id:'u18', fen:'r1bqk2r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 4', moves:'["a7a6"]', rating:850, themes:'["pin","tempo","breakPin"]' },
      // ── SKEWER ────────────────────────────────────────────────────────────
      // 19. Bishop skewer (White): Ba1→e5+ checks King on g7, then captures Rook on h8
      { id:'u19', fen:'7r/6k1/8/8/8/8/8/B3K3 w - - 0 1',             moves:'["a1e5","g7g8","e5h8"]', rating:1050, themes:'["skewer"]' },
      // 20. Rook skewer (White): Ra1→a7+ hits King on c7; King moves → Ra7xh7 wins Black Rook
      { id:'u20', fen:'8/2k4r/8/8/8/8/8/R5K1 w - - 0 1',           moves:'["a1a7","c7c6","a7h7"]', rating:1000, themes:'["skewer"]' },
      // ── DISCOVERED ATTACK ─────────────────────────────────────────────────
      // 21. Discovered attack (White): Be4xh7+ captures pawn, reveals Re1 attacking Qe7
      { id:'u21', fen:'6k1/4qppp/8/8/4B3/8/5PPP/4R1K1 w - - 0 1',     moves:'["e4h7","g8h8","e1e7"]', rating:1100, themes:'["discoveredAttack"]' },
      // 22. Discovered attack (Black): Be5xh2+ captures pawn, reveals Re8 attacking Qe2
      { id:'u22', fen:'4r1k1/5ppp/8/4b3/8/8/4QPPP/6K1 b - - 0 1',     moves:'["e5h2","g1f1","e8e2"]', rating:1150, themes:'["discoveredAttack"]' },
      // ── ENDGAME ───────────────────────────────────────────────────────────
      // 23. King + Pawn endgame: opposition play to escort pawn to promotion
      { id:'u23', fen:'8/8/3k4/3P4/4K3/8/8/8 w - - 0 1',             moves:'["e4d4","d6d7","d4e5","d7e7","d5d6"]', rating:1250, themes:'["endgame","kpk","opposition"]' },
      // 24. Rook endgame: Mate in 2 ladder checkmate
      { id:'u24', fen:'6k1/5ppp/r7/8/8/8/8/1R4K1 w - - 0 1',             moves:'["b1b8","a6a8","b8a8"]', rating:1350, themes:'["endgame","rookEndgame","mateIn2","mate"]' },
    ];

    // Delete old repetitive generated_puzzle_ entries from the CSV import
    await dbInstance.run(`DELETE FROM puzzles WHERE id LIKE 'generated_puzzle_%'`);

    // Upsert all 24 unique puzzles
    for (const p of uniquePuzzles) {
      await dbInstance.run(
        `INSERT INTO puzzles (id, fen, moves, rating, themes)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fen=excluded.fen, moves=excluded.moves, rating=excluded.rating, themes=excluded.themes`,
        [p.id, p.fen, p.moves, p.rating, p.themes]
      );
    }
    console.log(`✅ 24 unique tactical puzzles seeded (mateIn1/2, fork, pin, skewer, discoveredAttack, endgame).`);

    console.log('SQLite database schema successfully initialized.');
  } catch (err) {
    console.error('SQLite database initialization failed:', err.message);
  }
}

// Helper to convert array params to $1, $2 object for SQLite
function convertQuery(sql, params) {
  let sqliteSql = sql;
  
  // SQLite doesn't have NOW() or gen_random_uuid(), we can try to string replace some common postgres functions
  sqliteSql = sqliteSql.replace(/NOW\(\)/g, "CURRENT_TIMESTAMP");
  sqliteSql = sqliteSql.replace(/INTERVAL '10 minutes'/gi, "'+10 minutes'");
  sqliteSql = sqliteSql.replace(/INTERVAL '1 hour'/gi, "'+1 hour'");
  // GREATEST is MAX in SQLite
  sqliteSql = sqliteSql.replace(/GREATEST\(/gi, "MAX(");
  // ILIKE is LIKE in SQLite (which is case-insensitive by default)
  sqliteSql = sqliteSql.replace(/\bILIKE\b/gi, "LIKE");
  // ANY($2) is not supported in SQLite, we have to handle it if we see it, but for now we'll just let it fail or fix manually.

  let sqliteParams = {};
  if (params && Array.isArray(params)) {
    params.forEach((val, index) => {
      sqliteParams[`$${index + 1}`] = val;
    });
  } else if (params) {
    sqliteParams = params;
  }
  return { sqliteSql, sqliteParams };
}

// Wrapper to mimic pg client.query returning { rows: [...] }
const getPgClient = () => {
  const client = {
    query: async (sql, params) => {
      const { sqliteSql, sqliteParams } = convertQuery(sql, params);
      
      let isInsert = sqliteSql.trim().toUpperCase().startsWith('INSERT INTO');
      let finalSql = sqliteSql;
      let finalParams = sqliteParams;

      try {
        const hasReturning = sqliteSql.toUpperCase().includes('RETURNING');
        if (hasReturning) {
          const rows = await dbInstance.all(finalSql, finalParams);
          return { rows, rowCount: rows.length };
        } else if (isInsert || finalSql.trim().toUpperCase().startsWith('UPDATE') || finalSql.trim().toUpperCase().startsWith('DELETE')) {
           const result = await dbInstance.run(finalSql, finalParams);
           return { rows: [], rowCount: result.changes, insertId: result.lastID };
        } else {
          const rows = await dbInstance.all(finalSql, finalParams);
          return { rows };
        }
      } catch (e) {
        console.error("SQL Error:", finalSql, finalParams, e);
        throw e;
      }
    },
    release: () => {},
    connect: async () => {
      return client;
    }
  };
  return client;
};

const getDb = () => dbInstance;

module.exports = {
  initializeSqlite,
  getPgClient,
  getDb
};
