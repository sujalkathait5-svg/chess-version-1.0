-- =============================================================
-- Migration 003: Create Leaderboard Materialized View
-- Idempotent: safe to re-run multiple times
-- Requires: 001 and 002 migrations to have been run first
-- =============================================================

-- Materialized view: pre-computed ranking sorted by Elo (vs human)
-- Uses CASE to avoid division by zero on total_games = 0
CREATE MATERIALIZED VIEW IF NOT EXISTS m_leaderboard AS
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
    ELSE ROUND((s.wins::NUMERIC / s.total_games::NUMERIC) * 100, 2)
  END AS win_rate
FROM users u
JOIN elo_ratings r       ON u.id = r.user_id
JOIN user_stats_summary s ON u.id = s.user_id
WHERE u.is_active = TRUE;

-- Unique index on user_id is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY
-- Without this, concurrent refresh is not possible and will lock the view for all reads
CREATE UNIQUE INDEX IF NOT EXISTS idx_m_leaderboard_user_id ON m_leaderboard(user_id);

-- =============================================================
-- HOW TO REFRESH (run from backend setInterval or cron):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY m_leaderboard;
-- This updates the view without blocking concurrent SELECT queries.
-- =============================================================
