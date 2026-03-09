-- Migration: apply full schema on top of existing tables
-- Safe to run multiple times — uses IF NOT EXISTS throughout.

CREATE TABLE IF NOT EXISTS customers (
  email_hash   TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS download_tokens (
  token          TEXT PRIMARY KEY,
  purchase_id    TEXT NOT NULL,
  product_id     TEXT NOT NULL,
  email          TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads  INTEGER NOT NULL DEFAULT 5
);

-- Add customer_hash to purchases if it doesn't exist yet.
-- SQLite has no ALTER TABLE ADD COLUMN IF NOT EXISTS, so this will error
-- if already present — that's fine, the rest of the migration still applies.
ALTER TABLE purchases ADD COLUMN customer_hash TEXT;
