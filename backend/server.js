// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const cp = require('child_process');
const path = require('path');
const http = require('http');
const { initializeSqlite } = require('./db/sqlite');
const { initSocket } = require('./ws/socketServer');
const { router: notificationsRoutes } = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Validate critical environment variables ───────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long!');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// ── CORS — allowed origins ──────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179',
  'http://localhost:4173', // Vite preview
  'http://localhost:4174',
  'http://localhost:4175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'http://127.0.0.1:4175',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' })); // cap body size
app.use(cookieParser());

// ── Rate Limiting ────────────────────────────────────────────────────────
// General API limiter — 200 req/min per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Strict login limiter — 10 req/min per IP (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 1 minute and try again.' },
});

app.use('/api/', generalLimiter);

// Path to the Stockfish engine script in node_modules
const STOCKFISH_PATH = path.resolve(__dirname, 'node_modules/stockfish/bin/stockfish.js');

/**
 * Runs Stockfish for a single FEN position to get evaluation and best move.
 * Returns values from White's perspective.
 */
function evaluatePosition(fen, depth = 10) {
  return new Promise((resolve) => {
    // Determine whose turn it is from the FEN
    // FEN structure: [board] [active color] [castling] [en passant] [halfmove] [fullmove]
    const parts = fen.split(' ');
    const activeColor = parts[1] || 'w';

    const engine = cp.spawn('node', [STOCKFISH_PATH]);

    let completed = false;
    let scoreCp = 0.0;
    let scoreMate = null;
    let bestmove = '';
    let continuation = '';

    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        engine.kill();
        resolve({ evaluation: 0.0, mate: null, bestmove: '', continuation: '' });
      }
    }, 12000); // 12 seconds safety timeout

    let stdoutBuffer = '';

    engine.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop(); // Keep last incomplete line

      for (const line of lines) {
        // Parse evaluation info
        if (line.includes('score cp')) {
          const match = line.match(/score cp (-?\d+)/);
          if (match) {
            const rawCp = parseInt(match[1]);
            const multiplier = activeColor === 'b' ? -1 : 1;
            scoreCp = (rawCp / 100) * multiplier;
            scoreMate = null;
          }
        } else if (line.includes('score mate')) {
          const match = line.match(/score mate (-?\d+)/);
          if (match) {
            const rawMate = parseInt(match[1]);
            const multiplier = activeColor === 'b' ? -1 : 1;
            scoreMate = rawMate * multiplier;
            scoreCp = null;
          }
        }

        // Parse continuation line (principal variation)
        if (line.includes(' pv ')) {
          const idx = line.indexOf(' pv ');
          if (idx !== -1) {
            continuation = line.substring(idx + 4).trim();
          }
        }

        // Check if finished
        if (line.startsWith('bestmove')) {
          clearTimeout(timeout);
          completed = true;
          const parts = line.split(' ');
          bestmove = parts[1] || '';
          engine.kill();
          resolve({
            evaluation: scoreCp,
            mate: scoreMate,
            bestmove,
            continuation
          });
        }
      }
    });

    engine.stderr.on('data', (data) => {
      console.error('Stockfish engine error:', data.toString());
    });

    // Send UCI commands to evaluate
    engine.stdin.write('uci\n');
    engine.stdin.write(`position fen ${fen}\n`);
    engine.stdin.write(`go depth ${depth}\n`);
  });
}

/**
 * Evaluates a batch of FEN positions with concurrency control.
 */
