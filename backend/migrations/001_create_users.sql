-- =============================================================
-- Migration 001: Create Users Table
-- Idempotent: safe to re-run multiple times
-- =============================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(15)  UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  avatar_url      VARCHAR(2048) DEFAULT 'default_avatar.svg',
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for frequent lookup patterns
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username   ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active  ON users(is_active) WHERE is_active = TRUE;

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply trigger to users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
