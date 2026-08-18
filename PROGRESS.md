# Watchtower CMS Migration — Progress Tracker

Rebuilding `console` (Strapi 5) as custom Next.js code in `watchtower`, deployable on Vercel,
reading the same Postgres data (`strapi_console`, migrating to Neon), same Strapi-style admin UI,
same REST/GraphQL API contract for existing consumers (nexus, serwise, serwise-website).

Full plan: see conversation history / `binary-seeking-dragon` plan (architecture rationale,
locked decisions, verification approach). This file tracks execution status only.

Landing page at `/` is untouched and out of scope — all CMS work lives under `/admin` (panel)
and `/api`, `/graphql` (API surface).

**Superseded (see "Root login" section below):** `/` no longer hosts the marketing landing page.
It's now a phone+OTP+WebAuthn-passkey login gating a details page, with device pre-approval
managed from a new `/admin/operators` screen. All CMS work still lives under `/admin` and
`/api`/`/graphql` as before — this only replaces what `/` itself renders.

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
- [x] Parity gate: ran console's real Strapi (`npx strapi develop`, port 1337) side-by-side with
      watchtower (port 3001 — port 3000 turned out to be held by a live nexus process, unrelated to
      this app; picked an explicit different port rather than touch it) against the same local DB,
      diffing real responses for nexus's exact call shapes.
      **Found and fixed a real bug this way**: `listEntities`/`findSingleType` had no default status
      filter, so a draftAndPublish type's list endpoint returned BOTH the draft and published row per
      document (double-counted) when callers didn't pass `status` — which is exactly how nexus calls
      it. `statusWhere` in `entity-repository.ts` now defaults to published-only when `status` is
      unspecified (matching Strapi's real default), with admin-panel callers (editing, relation
      pickers, the list view) explicitly passing `status: 'draft'` to keep seeing draft content.
      The admin list view itself had the same symptom (duplicate draft+published rows per document);
      fixed by always querying drafts there (one row per document) and adding
      `getPublishedDocumentIds()` to compute the real Published/Draft badge from a lightweight
      follow-up query, since a draft row's own `publishedAt` is always null.
      After the fix: `GET /api/subscription-plans` (no status param) and
      `GET /api/service-parts?filters[visibility][$eq]=ACTIVE&status=published` (nexus's literal
      query) return identical ids/keys/fields/order against both instances; `deviceTypes` GraphQL
      query returns the same 5 records (order differs — not currently relied on by any consumer).
      **Also surfaced, not a watchtower bug**: console's locally-run Strapi shows `publishedAt`
      shifted by -5:30 vs. watchtower's for the same row. Root cause confirmed via raw SQL
      (`published_at::text` with session forced to UTC): the true stored value matches watchtower's
      output exactly; the local dev Postgres instance's session timezone happens to be `Asia/Calcutta`,
      and Strapi's knex-based reads apply that offset when serializing to ISO, while Prisma treats the
      naive `timestamp` column as UTC (no conversion) — the more common convention, and what Neon
      (UTC by default) will do too. This is an artifact of this one dev machine's local Postgres
      timezone config, not a real prod-parity gap; no code change made.

## Phase 3 — Admin panel (`/admin`) — DONE (core flows)
- [x] Confirmed `@strapi/design-system` v2.2.3 actually renders under React 19 / Next 16 despite its
      declared peer dep being React 18 (smoke-tested with Table/Button/Typography before building on it —
      no runtime errors, styled-components classes generated correctly).
- [x] `middleware.ts` — IP allowlist gate for `/admin/**` only, unconfigured = pass-through (must set
      `WATCHTOWER_ADMIN_ALLOWED_IPS` before real deployment).
- [x] `src/lib/auth/admin-session.ts` — bcrypt check against the existing `admin_users` table (no
      password reset needed), JWT session (`ADMIN_JWT_SECRET`, watchtower-only, separate from API-token
      auth per the locked decision). `/admin/login` (Server Action `loginAction`, httpOnly cookie),
      `/admin/(dashboard)/layout.tsx` redirects to login if the session cookie is missing/invalid.
      Verified via `scripts/verify-admin-auth.ts` against a disposable test admin user (correct/incorrect/
      unknown credentials, JWT round-trip, tampered-token rejection) — cleaned up afterward, the real
      admin account untouched.