async function evaluateBatch(fens, depth = 10, concurrency = 4) {
  const results = new Array(fens.length);
  let index = 0;

  async function worker() {
    while (index < fens.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await evaluatePosition(fens[currentIndex], depth);
      } catch (err) {
        console.error(`Error evaluating FEN at index ${currentIndex}:`, err);
        results[currentIndex] = { evaluation: 0.0, mate: null, bestmove: '', continuation: '' };
      }
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  return results;
}

// ── Database & Authentication Routers ───────────────────────────────────
app.use('/api/auth/login', loginLimiter); // Apply strict limiter to login endpoint
const authRouter = require('./routes/auth');
const friendsRouter = require('./routes/friends');
const leaderboardRouter = require('./routes/leaderboard');
const matchRequestsRouter = require('./routes/matchRequests');

app.use('/api/auth', authRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/positions', require('./routes/positions'));
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/match-requests', matchRequestsRouter);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/puzzles', require('./routes/puzzles'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/games', require('./routes/games'));
app.use('/api/preferences', require('./routes/preferences'));

// ── Express API Endpoints ────────────────────────────────────────────────

// Check server status
app.get('/api/status', (req, res) => {
  let copied = false;
  let errorMsg = null;
  try {
    const fs = require('fs');
    const sourceDir = path.resolve(__dirname, '../frontend/public/assets/sound');
    const targetDir = path.resolve(__dirname, '../frontend/public/sounds');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const mapping = {
      'move.mp3': 'move.mp3',
      'capture.mp3': 'capture.mp3',
      'castling.mp3': 'castle.mp3',
      'check.mp3': 'check.mp3',
      'checkmate.mp3': 'checkmate.mp3',
      'promote.mp3': 'promote.mp3',
      'castling.mp3': 'game-start.mp3',
      'checkmate.mp3': 'game-end.mp3',
      'checkmate.mp3': 'win.mp3',
      'incorrect-move.mp3': 'lose.mp3',
      'castling.mp3': 'draw.mp3',
      'move.mp3': 'notification.mp3',
      'move.mp3': 'premove.mp3',
      'incorrect-move.mp3': 'illegal.mp3',
      'check.mp3': 'low-time.mp3',
      'promote.mp3': 'puzzle-correct.mp3',
      'incorrect-move.mp3': 'puzzle-incorrect.mp3',
      'castling.mp3': 'puzzle-complete.mp3',
    };
    for (const [srcName, destName] of Object.entries(mapping)) {
      const srcPath = path.join(sourceDir, srcName);
      const destPath = path.join(targetDir, destName);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    copied = true;
  } catch (err) {
    errorMsg = err.message;
  }
  res.json({ status: 'ok', engine: 'Stockfish 18', env: process.env.NODE_ENV, copied, errorMsg });
});

// GET /api/bestmove?fen=...&depth=...
app.get('/api/bestmove', async (req, res) => {
  const fen = req.query.fen;
  const depth = parseInt(req.query.depth) || 10;

  if (!fen) {
    return res.status(400).json({ error: 'Missing fen parameter' });
  }

  try {
    const result = await evaluatePosition(fen, depth);
    res.json({
      success: true,
      bestmove: result.bestmove,
      evaluation: result.evaluation,
      mate: result.mate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/evaluate?fen=...&depth=...
app.get('/api/evaluate', async (req, res) => {
  const fen = req.query.fen;
  const depth = parseInt(req.query.depth) || 5;

  if (!fen) {
    return res.status(400).json({ error: 'Missing fen parameter' });
  }

  try {
    const result = await evaluatePosition(fen, depth);
    res.json({
      success: true,
      evaluation: result.evaluation,
      mate: result.mate,
      bestmove: result.bestmove,
      continuation: result.continuation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/evaluate-batch
// Body: { fens: string[], depth: number }
app.post('/api/evaluate-batch', async (req, res) => {
  const { fens, depth } = req.body;
  const targetDepth = depth || 10;

  if (!fens || !Array.isArray(fens)) {
    return res.status(400).json({ error: 'Missing or invalid fens parameter' });
  }

  try {
    const evaluations = await evaluateBatch(fens, targetDepth, 4);
    res.json({
      success: true,
      evaluations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Global error handler ─────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  await initializeSqlite();

  // Copy sounds to public/sounds directory if it doesn't exist or is incomplete
  try {
    const fs = require('fs');
    const sourceDir = path.resolve(__dirname, '../frontend/public/assets/sound');
    const targetDir = path.resolve(__dirname, '../frontend/public/sounds');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const mapping = {
      'move.mp3': 'move.mp3',
      'capture.mp3': 'capture.mp3',
      'castling.mp3': 'castle.mp3',
      'check.mp3': 'check.mp3',
      'checkmate.mp3': 'checkmate.mp3',
      'promote.mp3': 'promote.mp3',
      'castling.mp3': 'game-start.mp3',
      'checkmate.mp3': 'game-end.mp3',
      'checkmate.mp3': 'win.mp3',
      'incorrect-move.mp3': 'lose.mp3',
      'castling.mp3': 'draw.mp3',
      'move.mp3': 'notification.mp3',
      'move.mp3': 'premove.mp3',
      'incorrect-move.mp3': 'illegal.mp3',
      'check.mp3': 'low-time.mp3',
      'promote.mp3': 'puzzle-correct.mp3',
      'incorrect-move.mp3': 'puzzle-incorrect.mp3',
      'castling.mp3': 'puzzle-complete.mp3',
    };
    for (const [srcName, destName] of Object.entries(mapping)) {
      const srcPath = path.join(sourceDir, srcName);
      const destPath = path.join(targetDir, destName);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    console.log("✅ Chess sound assets successfully copied/mapped to frontend/public/sounds/");
  } catch (err) {
    console.error("❌ Failed to copy sound assets:", err);
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`✅ KingsGauntlet backend listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`   CORS allowed origin: ${allowedOrigins.join(', ')}`);
  });
}

startServer();
