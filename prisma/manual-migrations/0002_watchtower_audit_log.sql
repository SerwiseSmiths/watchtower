-- Global audit log — one shared table for every create/update/delete performed from
-- watchtower, across every module (providers, customers, tickets, provider tiers,
-- device types, pricing). Brand-new table owned entirely by watchtower; nothing here
-- alters any existing Strapi-owned table.
--
-- Safe to re-run against Neon once that migration happens (all statements are
-- idempotent via IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS watchtower_audit_logs (
  id            SERIAL PRIMARY KEY,
  module        VARCHAR(64) NOT NULL,
  action        VARCHAR(16) NOT NULL,              -- CREATE | UPDATE | DELETE
  entity_id     VARCHAR(64) NOT NULL,
  entity_label  VARCHAR(255),
  changes       JSONB,                              -- { field: { old, new } }
  actor_id      INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_name    VARCHAR(255),
  created_at    TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watchtower_audit_logs_module_idx ON watchtower_audit_logs(module);
CREATE INDEX IF NOT EXISTS watchtower_audit_logs_entity_idx ON watchtower_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS watchtower_audit_logs_actor_idx ON watchtower_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS watchtower_audit_logs_created_idx ON watchtower_audit_logs(created_at DESC);