- [x] `src/app/admin/(dashboard)/DashboardChrome.tsx` — sidebar using `@strapi/design-system`'s actual
      `SubNav`/`SubNavSection`/`SubNavLink` (the same components Strapi's own content-manager sidebar
      uses), grouped Collection Types / Single Types / Media, driven entirely by the schema registry.
- [x] `content-manager/[type]` list view — `Table` with scalar columns, draft/published `Badge`,
      pagination, "Create new entry". SingleTypes redirect straight to their edit view (no list),
      matching Strapi's UX.
- [x] `content-manager/[type]/[id]` edit view — one recursive `AttributeField` renderer
      (`AttributeField.tsx`) driven by the same schema registry as everything else: scalars (text/
      textarea/number/toggle/enum-select), components (single + repeatable, with nested components
      inside components), dynamic zones (block-type picker + per-block sub-forms), relations
      (single/multi-select against preloaded target options). Save/Publish/Unpublish via Server Actions
      (`actions.ts`) calling the same `entity-repository` functions Phase 1/2 already verified.
      **Known simplification**: media fields are a raw file-ID reference, not a real upload widget (see
      media library note below).
- [x] `/admin/media-library` — lists existing `files` rows (thumbnails for images) read directly via
      Prisma; no upload flow yet (uploads still need to go through Cloudinary — this is the one
      substantial Phase 3 piece left unbuilt).
      Verified end-to-end via `next dev` + curl with a hand-signed session cookie (bypassing the login
      form's client-JS-dependent progressive-enhancement encoding, which curl can't replicate): auth
      redirect when unauthenticated, list view with real data, new-entry form, existing-entry edit form,
      singleType edit form — all render correctly with no server errors. Full create/update/publish/
      unpublish cycle verified via `scripts/verify-admin-actions.ts` (calling the Server Actions
      directly, swallowing the expected `revalidatePath`-outside-a-request-context error) against a
      disposable test entry, cleaned up afterward.
- [ ] **Not done**: real media upload widget (Cloudinary), and an actual click-through in a real browser
      (this environment has no browser tool — rendering/logic were verified via curl + direct Server
      Action calls, which is as close as this session could get).

### Phase 3 follow-up — field-type UX rework + closer visual parity
User feedback after the first pass: media fields showed raw file IDs, relations showed plain
multi-selects instead of a searchable list linking to the related entry, dynamic zone blocks were
always expanded with no reordering, and the overall chrome didn't look like Strapi's. Researched
Strapi's actual admin source (`@strapi/content-manager`/`@strapi/upload` in `console/node_modules` —
readable, not obfuscated) rather than guess, then reimplemented:
- [x] **Media fields**: real thumbnail preview (`MediaThumb`) instead of a numeric ID, with a `Modal`-
      based picker (`MediaPickerModal`) listing existing `files` as a grid — click to select, click the
      remove icon to clear. **Simplification**: picks from already-uploaded files only; no drag-drop
      upload/crop flow like Strapi's `UploadAssetDialog` (still needs Cloudinary wiring — see above).
- [x] **Relations**: `Combobox` (type-to-filter) for adding, selected entries render as a linked list
      below (`RelationField`) — each row links to `/admin/content-manager/{targetSlug}/{documentId}`
      (Strapi actually opens an in-context `RelationModal` instead of navigating away; a real page
      link was the pragmatic choice here) plus a remove button and up/down reorder for multi-relations.
      **Simplification**: reorder is button-based, not drag-and-drop like Strapi's `useDragAndDrop` —
      functionally equivalent, far less risk to implement correctly.
      `relationOptions` now carry `documentId`/`targetSlug` (added in `page.tsx`) so the link can be built.
- [x] **Dynamic zone + repeatable components**: shared `CollapsibleBlock` (one independent
      `Accordion.Root` per item — closed by default, matching Strapi's `collapseToOpen` pattern) with
      move-up/move-down/delete actions in the header (Strapi has both drag-and-drop *and* these buttons;
      buttons only here). "Add a component" reveals a simple picker of the zone's allowed component
      types (Strapi's `ComponentPicker`, simplified to a flat button list instead of grouped categories).
- [x] **Global nav rail**: added `GlobalNavRail.tsx` — the outer icon rail Strapi's real admin has
      (`@strapi/admin`'s `MainNav`/`NavBrand`/`NavUser`, confirmed via source: white background,
      border-right, ~4rem wide, top logo, `Content Manager`/`Media Library` icon links, bottom user-
      avatar menu with sign out) — this was structurally missing before; `DashboardChrome` now composes
      [rail][content-manager SubNav (shown only under /admin/content-manager)][content].
- [x] **Font-family bleed fix**: the landing page's `next/font` Outfit class on `<body>` (shared root
      layout) was outranking the design system's own font via CSS specificity (class beats element
      selector). Fixed with an inline `font-family` style on `AdminThemeProvider`'s wrapper (inline
      styles beat classes) restoring Strapi's actual font stack under `/admin` without touching the
      landing page.
