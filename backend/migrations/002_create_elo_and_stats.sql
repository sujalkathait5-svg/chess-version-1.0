-- =============================================================
-- Migration 002: Create Elo Ratings, Stats & Friendships Tables
-- Idempotent: safe to re-run multiple times
-- Requires: 001_create_users.sql to have been run first
-- =============================================================

-- Elo Ratings Table
CREATE TABLE IF NOT EXISTS elo_ratings (
  user_id               UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating_vs_ai          INT     NOT NULL DEFAULT 1200 CHECK (rating_vs_ai >= 100),
  rating_vs_human       INT     NOT NULL DEFAULT 1200 CHECK (rating_vs_human >= 100),
  peak_rating_vs_ai     INT     NOT NULL DEFAULT 1200,
  peak_rating_vs_human  INT     NOT NULL DEFAULT 1200,
  provisional_vs_ai     BOOLEAN NOT NULL DEFAULT TRUE,
  provisional_vs_human  BOOLEAN NOT NULL DEFAULT TRUE,
  games_vs_ai_count     INT     NOT NULL DEFAULT 0,
  games_vs_human_count  INT     NOT NULL DEFAULT 0
);

-- Indexes: leaderboard queries sort by rating DESC
CREATE INDEX IF NOT EXISTS idx_elo_rating_vs_human ON elo_ratings(rating_vs_human DESC);
CREATE INDEX IF NOT EXISTS idx_elo_rating_vs_ai    ON elo_ratings(rating_vs_ai DESC);

-- =============================================================

-- User Stats Summary Table
CREATE TABLE IF NOT EXISTS user_stats_summary (
  user_id              UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_games          INT          NOT NULL DEFAULT 0,
  wins                 INT          NOT NULL DEFAULT 0,
  losses               INT          NOT NULL DEFAULT 0,
  draws                INT          NOT NULL DEFAULT 0,
  avg_accuracy         NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  total_blunders       INT          NOT NULL DEFAULT 0,
  best_win_streak      INT          NOT NULL DEFAULT 0,
  current_win_streak   INT          NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS update_user_stats_summary_updated_at ON user_stats_summary;
CREATE TRIGGER update_user_stats_summary_updated_at
  BEFORE UPDATE ON user_stats_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================

-- Friendships Table
CREATE TABLE IF NOT EXISTS friendships (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_friend_pair UNIQUE (user_id, friend_id),
  CONSTRAINT self_friendship_check CHECK (user_id <> friend_id),
  CONSTRAINT status_check CHECK (status IN ('pending', 'accepted'))
);

-- Indexes: friendship queries filter by user_id, friend_id, and status
CREATE INDEX IF NOT EXISTS idx_friendships_user_id   ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status    ON friendships(status);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
