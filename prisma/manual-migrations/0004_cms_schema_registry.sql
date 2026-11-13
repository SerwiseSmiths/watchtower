-- Content-type registry for the /cms Content-Type Builder.
--
-- Schemas used to be static files (content-schemas/) compiled into the app, so adding a type or
-- field meant a deploy. They now live in these tables and the builder edits them at runtime (it
-- also runs the matching CREATE/ALTER/DROP TABLE for the content tables themselves).
--
-- `schema` holds the raw Strapi schema.json shape (kind, collectionName, info, options,
-- attributes). JSON, not JSONB: JSONB re-sorts object keys, and attribute order is the field order
-- editors see in the Content Manager. On first load the app seeds these tables from content-schemas/ automatically
-- (src/lib/content-schema/store.ts → seedFromStatic). Until this migration runs, the app keeps
-- using the static files and the builder stays read-only.
--
-- Idempotent — safe to re-run. Apply: dev first; prod gets it via `yarn cms:sync-schema`.

CREATE TABLE IF NOT EXISTS watchtower_cms_content_types (
  uid        VARCHAR(255) PRIMARY KEY,
  schema     JSON         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchtower_cms_components (
  uid        VARCHAR(255) PRIMARY KEY,
  schema     JSON         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- `${ownerUid}.${attributeName}` → { table, ownerColumn, targetColumn, ownerOrderColumn?, targetOrderColumn? }
CREATE TABLE IF NOT EXISTS watchtower_cms_relation_tables (
  key VARCHAR(255) PRIMARY KEY,
  map JSONB        NOT NULL
);

-- Single row; bumped on every schema change so every server instance reloads its cached registry.
CREATE TABLE IF NOT EXISTS watchtower_cms_schema_state (
  id         SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version    BIGINT      NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO watchtower_cms_schema_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