- [x] **Bug fixes caught during this verification pass**: Prisma `Decimal` columns (e.g. prices) aren't
      React-Flight-serializable — passing them straight from a Server Component to a Client Component
      threw/warned (`entity-repository.ts` now coerces `decimal`-typed scalars to `Number` in both
      `hydrateAttributes` and `shallowScalars`; REST/GraphQL never hit this since `JSON.stringify`
      silently calls Decimal's `toJSON()`). Also fixed `/admin/media-library` mixing server-only
      `prisma` access with client-only `@strapi/design-system` components in one file — split into a
      Server Component (`page.tsx`, data fetching) and Client Component (`MediaLibraryView.tsx`,
      rendering).
- Verified all of the above against real data via `next dev` + curl with a hand-signed session cookie:
  device-type edit (relations combobox+list), page edit (dynamic zone with all 7 block types), and
  subscription-addon edit (media picker) all render correctly with zero server errors/warnings.

## Phase 4 — Deploy & cutover
- [x] Prisma config for Vercel's runtime: added `binaryTargets = ["native", "rhel-openssl-3.0.x"]` to
      the generator block (Vercel's serverless Node.js functions run on Amazon Linux/glibc, not
      Windows — without this only the local dev engine gets bundled). Added `"postinstall": "prisma
      generate"` to `package.json` so the client regenerates automatically on every install (Vercel
      runs `install` then `build`; without this the build would use a stale/missing client). Confirmed
      `fix-prisma-schema.js` only rewrites `model` blocks, so this survives future `prisma:pull` runs.
- [x] Two Vercel projects under the `devops-serwises-projects` team, mirroring nexus's existing
      convention (separate project per environment, not one project with branch-based Preview/Prod):
      `watchtower` (prod) and `watchtower-dev`. Each has its own distinct `ADMIN_JWT_SECRET` and
      `API_TOKEN_SALT` (generated fresh, never shared between environments or with local dev values)
      plus `CLOUDINARY_NAME`/`CLOUDINARY_KEY`/`CLOUDINARY_SECRET` copied from console's existing
      account (same account, per the locked media-storage decision) — all set on the Production
      environment of each project via `vercel env add`.
      Both deployed successfully (`vercel deploy`) and respond (200) at their default `.vercel.app`
      URLs: `watchtower-gules.vercel.app` (prod project) and `watchtower-dev-five.vercel.app` (dev
      project) — confirms the build pipeline works even with no `DATABASE_URL` set yet, since every
      DB-touching route is dynamic (`ƒ`), not statically prerendered.
- [ ] **Blocked on user**: `DATABASE_URL`/`DIRECT_URL` for both environments — needs the Neon
      migration first (user is setting this up and will provide connection strings). Until set, any
      request that touches the DB (everything except `/` and `/admin/login`'s initial render) will 500.
- [ ] **Blocked on user (or a Pro-plan upgrade)**: custom domains (`watchtower.serwise.co.in`,
      `watchtower.dev.serwise.co.in`). `vercel domains add` failed with `domain_not_owned` — Vercel
      needs to verify DNS control over `serwise.co.in` at the team level, which nexus's setup may have
      only granted access to nexus's own project rather than the team overall (nexus.serwise.co.in
      already works). This needs the user's action in the Vercel dashboard, not something fixable via
      the CLI without more domain-verification access than this session has.
- [ ] **Note**: GitHub auto-deploy integration failed — "the repository is private and owned by an
      organization, which is not supported on the Hobby plan." nexus's projects show the same
      constraint (their env vars didn't hint at git integration either), so deploys for this whole team
      are apparently already CLI-triggered (`vercel deploy` / `vercel deploy --prod`), not push-to-deploy.
      Confirmed working that way for watchtower too — just needs someone (or a CI step) to run it.
- [ ] Final parity smoke test against real Neon-migrated data
- [ ] Repoint STRAPI_URL/CMS_URL/NEXT_PUBLIC_CMS_URL/API tokens in nexus, serwise, serwise-website
      (big-bang cutover — requires explicit confirmation before executing)
- [ ] Decommission console

## Dev-environment gotcha (local machine, not a code bug)
This machine accumulates orphaned `node.exe` processes across sessions (found several dating back to
the previous day still running). These can grab port 3000/3001/etc. out from under a freshly-started
`next dev`, or starve its Turbopack workers enough to crash them ("Jest worker encountered N child
process exceptions"), producing confusing 404s/500s that look like real bugs but aren't. Also: nexus's
own dev server apparently defaults to port 3000 too (no `PORT` in its `.env`), so it can collide with
Next's default port. If `next dev` misbehaves and a plain restart doesn't fix it: check
`Get-Process node | Select Id,StartTime` for stale processes, kill them, delete `.next`, and pick an
explicit `-p` port if 3000 is already claimed by something else.

## Root login (`/`) — phone+OTP+passkey — DONE
Replaces the old marketing landing page. `/` is now: login form for unauthenticated visitors,
placeholder details/dashboard page for authenticated ones. Deliberately separate from `/admin`'s
email+password session — an `/admin` login never unlocks `/`, since that would bypass the
compulsory 2FA here.

- [x] 3 new tables (`watchtower_root_operators`, `watchtower_passkey_enrollments`,
      `watchtower_webauthn_credentials`, `watchtower_otp_codes` — 4 total), added via
      `prisma/manual-migrations/0001_watchtower_root_login.sql` (idempotent, re-runnable against
      Neon later). No existing Strapi-owned table/column changed — being present in
      `watchtower_root_operators` **is** the "admin role" gate for root login, keyed to an
      existing `admin_users` row.
- [x] `src/lib/auth/{root-session,hanuotp,otp,operators,webauthn,enrollment}.ts` — OTP logic
      ported from nexus's `AuthService`/`hanuotp.service.ts` (same `HANUOTP_API_KEY`/
      `HANUOTP_TEMPLATE_SID` env vars, same provider account), WebAuthn via
      `@simplewebauthn/server`, two separate JWT cookies (`watchtower_root_pending` short-lived
      post-OTP, `watchtower_root_session` full session — both signed with a new `ROOT_JWT_SECRET`,
      distinct from `/admin`'s `ADMIN_JWT_SECRET`).
- [x] Login flow at `/` (`src/app/root/{LoginForm,DetailsPage,actions}.tsx/ts`): phone → OTP →
      WebAuthn assertion (auto-triggered), all three compulsory. An operator with zero registered
      passkeys is stopped with a message rather than allowed to bootstrap one at the login screen —
      passkeys can only be registered via a pre-approved enrollment link (see below).
- [x] `/enroll/[token]` (`src/app/enroll/[token]/*`) — single-use, 15-minute enrollment link;
      completes a real WebAuthn registration ceremony for the device that opens it.
- [x] `/admin/operators` (`src/app/admin/(dashboard)/operators/*`) — new screen (existing
      email+password `/admin` session required) to link a phone number to an `admin_users` row,
      generate enrollment links, and revoke passkeys. Added to `GlobalNavRail.tsx`.
- [x] Verified via `scripts/verify-root-login.ts` (20 checks, self-cleaning: disposable
      `admin_users`/operator/OTP/enrollment/credential rows, confirmed zero leftover rows
      afterward) — operator gating (unknown/inactive numbers rejected), OTP verify/reuse/attempts
      logic, JWT round-trips (pending vs. session tokens are not interchangeable), full enrollment
      token lifecycle (valid/used/expired/unknown), WebAuthn option-builder shape (RP ID,
      exclude/allow credential lists) and credential revoke. Manually smoke-tested with `next dev`:
      `/` renders the login form logged-out (200), `/admin` redirects to login (307),
      `/enroll/<bogus-token>` shows the invalid-link message.
      **Known simplification**: the verify script does not run a real cryptographic WebAuthn
      ceremony (no virtual-authenticator helper is exported by the installed
      `@simplewebauthn/server` version) — the actual passkey registration/authentication ceremony
      needs a manual pass in a real browser with a platform authenticator (Windows Hello/Touch ID),
      not yet done in this environment (no browser tool available here, same limitation noted for
      the `/admin` panel above).

---
*Last updated: Phase 0 in progress.*
