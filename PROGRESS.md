# Watchtower CMS Migration — Progress Tracker

Rebuilding `console` (Strapi 5) as custom Next.js code in `watchtower`, deployable on Vercel,
reading the same Postgres data (`strapi_console`, migrating to Neon), same Strapi-style admin UI,
same REST/GraphQL API contract for existing consumers (nexus, serwise, serwise-website).

Full plan: see conversation history / `binary-seeking-dragon` plan (architecture rationale,
locked decisions, verification approach). This file tracks execution status only.

Landing page at `/` is untouched and out of scope — all CMS work lives under `/admin` (panel)
and `/api`, `/graphql` (API surface).

## Phase 0 — Foundations — DONE
- [x] Commit existing staged landing-page changes untouched
- [x] Create this progress tracker
- [x] Add deps to `watchtower/package.json` (`@prisma/client`, `prisma`, `@strapi/design-system`,
      `@strapi/icons`, `styled-components`, `bcryptjs`, `jsonwebtoken`, `graphql`, `graphql-yoga`)
- [x] Copy `console/src/api/*/content-types/*/schema.json` + `console/src/components/**/*.json`
      into `watchtower/content-schemas/`
- [x] `prisma db pull` against local `strapi_console` dev DB → `watchtower/prisma/schema.prisma`
      (76 models introspected). **Gotcha**: Strapi's Postgres migrations create an index with the
      same physical name as its paired FK constraint (legal in Postgres, illegal in Prisma's DSL) —
      this hit ~96 tables. Fixed via `watchtower/scripts/fix-prisma-schema.js`, wired into
      `yarn prisma:pull` (`db pull && fix-prisma-schema.js && generate`). Verified working against
      real data (subscription_plans draft/publish rows, strapi_api_tokens).
- [x] `watchtower/.env.example` (DATABASE_URL, DIRECT_URL, API_TOKEN_SALT, ADMIN_JWT_SECRET,
      WATCHTOWER_ADMIN_ALLOWED_IPS, CLOUDINARY_*). Local dev `.env` points at the local
      `strapi_console` Postgres DB (gitignored) until the Neon migration lands.

## Phase 1 — Schema engine & data access layer — READ PATH DONE
- [x] `src/lib/content-schema/types.ts` + `loader.ts` + `registry.ts` — normalizes schema.json/component
      json (statically imported from `content-schemas/`) into typed descriptors, keyed by uid
      (`api::x.x` for content types, `category.name` for components).
- [x] `src/lib/content-schema/relation-tables.ts` — curated map of the ~4 relation attributes in this
      schema to their real (sometimes hash-truncated) `_lnk` table + column names. Confirmed only 6
      entries needed (both directions of 2 mappedBy pairs + 2 component-owned relations) — a generic
      DMMF-search resolver would have been overkill for this few, so this is hand-curated instead.
- [x] `src/lib/db/entity-repository.ts` — generic `listEntities`/`findEntity`/`findSingleType` (READ
      path only so far) covering scalars (camelCase attr -> snake_case column via `toColumnName`),
      single/multiple media (`files_related_mph`), single/repeatable components (`<table>_cmps` +
      `components_*`, recursively hydrated so nested components/media/relations inside a component
      also resolve), dynamic zones (`page.blocks`, component_type-driven), and relations in both
      directions (owning + `mappedBy`, including a relation nested inside a component:
      `blocks.service-row.deviceTypes`).
- [x] Verified via `scripts/verify-repository.ts` (`npx tsx scripts/verify-repository.ts`) against
      real data in all of: subscription-plan (components + component-nested relation),
      device-type (mappedBy relations both directions), page (dynamic zone with nested components +
      media), bottom-tab (singleType + repeatable component with media), complaint-page (singleType,
      single + repeatable component fields). All hydrate correctly, including one genuinely-empty
      relation confirmed against raw SQL (not a mapping bug).
- [ ] **Not done yet**: write path (create/update/delete/publish/unpublish, document_id generation).
      Scoped out of this session for time — next task before Phase 2 can do authenticated writes
      from the admin panel.

## Phase 2 — API layer (REST + GraphQL), auth parity
- [ ] `src/lib/auth/api-token.ts` — HMAC-SHA512+salt verification, full-access/read-only/custom gating
- [ ] REST routes matching Strapi's query contract (populate/filters/fields/sort/pagination/status)
- [ ] GraphQL endpoint (`graphql-yoga`) matching existing query names (pages, deviceTypes,
      subscriptionPlans, subscriptionAddons, welcomeBonus, complaintPage, globalConfig, bottomTab)
- [ ] Parity gate: diff console vs. watchtower responses for every real call site
      (nexus REST + 4 GraphQL queries, serwise's 8 GraphQL queries, serwise-website's queries)

## Phase 3 — Admin panel (`/admin`)
- [ ] `middleware.ts` — IP allowlist gate for `/admin/**` only
- [ ] `/admin/login` — bcrypt check against `admin_users`, JWT session cookie
- [ ] `/admin/content-manager/[type]` — list view (DataTable, pagination, draft/published badges)
- [ ] `/admin/content-manager/[type]/[id]` — edit view, per-field-type inputs, Save + Publish/Unpublish
- [ ] `/admin/media-library` — file list + Cloudinary upload
- [ ] All built with `@strapi/design-system`

## Phase 4 — Deploy & cutover
- [ ] Vercel project config (Prisma + Neon pooled connection)
- [ ] Final parity smoke test against real Neon-migrated data
- [ ] Repoint STRAPI_URL/CMS_URL/NEXT_PUBLIC_CMS_URL/API tokens in nexus, serwise, serwise-website
      (big-bang cutover — requires explicit confirmation before executing)
- [ ] Decommission console

---
*Last updated: Phase 0 in progress.*
