-- Root login (`/`) — phone+OTP+passkey. These are brand-new tables owned entirely by
-- watchtower; nothing here alters an existing Strapi-owned table (admin_users, admin_roles, ...).
-- Being present in watchtower_root_operators IS the "admin role" gate for root login — no column
-- changes to admin_users/admin_roles are needed.
--
-- Safe to re-run against Neon once that migration happens (all statements are idempotent via
-- IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS watchtower_root_operators (
  id            SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE,
  phone_number  VARCHAR(32) NOT NULL UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchtower_passkey_enrollments (
  id           SERIAL PRIMARY KEY,
  operator_id  INTEGER NOT NULL REFERENCES watchtower_root_operators(id) ON DELETE CASCADE,
  token        VARCHAR(128) NOT NULL UNIQUE,
  device_label VARCHAR(255),
  expires_at   TIMESTAMP(6) NOT NULL,
  used_at      TIMESTAMP(6),
  created_at   TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watchtower_passkey_enrollments_operator_idx
  ON watchtower_passkey_enrollments(operator_id);

CREATE TABLE IF NOT EXISTS watchtower_webauthn_credentials (
  id            SERIAL PRIMARY KEY,
  operator_id   INTEGER NOT NULL REFERENCES watchtower_root_operators(id) ON DELETE CASCADE,
  credential_id VARCHAR(512) NOT NULL UNIQUE,
  public_key    BYTEA NOT NULL,
  counter       BIGINT NOT NULL DEFAULT 0,
  device_label  VARCHAR(255),
  transports    JSONB,
  created_at    TIMESTAMP(6) NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMP(6)
);
CREATE INDEX IF NOT EXISTS watchtower_webauthn_credentials_operator_idx
  ON watchtower_webauthn_credentials(operator_id);

CREATE TABLE IF NOT EXISTS watchtower_otp_codes (
  id           SERIAL PRIMARY KEY,
  phone_number VARCHAR(32) NOT NULL UNIQUE,
  code_hash    VARCHAR(255) NOT NULL,
  expires_at   TIMESTAMP(6) NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP(6) NOT NULL DEFAULT now()
);
