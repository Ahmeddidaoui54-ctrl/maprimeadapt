-- ============================================================
-- Planning Salariés — Schéma Supabase
-- Exécuter dans l'éditeur SQL de votre projet Supabase
-- ============================================================

-- Salariés
CREATE TABLE IF NOT EXISTS planning_employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  post            TEXT,                  -- Poste / rôle
  contract_type   TEXT DEFAULT 'CDI',   -- CDI, CDD, interim, apprenti
  weekly_hours    NUMERIC(5,2),
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Planning (shifts prévus)
CREATE TABLE IF NOT EXISTS planning_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES planning_employees(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  post            TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedules_employee_date ON planning_schedules(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON planning_schedules(date);

-- Pointages réels
CREATE TABLE IF NOT EXISTS planning_timeclock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES planning_employees(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('in', 'out')),
  clocked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT DEFAULT 'api',    -- Identifiant du logiciel source
  note            TEXT,
  api_key_id      TEXT,                  -- Clé API utilisée pour le pointage
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeclock_employee_at ON planning_timeclock(employee_id, clocked_at DESC);

-- Anomalies détectées
CREATE TABLE IF NOT EXISTS planning_anomalies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  label           TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  employee_id     UUID REFERENCES planning_employees(id) ON DELETE SET NULL,
  timeclock_id    UUID REFERENCES planning_timeclock(id) ON DELETE SET NULL,
  detail          JSONB DEFAULT '{}',
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_anomalies_employee ON planning_anomalies(employee_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON planning_anomalies(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected ON planning_anomalies(detected_at DESC);

-- Clés API
CREATE TABLE IF NOT EXISTS planning_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label           TEXT NOT NULL,
  key_value       TEXT NOT NULL UNIQUE,
  permissions     TEXT[] NOT NULL DEFAULT '{"timeclock:write"}',
  active          BOOLEAN DEFAULT TRUE,
  use_count       INTEGER DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Journal d'audit
CREATE TABLE IF NOT EXISTS planning_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL,
  detail          JSONB DEFAULT '{}',
  severity        TEXT DEFAULT 'info',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON planning_audit_log(created_at DESC);

-- ============================================================
-- Row Level Security (accès service_role uniquement depuis API)
-- ============================================================
ALTER TABLE planning_employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_timeclock    ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_anomalies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_api_keys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_audit_log    ENABLE ROW LEVEL SECURITY;

-- Seul le service_role (votre API) peut lire/écrire
CREATE POLICY "service_role_only" ON planning_employees    USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON planning_schedules    USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON planning_timeclock    USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON planning_anomalies    USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON planning_api_keys     USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON planning_audit_log    USING (auth.role() = 'service_role');
