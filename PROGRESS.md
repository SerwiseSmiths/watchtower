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
- [x] Write path: `createEntity`/`updateEntity`/`deleteEntity`/`publishEntity`/`unpublishEntity` in
      `entity-repository.ts`. Generates `document_id` on create; for draftAndPublish types, create
      makes a draft (`publishedAt: null`), publish deep-copies components into a fresh published-row
      sibling sharing the same `document_id` (relations are referenced, not duplicated — matches
      Strapi's document model), unpublish removes the published sibling and leaves the draft intact.
      Update on components/dynamic zones/relations/media is a full replace (delete old rows, write new)
      rather than diffing. Recursive delete cleans up owned component rows + their media links
      (`_lnk`/`_cmps` rows themselves cascade via existing FK `ON DELETE CASCADE`).
      Also fixed: `hydrateAttributes` now exposes Strapi's system fields as `documentId`/`createdAt`/
      `updatedAt`/`publishedAt` (camelCase, matching real Strapi API output) — missing before, caught
      by the write-path test itself.
      Verified via `scripts/verify-write-path.ts` — creates/updates/publishes/deletes disposable test
      rows only (`test_write_path`, `TEST_PLAN`), self-cleans even on assertion failure, confirmed via
      raw SQL that no orphan rows remain in the real tables afterward.

**Plan deviation (API_TOKEN_SALT):** original plan assumed copying console's real `API_TOKEN_SALT`
for byte-for-byte token parity with existing deployed tokens. User no longer has access to that value
(hosting plan lapsed). Resolution: watchtower generates its own fresh `API_TOKEN_SALT` and issues new
rows in `strapi_api_tokens` (same table, same HMAC-SHA512 verification algorithm — just a new salt and
newly generated raw tokens). At Phase 4 cutover, updating nexus/serwise/serwise-website's API token env
vars happens alongside the URL repoint, at no extra cost. Data seeding is separately covered by
console's existing `seed:subscriptions` scripts — not this project's concern.

## Phase 2 — API layer (REST + GraphQL), auth parity
- [x] `src/lib/auth/api-token.ts` — HMAC-SHA512+salt verification (`authenticateApiToken`, exact
      port of Strapi's `admin::api-token` hash/verify), full-access/read-only/custom scope gating
      (`authorizeApiToken`). `scripts/create-api-token.ts` mints new tokens under watchtower's own
      `API_TOKEN_SALT` (see Phase 0 deviation note above — old salt unrecoverable). Verified via
      `scripts/verify-api-token-auth.ts`: valid token authenticates, full-access authorized for
      every scope, missing/garbage/non-Bearer headers all correctly rejected. Test token deleted
      after verification — original 3 production tokens (Read Only, Full, Full Access) untouched.
- [x] REST routes: `src/app/api/[...slug]/route.ts` — one catch-all handler for both collectionType
      (`/api/<plural>`, `/api/<plural>/:documentId`) and singleType (`/api/<singular>`), GET/POST/PUT/
      DELETE plus `/actions/publish` and `/actions/unpublish`, Strapi's `{data, error}`/`{data, meta}`
      envelope shapes, `documentId`-addressed (not internal numeric id, matching Strapi v5 + what nexus
      actually calls). `src/lib/rest/query-parser.ts` parses Strapi's bracket-notation query DSL
      (`filters[field][$operator]`, `fields[]`, `sort`, `pagination[page/pageSize]`, `status`).
      **Known simplification**: `populate` isn't parsed — this engine always fully hydrates media/
      components/relations regardless of what's requested (a superset of Strapi's default lazy
      populate; harmless for consumers that only read specific keys, but worth knowing about).
      Verified end-to-end against the real dev DB with `next dev` + curl: auth rejection (401),
      list/filter/status query (`filters[visibility][$eq]=ACTIVE&status=published` — nexus's exact
      real query shape), findOne by documentId, full create/update/delete cycle, and publish/unpublish
      — all against disposable test rows only, cleaned up and confirmed via raw SQL afterward.
- [x] GraphQL endpoint: `src/lib/graphql/schema.ts` generates the full executable schema from the
      registry (component types named `Component<Category><Name>` e.g. `ComponentBlocksAdvertisement`,
      matching Strapi's `__typename` convention; dynamic zones as GraphQL unions with `__resolveType`
      keyed off the hydrated `__component` tag; per-type `<Type>FiltersInput` with `eq/ne/in/notIn/
      contains/gt/gte/lt/lte`; `PaginationArg`; `PublicationStatus` enum). `src/app/graphql/route.ts`
      wires it into `graphql-yoga`, gated by the same `authenticateApiToken` as REST (no token ->
      GraphQL error, matching REST's 401 semantics). Since graphql-js's default resolver just reads
      `source[fieldName]`, and hydrateAttributes already produces objects keyed by the exact attribute
      names Strapi's real schema uses, no field-level resolvers were needed beyond the 9 root Query
      fields + union `__resolveType`.
      **Known simplification**: enum/date/datetime fields map to GraphQL `String` rather than a real
      enum/DateTime scalar — no currently-real query selects one of these as a distinct type, so this
      wasn't worth the extra engineering yet.
      Verified against real dev-DB data with the *exact* query strings copied from nexus's
      `strapi.service.ts` and serwise's `cms.graphql.ts`: `deviceTypes`, `subscriptionPlans` (with
      `filters: { is_active: { eq: true } }` + `status: PUBLISHED`), the `pages` dynamic-zone query
      with inline fragments on all 7 block types (including a component-nested relation:
      `ComponentBlocksServices.rows.deviceTypes`), `complaintPage`, `globalConfig`, `bottomTab`,
      `welcomeBonus` (correctly `null` — table has no rows yet), and unauthenticated-request rejection.
      All matched exactly.
- [ ] Parity gate: diff console vs. watchtower responses for every real call site — deferred until a
      real Strapi instance can be run side-by-side (not available in this dev environment); everything
      above was instead verified by matching the *literal query strings* consumers already send against
      real dev-DB data, which is the practical equivalent for the queries that exist today.

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
