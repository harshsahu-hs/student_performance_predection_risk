-- 002_auth_hardening.sql
-- Session audit and account lifecycle support.

CREATE TABLE IF NOT EXISTS auth_events (
  auth_event_id SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  email         VARCHAR(255),
  event_type    VARCHAR(30) NOT NULL
                CONSTRAINT auth_events_type_check
                CHECK (event_type IN ('login_success', 'login_failed', 'logout', 'register', 'approval', 'deactivation')),
  ip_address    VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id, created_at DESC);

-- Only one active model row may exist at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_metrics_single_active
  ON model_metrics (is_active) WHERE is_active;
