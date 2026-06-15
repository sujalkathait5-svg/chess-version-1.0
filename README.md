# ♟ KingsGauntlet Chess Arena

> A full-stack, production-grade chess learning platform with Stockfish 18 AI, real-time online multiplayer, tactics puzzles, post-game analysis, Elo ratings, and a glassmorphic dark UI — built to make chess **fun to learn**.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
  - [Dashboard](#dashboard)
  - [Play vs Friend (Pass-and-Play)](#play-vs-friend-pass-and-play)
  - [Play vs Stockfish AI](#play-vs-stockfish-ai)
  - [Online Multiplayer](#online-multiplayer)
  - [Post-Game Analysis](#post-game-analysis)
  - [Analysis Board](#analysis-board)
  - [Tactics Puzzles](#tactics-puzzles)
  - [Tournaments](#tournaments)
  - [Player Profile](#player-profile)
  - [Authentication & Cloud Sync](#authentication--cloud-sync)
  - [Customization & Settings](#customization--settings)
- [Move Classification System](#move-classification-system)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Build & Deploy](#build--deploy)

---

## Overview

**KingsGauntlet Chess Arena** is a full-stack chess learning platform built with **React 19 + TypeScript** on the frontend and **Node.js + Express + SQLite** on the backend. Every feature is designed around helping players improve, from Stockfish-powered post-game reviews to tactical puzzles and live engine hints.

It supports every mode of chess play: offline against a friend or Stockfish AI, live online matchmaking via WebSockets, and competitive tournaments. Deep post-game analysis is powered by Stockfish 18 running as a WASM WebWorker in the browser, with a local backend REST API fallback.

Signed-in users get cloud sync of their game history, Elo ratings, profile, and preferences. Guests can still play locally with everything persisted to `localStorage`.

---

## Architecture

The app is split into four core layers:

### 1. Custom Chess Engine (`frontend/src/chess-logic/`)
A pure TypeScript engine, independent of any UI framework. Handles:
- **Board state** — 8×8 typed 2D array of piece objects
- **Legal move generation** — per-piece classes (`pawn.ts`, `knight.ts`, etc.) compute valid moves including en passant, castling, and promotion
- **Rule validation** — check, checkmate, stalemate, 50-move rule, insufficient material, threefold repetition
- **FEN serialization** — `FENConverter.ts` translates board state to standard FEN strings for Stockfish

### 2. Stockfish Integration (`frontend/src/services/stockfish.ts`)
- Runs Stockfish 18 as a **WASM WebWorker** — never blocks the UI thread
- Serialized mutex queue ensures only one request is active at a time
- 10-second hard timeout auto-falls-back to backend REST API (`/api/evaluate`, `/api/bestmove`)
- Post-game analysis runs Stockfish on every position concurrently (2 parallel workers)

### 3. React UI Layer (`frontend/src/`)
- `App.tsx` — root router; `contexts/` — React Context providers for Auth, Game state, Theme, and Sound
- `pages/` — full-page views (Dashboard, Play, Online, Analysis, Puzzles, Tournaments, Profile)
- `components/` — reusable UI pieces (ChessBoard, Timer, EvalBar, GameReview, etc.)

### 4. Node.js Backend (`backend/`)
- **Express** API server with JWT auth, bcrypt password hashing, and rate limiting
- **SQLite** database (via the standard `sqlite` and `sqlite3` packages) with automatic programmatic table initialization on server startup
- **Socket.IO** WebSocket server for real-time online games, matchmaking, and tournament management
- **Stockfish 18** runs as a child process on the server for `/api/bestmove` and `/api/evaluate` fallback endpoints

---

## Features

### Dashboard

The main learning hub. All stats are live-computed from your real game history — no placeholders.

| Feature | Description |
|---|---|
| **Stats Cards** | Live wins, losses, draws, average accuracy, total blunders, games played |
| **Rating Sparkline** | Animated SVG chart of your Elo rating history across all completed games |
| **Peak Rating Badge** | Tracks your all-time highest Elo |
| **Quick Match** | Pick a time control from a dropdown and jump into a game immediately |
| **Recent Games Panel** | Last 5 games with opponent, opening name, result, and accuracy |
| **Star Favourites** | Star any game to mark as favourite — persisted to `localStorage` |
| **Accuracy Chart** | Bézier-curve SVG chart of accuracy across up to 20 reviewed games, with hover tooltips |
| **Most Played Openings** | Donut chart of your top 4 openings by frequency |
| **Result Distribution** | Win/Loss/Draw breakdown as live percentage bars |
| **AI Insights Panel** | Dynamic coaching tips based on your real stats |
| **Search & Filter** | Filter game history by opponent name, result, or time control |
| **Leaderboard Tab** | Global player ranking with Elo ratings and win-rates |
| **Social Tab** | Friends list, friend requests, and player search |

---

### Play vs Friend (Pass-and-Play)

Local multiplayer on one device — no internet needed.

**Setup:** choose a time control (Bullet / Blitz / Rapid / Casual untimed) before the game.

| Feature | Description |
|---|---|
| **Click-to-Move** | Click a piece to select, click a destination to move |
| **Legal Move Hints** | Green dots on reachable squares; capture rings on enemy pieces (toggleable) |
| **Check Highlight** | The King's square pulses red when in check |
| **Chess Clock** | Live countdown with increment support |
| **Auto-Flip Board** | Board rotates after each move so each player faces their own side |
| **Opening Detection** | Live badge showing the current opening name from a 130+ ECO database |
| **Evaluation Bar** | Real-time Stockfish centipawn score or "Mate in N" after every move |
| **Captured Pieces & Material** | Captured pieces displayed with material advantage score |
| **Pawn Promotion Dialog** | Styled overlay with all four promotion choices |
| **Move History** | Scrollable algebraic notation panel; click any move to jump to that position |
| **Undo / Redo** | Step backward and forward through the game history |
| **Sound Effects** | Audio for moves, captures, castling, check, promotion, and checkmate (iOS + Android compatible) |
| **Resign / Offer Draw / Abort** | Standard game controls for both players |
| **PGN Export** | Copy or download the full game in PGN format |

**After the game:** result modal shows result, duration, and updated Elo ratings. Click "Run Game Review" to launch full engine analysis.

---

### Play vs Stockfish AI

**Setup:** configure difficulty (1–6), time control, and your color before starting.

| Level | Label | Depth | Think Time | Approx. ELO | Behavior |
|---|---|---|---|---|---|
| 1 | Beginner | 3 | 500ms | ~800 | Misses basic tactics |
| 2 | Easy | 5 | 1s | ~1200 | Plays reasonable moves |
| 3 | Medium | 7 | 2s | ~1600 | Solid club-player level |
| 4 | Hard | 9 | 3s | ~2000 | Punishes mistakes |
| 5 | Expert | 11 | 4s | ~2400 | Near-maximum strength |
| 6 | Maximum | 20 | 5s | ~3200 | Extremely difficult |

**During the game:**
- Stockfish runs in a background WebWorker — UI never freezes
- A thinking indicator shows when the engine is calculating
- **Show Hint** highlights the engine's top recommended move on the board
- **Undo** takes back both your move and the AI's response
- All other controls (eval bar, opening badge, flip board, sound) work identically to Friend mode

Post-game Elo updates are calculated against a Stockfish strength rating of `800 + (level × 400)` for levels 1–5, and fixed `3200` for level 6.

---

### Online Multiplayer

Real-time online chess via WebSockets. Requires a user account.

| Feature | Description |
|---|---|
| **Matchmaking** | Queue for Bullet (1+0), Blitz (3+2), Rapid (10+0), or Classical (30+0) |
| **Live Games** | Moves sync instantly via Socket.IO; server validates all moves |
| **Premoves** | Queue a move while the opponent is thinking — it executes instantly on their turn |
| **Evaluation Bar** | Real-time Stockfish eval runs in the browser during online games |
| **Resign / Offer Draw** | Standard game controls during online matches |
| **Abort** | Abort is available if fewer than 2 moves have been played |
| **Tournament Pairing** | Online games can be launched directly from a tournament lobby |

---

### Post-Game Analysis

Full Stockfish engine review of every position in a completed game — the core learning tool of KingsGauntlet.

| Feature | Description |
|---|---|
| **Analysis Progress Bar** | Live progress as Stockfish evaluates each position (2 parallel workers) |
| **Accuracy Scores** | Percentage accuracy for both players, computed from mean centipawn loss |
| **Estimated Rating** | Rating estimate based on each player's accuracy score |
| **Evaluation Chart** | Interactive SVG polyline — hover any point to see eval at that move; click to jump |
| **Move-by-Move Walkthrough** | Step through each move with classification badge, engine commentary, eval before/after, best move suggestion, and continuation line |
| **Classification Breakdown** | Side-by-side count of each move category for White vs Black |
| **Incremental Updates** | Stats update in real-time as analysis progresses — no waiting for 100% completion |

---

### Analysis Board

A standalone FEN/PGN editor and engine analysis tool.

| Feature | Description |
|---|---|
| **Board Editor Mode** | Drag pieces from a palette onto any square; eraser removes pieces |
| **Position Settings** | Set side to move, castling rights, and en passant square |
| **FEN Import/Export** | Paste a FEN to load any position; copy current FEN to clipboard |
| **PGN Import/Export** | Paste a full PGN to load a game; copy or download as `.pgn` file |
| **Move History Navigation** | Step through imported game history with arrow buttons |
| **Engine Analysis** | Toggle Stockfish evaluation on/off; adjust search depth (5–20) |
| **Best Move Display** | Shows Stockfish's top recommended move for the current position |
| **Saved Positions** | Save named positions to `localStorage`; load or delete them anytime |
| **Flip Board** | Mirror the board orientation |

---

### Tactics Puzzles

Practice chess tactics using puzzles served from the backend database — the fastest way to improve pattern recognition.

| Feature | Description |
|---|---|
| **Random Puzzle** | Fetch a random puzzle from the backend at any time |
| **Interactive Board** | Click-to-move puzzle solving with move validation |
| **Opponent Auto-Play** | After each correct move, the opponent responds automatically (500ms delay) |
| **Puzzle Rating** | Displays the puzzle's rating difficulty |
| **Themes** | Shows tactical themes (fork, pin, skewer, etc.) for each puzzle |
| **Success/Failure Overlays** | Clear visual feedback for correct and incorrect solutions |
| **Attempt Tracking** | Logged to the backend for signed-in users (affects profile puzzle stats) |

---

### Tournaments

Compete in scheduled online tournaments.

| Feature | Description |
|---|---|
| **Browse Tournaments** | View active, upcoming, and completed tournaments |
| **Live / Upcoming / Completed** | Tournaments categorized by status with live indicators |
| **Arena & Swiss Formats** | Supports both arena and Swiss-style tournament types |
| **Join / Register** | One-click join for active tournaments; registration for upcoming |
| **Tournament Lobby** | Dedicated lobby page per tournament showing pairings and brackets |
| **Tournament Match Launch** | Matched players are redirected automatically to an online game room |
| **Participant Count** | Displays the number of registered players per tournament |

---

### Player Profile

A dedicated profile page for signed-in users.

| Feature | Description |
|---|---|
| **Avatar & Username** | Profile header with avatar and username |
| **Matchmaking Rating** | Displays global Elo rating from server |
| **Win/Loss/Draw Bar** | Visual breakdown of game results |
| **Tactics Stats** | Total puzzles attempted, total solved, and success rate percentage |
| **Recent Games Table** | Last 10 online games with White/Black players, result, and date |

---

### Authentication & Cloud Sync

| Feature | Description |
|---|---|
| **Register / Login** | Username + email + password registration; email or username login |
| **JWT Sessions** | Secure JSON Web Token sessions with 7-day expiry |
| **Password Hashing** | Passwords hashed with bcrypt (12 rounds in production) |
| **Cloud Preferences** | Board theme, piece style, sound, move hints, auto-flip synced to backend |
| **Game Migration** | On first login, local `localStorage` games are automatically migrated to the cloud |
| **Notifications** | In-app notification center for friend requests and match events |

---

### Customization & Settings

Accessible via the settings panel during gameplay. All settings persist to `localStorage` and sync to the cloud when logged in.

**Board Themes:** Classic Wood · Forest Green · Ocean Blue · Charcoal Dark · Cyber Blue

**Piece Styles:** Neo · Classic (cburnett) · Merida · Alpha · Cyber Glow

**Gameplay Toggles:** Sound effects · Legal move hints · Auto-flip board · Dark/Light app theme

**Profile:** Set display name (up to 15 characters) · Upload a custom profile avatar

---

## Move Classification System

Each move in the post-game review is classified by the centipawn loss between the played move and Stockfish's top choice.

| Badge | Classification | Centipawn Loss | Meaning |
|---|---|---|---|
| 👑 | **Brilliant** | ≤ 10 + sacrifice | A material sacrifice that secures a winning advantage |
| ⭐ | **Great** | ≤ 10 (from losing) | The only good defensive resource in a difficult position |
| 🟢 | **Best** | ≤ 10 | Exactly matches the engine's top recommendation |
| ✅ | **Excellent** | 11–25 | Very strong — near-zero centipawn loss |
| 🟩 | **Good** | 26–55 | Solid play that maintains the evaluation |
| 📖 | **Book** | — | A recognized opening theory move |
| 🟡 | **Inaccuracy** | 56–100 | Slightly drops the player's advantage |
| 🟠 | **Mistake** | 101–200 | Gives away a tangible positional or material edge |
| 🔴 | **Miss** | >100 (opp. blundered) | Missed opportunity to exploit the opponent's error |
| 🔴 | **Blunder** | > 200 | A critical error — hanging piece or missed decisive threat |

---

## Technology Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| [React](https://react.dev/) | 19 | UI framework — hooks and context-based state management |
| [TypeScript](https://www.typescriptlang.org/) | ~6.0 | Full static typing across the entire codebase |
| [Vite](https://vite.dev/) | 8 | Dev server with HMR and optimized production builds |
| [React Router](https://reactrouter.com/) | 7 | Client-side routing and navigation |
| [chess.js](https://github.com/jhlywa/chess.js) | ^1.4 | Chess rule validation, FEN/PGN utilities |
| [Stockfish](https://stockfishchess.org/) | 18 | Chess engine — WASM WebWorker in browser |
| [Socket.IO Client](https://socket.io/) | ^4.8 | Real-time WebSocket communication for online play |
| [chess-openings](https://github.com/lichess-org/chess-openings) | ^0.1 | ECO opening database for live opening detection |
| [Lucide React](https://lucide.dev/) | ^1.16 | SVG icon library |
| [Recharts](https://recharts.org/) | ^3.8 | Evaluation graph charting (with custom SVG charts) |
| Vanilla CSS | — | Design system: CSS variables, glassmorphism, animations |

### Backend

| Technology | Version | Role |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ | JavaScript runtime |
| [Express](https://expressjs.com/) | ^4.21 | HTTP server and REST API routing |
| [Socket.IO](https://socket.io/) | ^4.8 | WebSocket server for real-time multiplayer |
| [SQLite](https://www.sqlite.org/) + `sqlite`/`sqlite3` | ^5.1 / ^6.0 | Lightweight relational database |
| [Stockfish](https://stockfishchess.org/) | ^18.0 | Chess engine as Node.js child process (API fallback) |
| [chess.js](https://github.com/jhlywa/chess.js) | ^1.4 | Server-side move validation |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | ^9.0 | JWT authentication tokens |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | ^2.4 | Password hashing |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | ^8.5 | IP-based rate limiting (login: 10/min, API: 200/min) |
| [dotenv](https://github.com/motdotla/dotenv) | ^16.4 | Environment variable management |
| [uuid](https://github.com/uuidjs/uuid) | ^14.0 | Unique game and room ID generation |

> [!NOTE]
> The backend repository contains references and files for MongoDB/Mongoose (such as `mongoose` in dependencies, `backend/db/mongo.js`, and schemas under `backend/models/`). These exist for legacy database integration test coverage (`tests/db.integration.test.js`) but are completely unused/inactive during normal application runtime, which relies exclusively on SQLite.

---

## Project Structure

```
kingsgauntlet/
│
├── backend/                          # Node.js Express + SQLite backend
│   ├── server.js                     # App entry: Express, CORS, rate limiting, routes, Socket.IO
│   ├── .env.example                  # Template for required environment variables
│   │
│   ├── db/
│   │   ├── sqlite.js                 # SQLite database initialization & programmatic seeding
│   │   └── mongo.js                  # Legacy Mongoose connection setup (integration tests only)
│   │
│   ├── migrations/                   # PostgreSQL reference schemas (not executed dynamically at startup)
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_elo_and_stats.sql
│   │   ├── 003_create_leaderboard_view.sql
│   │   └── 004_seed_default_data.sql
│   │
│   ├── models/                       # Legacy Mongoose models for MongoDB (integration tests only)
│   │   ├── Analysis.js
│   │   ├── Game.js
│   │   └── UserPreferences.js
│   │
│   ├── routes/                       # Express route handlers
│   │   ├── auth.js                   # POST /register, POST /login, GET /me, PUT /avatar
│   │   ├── games.js                  # GET/POST /games, POST /games/:id/analysis
│   │   ├── friends.js                # Friend requests, accept, reject, search
│   │   ├── leaderboard.js            # GET /leaderboard
│   │   ├── matchRequests.js          # Match challenge request system
│   │   ├── notifications.js          # In-app notifications
│   │   ├── positions.js              # GET/POST /positions (saved FEN setups)
│   │   ├── preferences.js            # GET/POST /preferences
│   │   ├── puzzles.js                # GET /puzzles/random, POST /puzzles/:id/attempt
│   │   ├── stats.js                  # GET /stats/:userId, GET /stats/:userId/puzzles
│   │   └── tournaments.js            # GET /tournaments, POST /tournaments/:id/join
│   │
│   ├── middleware/
│   │   └── auth.js                   # JWT verification middleware
│   │
│   ├── ws/                           # Socket.IO WebSocket handlers
│   │   ├── socketServer.js           # Main Socket.IO server setup and event routing
│   │   ├── gameRooms.js              # Active game room management (moves, clocks)
│   │   ├── matchmaking.js            # ELO-based matchmaking queue
│   │   ├── moveValidation.js         # Server-side move legality check
│   │   ├── gameHistory.js            # Persist completed online games
│   │   └── tournamentManager.js      # Tournament pairing and bracket management
│   │
│   └── tests/                        # Backend Jest test suite
│
├── frontend/                         # React + TypeScript + Vite frontend
│   ├── index.html                    # HTML entry point
│   ├── vite.config.ts                # Vite config (proxy, sound copy script, manual chunk splitting)
│   ├── tsconfig.json                 # TypeScript config
│   │
│   ├── public/
│   │   ├── stockfish.js              # Stockfish 18 WASM WebWorker entry point
│   │   └── assets/
│   │       ├── pieces/               # SVG piece sets: neo, classic, merida, alpha, cyber
│   │       ├── move classification/  # PNG badges for move types (brilliant, blunder, etc.)
│   │       └── sound/                # MP3 audio: move, capture, castling, check, promote, checkmate
│   │
│   └── src/
│       ├── main.tsx                  # React DOM entry point, router + provider setup
│       ├── index.css                 # Global CSS design system (variables, glassmorphism, animations)
│       ├── App.tsx                   # Root component with routing setup
│       │
│       ├── chess-logic/              # Pure TypeScript chess engine (zero React dependencies)
│       │   ├── chess-board.ts        # Board state, move execution, legal move generation
│       │   ├── models.ts             # Types, enums, FENChar, piece image path resolver
│       │   ├── FENConverter.ts       # Board state → FEN string serializer
│       │   └── pieces/               # Piece classes: piece.ts, pawn.ts, knight.ts, bishop.ts, rook.ts, queen.ts, king.ts
│       │
│       ├── contexts/                 # React Context providers
│       │   ├── AuthContext.tsx       # Current user state, login/logout helpers
│       │   ├── GameContext.tsx       # All local game state (board, clocks, analysis, settings)
│       │   ├── ThemeContext.tsx      # Board theme, piece style, move hints, auto-flip
│       │   └── SoundContext.tsx      # Sound manager, enable/disable, move sound dispatch
│       │
│       ├── constants/                # App-wide constants
│       │   └── classificationMetadata.ts # Move classification badge mappings & descriptions
│       │
│       ├── hooks/                    # Reusable custom React hooks
│       │   ├── useAuth.ts            # Shortcut hook for AuthContext
│       │   ├── useGame.ts            # Shortcut hook for GameContext
│       │   ├── useSound.ts           # Shortcut hook for SoundContext
│       │   └── useTheme.ts           # Shortcut hook for ThemeContext
│       │
│       ├── types/                    # Common TypeScript types
│       │   └── moveTypes.ts
│       │
│       ├── pages/                    # Full-page route views
│       │   ├── HomePage.tsx          # Landing/dashboard redirect
│       │   ├── PlayPage.tsx          # Local game arena (vs Friend / vs AI)
│       │   ├── OnlinePlayPage.tsx    # Real-time online multiplayer via Socket.IO
│       │   ├── AnalysisBoardPage.tsx # Board editor, FEN/PGN import, engine analysis
│       │   ├── PuzzlesPage.tsx       # Tactics puzzle training
│       │   ├── TournamentsPage.tsx   # Tournament browser and join flow
│       │   ├── TournamentLobby.tsx   # Per-tournament lobby with pairings
│       │   └── ProfilePage.tsx       # User profile, stats, puzzle history
│       │
│       ├── components/               # Reusable React components
│       │   ├── ChessBoard.tsx        # 8×8 interactive board: hints, check highlight, premoves, promotion
│       │   ├── EvaluationBar.tsx     # Vertical Stockfish evaluation bar (animates in real time)
│       │   ├── ChessTimer.tsx        # Per-player countdown clock with low-time warning
│       │   ├── MoveList.tsx          # Scrollable algebraic notation; click to navigate history
│       │   ├── GameSettings.tsx      # Sidebar controls: resign, draw, hint, undo, reset
│       │   ├── ComputerDialog.tsx    # AI game setup: level, color, time control
│       │   ├── FriendDialog.tsx      # Friend game setup: time control picker
│       │   ├── GameOverModal.tsx     # Result modal with Elo deltas, PGN export, rematch
│       │   ├── GameReviewPanel.tsx   # Full post-game Stockfish analysis walkthrough
│       │   ├── BoardOverlayBadges.tsx # Crown/flag/handshake SVG overlays on game end
│       │   ├── DashboardHome.tsx     # Main dashboard: stats, charts, game history, social tabs
│       │   ├── LeaderboardTab.tsx    # Leaderboard table inside the dashboard
│       │   ├── SocialTab.tsx         # Friends panel: requests, search, friend list
│       │   ├── CustomizationDialog.tsx # Settings: themes, piece style, profile, toggles
│       │   ├── AuthModal.tsx         # Login and registration modal
│       │   ├── NotificationCenter.tsx # In-app notification dropdown
│       │   ├── ProgressBar.tsx       # Generic progress bar component
│       │   ├── CreateTournamentModal.tsx # Form modal to create standard/Swiss tournaments
│       │   ├── PgnExport.tsx         # Shareable PGN text copier component
│       │   ├── SkeletonWrapper.tsx   # Loading skeleton placeholder
│       │   └── Spinner.tsx           # Generic spinner component
│       │
│       ├── services/                 # External integrations and API clients
│       │   ├── stockfish.ts          # Stockfish WASM worker: getBestMove, getEvaluation, analyzeGame
│       │   ├── authService.ts        # REST API client for all backend endpoints
│       │   ├── socketService.ts      # Socket.IO client wrapper (connect, makeMove, findMatch)
│       │   ├── openings.ts           # 130+ ECO opening database with longest-prefix matching
│       │   └── premoveService.ts     # Premove queue management for online games
│       │
│       └── utils/                    # Utility helpers
│           ├── chess-helpers.ts      # Material calculation (captured pieces, advantage score)
│           └── soundManager.ts       # HTMLAudioElement pool, iOS unlock, preloading
│
├── dist/                             # Production build output (generated by `npm run build`)
├── package.json                      # Root scripts: dev, build, install:all, start
├── .gitignore
├── .gitattributes
└── README.md
```

---

## Application Flow

```
Sign In / Guest
      │
      ▼
  Dashboard ──────────────────────────────────────────┐
  │  ├── Play vs Friend                               │
  │  ├── Play vs AI         → Play Arena              │
  │  ├── Quick Match        (local game)              │
  │  │                           │                    │
  │  │                           ▼                    │
  │  │                    Game Over Modal             │
  │  │                    (Elo update, PGN export)    │
  │  │                           │                    │
  │  │                           ▼                    │
  │  │                    Game Review Panel           │
  │  │                    (Stockfish analysis)        │
  │  │                           │                    │
  │  │                           └──────────→ Dashboard (stats update)
  │  │
  │  ├── Play Online         → Matchmaking Queue
  │  │                           │
  │  │                           ▼
  │  │                    Online Match (Socket.IO)
  │  │
  │  ├── Tournaments         → Tournament Browser
  │  │                           │
  │  │                           ▼
  │  │                    Tournament Lobby → Paired Match
  │  │
  │  ├── Analysis Board      → Board Editor / FEN-PGN Importer
  │  │
  │  ├── Tactics Puzzles     → Interactive Puzzle Board
  │  │
  │  └── Profile             → Stats, Ratings, Match History
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (bundled with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/chessai-learn.git
cd chessai-learn

# 2. Install all dependencies (root workspace + frontend + backend)
npm run install:all

# 3. Set up backend environment variables
cp backend/.env.example backend/.env
#    At minimum, set JWT_SECRET to a random 32+ character string.

# 4. Start both frontend and backend simultaneously
npm run dev
```

- **Frontend** → `http://localhost:5173`
- **Backend API** → `http://localhost:5000`
- **Backend health check** → `http://localhost:5000/api/status`

### Development Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend + frontend concurrently (recommended) |
| `npm run start:frontend` | Start only the Vite dev server |
| `npm run start:backend` | Start only the Node.js backend |
| `npm run install:all` | Install dependencies for frontend and backend |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview --prefix frontend` | Preview production build locally |
| `npm run lint --prefix frontend` | ESLint for frontend TypeScript |
| `npm test --prefix backend` | Run backend Jest test suite |

---

## Environment Variables

Create `backend/.env` based on `backend/.env.example`:

```env
# Server
PORT=5000
NODE_ENV=development

# Authentication — REQUIRED in production (32+ chars)
JWT_SECRET=replace_this_with_a_minimum_32_char_random_secret_key
JWT_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
LOGIN_RATE_LIMIT_MAX=10
LOGIN_RATE_LIMIT_WINDOW_MS=60000

# CORS — must match your frontend URL
FRONTEND_URL=http://localhost:5173
```

> [!NOTE]
> The database uses a local SQLite database file `database2.sqlite` directly. Although the backend `.env.example` lists variables like `DATABASE_URL` (for PostgreSQL) and `MONGODB_URI` (for MongoDB), they are legacy settings used only in database integration tests and are not required to run the application server.

> **Never** commit your `.env` file — it is in `.gitignore`.

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create a new user account |
| POST | `/api/auth/login` | — | Login; returns JWT token |
| GET | `/api/auth/me` | ✅ | Get current user profile |
| PUT | `/api/auth/avatar` | ✅ | Update profile avatar URL |
| GET | `/api/games` | ✅ | Get authenticated user's game history |
| POST | `/api/games` | ✅ | Save a completed game |
| POST | `/api/games/:id/analysis` | ✅ | Save post-game analysis |
| GET | `/api/stats/:userId` | — | Get a user's rating and W/L/D stats |
| GET | `/api/stats/:userId/puzzles` | — | Get a user's puzzle attempt stats |
| GET | `/api/leaderboard` | — | Global Elo leaderboard |
| GET | `/api/friends` | ✅ | Get friends, incoming/outgoing requests |
| POST | `/api/friends/request` | ✅ | Send a friend request |
| POST | `/api/friends/accept` | ✅ | Accept a friend request |
| GET | `/api/puzzles/random` | — | Get a random tactics puzzle |
| POST | `/api/puzzles/:id/attempt` | ✅ | Record a puzzle attempt |
| GET | `/api/tournaments` | — | List all tournaments |
| POST | `/api/tournaments/:id/join` | ✅ | Join a tournament |
| GET | `/api/evaluate?fen=...&depth=...` | — | Evaluate a FEN position (Stockfish fallback) |
| GET | `/api/bestmove?fen=...&depth=...` | — | Get best move for a FEN (Stockfish fallback) |
| POST | `/api/evaluate-batch` | — | Batch-evaluate multiple FEN positions |
| GET | `/api/preferences` | ✅ | Get user preferences |
| POST | `/api/preferences` | ✅ | Save user preferences |

### WebSocket Events (Socket.IO)

| Event (Client → Server) | Description |
|---|---|
| `find_match` | Join matchmaking queue with time control |
| `cancel_match` | Leave the matchmaking queue |
| `make_move` | Send a move in an active game |
| `resign` | Resign from the current game |

| Event (Server → Client) | Description |
|---|---|
| `game_started` | Match found; contains room ID, players, FEN, clocks |
| `move_made` | Opponent made a move; contains updated FEN and clocks |
| `move_error` | Sent move was illegal |
| `game_over` | Game ended; contains reason, winner |

---

## Build & Deploy

### Production Build

```bash
npm run build
```

Runs `tsc -b` (TypeScript type check) then `vite build`. Output is written to the `dist/` directory.

### Deployment Strategy

KingsGauntlet Chess Arena uses a Node.js backend with Socket.IO and an SQLite database, requiring two separate deployments:

**Frontend** — deploy the `dist/` folder as a static site:
- [Vercel](https://vercel.com/) — `vercel --prod` (set `VITE_API_URL` env var)
- [Netlify](https://netlify.com/) — drag & drop `dist/`, or push to connected repo
- [Firebase Hosting](https://firebase.google.com/products/hosting)

**Backend** — deploy as a Node.js service with **persistent disk storage** for SQLite:
- [Render](https://render.com/) — Node.js Web Service + Persistent Disk
- [Railway](https://railway.app/) — Node.js + Volume
- VPS (DigitalOcean, AWS EC2) — any Node.js capable server

> **Note:** For production-scale deployments, consider migrating from SQLite to PostgreSQL for better concurrent write performance and cloud-managed hosting compatibility.

---

*Built with ❤️ by KingsGauntlet — Learn chess. Play better. Have fun.*#   c h e s s - v e r s i o n - 1 . 0  
 #   c h e s s - v e r s i o n - 1 . 0  
 