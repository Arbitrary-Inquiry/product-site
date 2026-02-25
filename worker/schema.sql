-- SimpleSight Download Distribution System
-- D1 Database Schema

-- Purchases table: tracks all SimpleSight purchases from Stripe
CREATE TABLE IF NOT EXISTS purchases (
  id          TEXT PRIMARY KEY,   -- Stripe checkout session ID
  email       TEXT NOT NULL,
  product_id  TEXT NOT NULL,      -- "simplesight" for SimpleSight Device Inventory
  amount      INTEGER NOT NULL,   -- Amount in cents (e.g., 2000 for $20.00)
  icp_slug    TEXT,               -- Which ICP landing page they came from (if tracked)
  created_at  TEXT NOT NULL,      -- ISO 8601 timestamp
  download_urls_sent_at TEXT      -- ISO 8601 timestamp when download email was sent
);

-- Downloads table: tracks each file download event
CREATE TABLE IF NOT EXISTS downloads (
  id          TEXT PRIMARY KEY,   -- UUID for this download event
  purchase_id TEXT NOT NULL,      -- References purchases.id
  file_key    TEXT NOT NULL,      -- "server" or "agent"
  ip_address  TEXT,               -- Request IP for abuse detection
  user_agent  TEXT,               -- Browser/client user agent
  downloaded_at TEXT NOT NULL,    -- ISO 8601 timestamp
  FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);

-- Index for faster download lookups by purchase
CREATE INDEX IF NOT EXISTS idx_downloads_purchase_id ON downloads(purchase_id);

-- Index for faster purchase lookups by email (for support)
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);

-- Index for recent purchases (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
