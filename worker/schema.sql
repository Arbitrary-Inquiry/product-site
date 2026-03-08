-- ArbInq purchase database schema
-- Apply with: wrangler d1 execute arbinq-purchases --file=schema.sql

-- One row per unique buyer. Keyed on SHA-256(lower(email)) so a future
-- account system can grandfather in existing purchases without ever storing
-- the raw email in a separate identity table.
CREATE TABLE IF NOT EXISTS customers (
  email_hash   TEXT PRIMARY KEY,  -- SHA-256 hex of lower-cased email
  created_at   TEXT NOT NULL      -- ISO 8601, date of first purchase
);

CREATE TABLE IF NOT EXISTS purchases (
  id              TEXT PRIMARY KEY,   -- Stripe Checkout Session ID
  customer_hash   TEXT NOT NULL,      -- FK → customers.email_hash
  email           TEXT NOT NULL,
  product_id      TEXT NOT NULL,
  amount          INTEGER NOT NULL,   -- cents
  icp_slug        TEXT,
  created_at      TEXT NOT NULL,      -- ISO 8601
  FOREIGN KEY (customer_hash) REFERENCES customers(email_hash)
);

CREATE TABLE IF NOT EXISTS download_tokens (
  token          TEXT PRIMARY KEY,    -- UUID v4
  purchase_id    TEXT NOT NULL,
  product_id     TEXT NOT NULL,
  email          TEXT NOT NULL,
  expires_at     TEXT NOT NULL,       -- ISO 8601
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads  INTEGER NOT NULL DEFAULT 5,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);
