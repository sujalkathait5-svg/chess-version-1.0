-- =============================================================
-- Migration 004: Seed Default Data
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Requires: 001, 002, 003 migrations to have been run first
-- =============================================================

-- ── Optional: Seed a default "system" admin placeholder ─────────────────
-- This is commented out by default. Uncomment and set a real password hash
-- if you need a pre-seeded admin account (e.g., for demos).
--
-- INSERT INTO users (id, username, email, password_hash, avatar_url)
-- VALUES (
--   gen_random_uuid(),
--   'KingsAdmin',
--   'admin@kingsgauntlet.com',
--   '$2a$12$REPLACE_WITH_BCRYPT_HASH_HERE',
--   'default_avatar.svg'
-- )
-- ON CONFLICT (username) DO NOTHING;
--
-- -- Seed Elo and stats rows for the admin user (safe if user doesn't exist either)
-- INSERT INTO elo_ratings (user_id)
-- SELECT id FROM users WHERE username = 'KingsAdmin'
-- ON CONFLICT (user_id) DO NOTHING;
--
-- INSERT INTO user_stats_summary (user_id)
-- SELECT id FROM users WHERE username = 'KingsAdmin'
-- ON CONFLICT (user_id) DO NOTHING;
-- ────────────────────────────────────────────────────────────────────────

-- Refresh leaderboard after seeding to reflect any new rows
-- (Only works after materialized view exists from migration 003)
REFRESH MATERIALIZED VIEW m_leaderboard;

-- =============================================================
-- TO GENERATE A BCRYPT HASH for seed data (cost 12):
--   node -e "const b=require('bcryptjs'); b.hash('yourpassword',12).then(console.log)"
-- =============================================================
