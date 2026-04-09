-- Bot System v4.0 · Schema Supabase · 3 tables
-- Executer dans Supabase Dashboard > SQL Editor

-- Table 1 : Journal d'audit universel
CREATE TABLE IF NOT EXISTS logs (
  id      BIGSERIAL PRIMARY KEY,
  ts      TIMESTAMPTZ DEFAULT NOW(),
  bot     TEXT NOT NULL,
  action  TEXT NOT NULL,
  auth    TEXT DEFAULT 'auto',
  result  TEXT,
  data    JSONB
);
CREATE INDEX IF NOT EXISTS idx_logs_bot ON logs(bot);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);

-- Table 2 : Opportunites veille + operations trader
CREATE TABLE IF NOT EXISTS ops (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ DEFAULT NOW(),
  type       TEXT NOT NULL,
  source     TEXT,
  signal     TEXT,
  score      INT,
  urgence    TEXT,
  status     TEXT DEFAULT 'new',
  prix_achat NUMERIC(8,2),
  prix_vente NUMERIC(8,2),
  pnl        NUMERIC(8,2),
  deadline   TIMESTAMPTZ,
  hash       TEXT UNIQUE,
  data       JSONB
);
CREATE INDEX IF NOT EXISTS idx_ops_status ON ops(status);
CREATE INDEX IF NOT EXISTS idx_ops_type ON ops(type);

-- Table 3 : Leads + documents + RDV
CREATE TABLE IF NOT EXISTS items (
  id      BIGSERIAL PRIMARY KEY,
  ts      TIMESTAMPTZ DEFAULT NOW(),
  type    TEXT NOT NULL,
  title   TEXT,
  status  TEXT DEFAULT 'new',
  score   INT,
  retries INT DEFAULT 0,
  data    JSONB
);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
