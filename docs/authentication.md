# Authentication — Reference (Watchtower)

Watchtower is architecturally different from serwise/radix: it does **not** use nexus's `/api/auth/*` phone/OTP contract at all. It has **three separate, self-contained auth mechanisms**, and talks to nexus only for data (via its own service-to-service JWT). Read this before touching any login/session/token code here — none of nexus's or the other apps' auth docs apply to this codebase.

Last verified against the codebase: 2026-09-07. There is **no `middleware.ts`** anywhere in this app — every protected page/action guards itself individually. Keep that in mind: there's no single choke point to add a global check to.

---

## 1. The Three Mechanisms, At a Glance

| # | Who uses it | Login method | Session | Cookie |
|---|---|---|---|---|
| 1 | Root panel operators (`/`, `/tickets`, `/customers`, etc.) | Phone → OTP → WebAuthn/passkey | `ROOT_JWT_SECRET`-signed JWT, 7 days | `watchtower_root_session` |
| 2 | CMS admins (`/admin/*`) | Email + password (bcrypt) | `ADMIN_JWT_SECRET`-signed JWT, 7 days | `watchtower_session` |
| 3 | Machine callers (`/api/*`, `/graphql`) | Static bearer API token (Strapi-compatible) | None — stateless per-request | N/A |

Mechanisms 1 and 2 both ultimately point at the same underlying `admin_users` table (a root operator row has an `admin_user_id` FK), but their login/session/verification code paths are fully independent — one account *can* be both a CMS login and a root-panel login, but nothing in the code assumes that pairing.

Watchtower also calls **nexus** for data (customers, providers, devices, complaints) via `src/lib/nexus/client.ts`'s `nexusFetch` — this mints its own short-lived service JWT (`role: 'ADMIN'`, signed with `NEXUS_JWT_SECRET`) and is unrelated to any of the three mechanisms above; it never touches nexus's user-facing `/api/auth/*` endpoints.

---

## 2. Mechanism 1 — Root Panel (Phone → OTP → Passkey)

Entry point: `src/app/page.tsx` (route `/`) — reads `watchtower_root_session`, calls `verifyRootSession`; valid → `redirect('/tickets')`; else renders `LoginForm.tsx`.

### 2.1 Step 1 — Phone → OTP request
`requestOtpAction` (`src/app/root/actions.ts:24-31`) → `requestOtp(phoneNumber)` (`src/lib/auth/otp.ts:19-42`):
- Normalizes the phone (`src/lib/auth/operators.ts:3-6`), looks up an **active** `watchtower_root_operators` row by phone — no match → `'This number is not authorized for Watchtower access'` (`otp.ts:22`), deliberately non-enumerating.
- Generates a 6-digit code via `Math.random()` (`otp.ts:24`) — **not a CSPRNG** (see §7.2), bcrypt-hashes it (cost 10), upserts into `watchtower_otp_codes`, 10-minute TTL (`OTP_TTL_MINUTES`, `otp.ts:6`), resets `attempts: 0`.
- **Test-phone bypass** (`otp.ts:10-14`): `1234567890`, `9112345678`, `7016301968` → fixed OTP `123456`, no SMS sent — explicitly "kept in sync with nexus/src/services/auth.service.ts TEST_PHONES" per the code comment. This is a **separate, duplicated list**, not a shared import from nexus — if nexus's list ever changes, this one has to be updated by hand.
- Otherwise sends via `sendOtpSms` (`src/lib/auth/hanuotp.ts:9-36`) — a second, independent HanuOTP integration, "ported from nexus's hanuotp.service.ts, same provider/account" (comment at `hanuotp.ts:8`). Not a shared call into nexus — a completely separate HTTP call from watchtower's own server.

### 2.2 Step 2 — OTP verification
`verifyOtpAction` (`src/app/root/actions.ts:39-57`) → `verifyOtp` (`otp.ts:48-87`). Same shape as nexus's own OTP verification (not found/expired/max-attempts/invalid, in that check order) — see `otp.ts:50-70`. On match: deletes the OTP row (single-use), re-resolves the operator (defensive re-check in case deactivated mid-flow), counts existing WebAuthn credentials (`hasCredentials`).

On success, a short-lived **pending** cookie is set — `watchtower_root_pending`, 5 minutes (`ROOT_PENDING_MAX_AGE`, `root-session.ts:6,56`), JWT payload `{ operatorId, purpose: 'root-2fa-pending' }` signed with `ROOT_JWT_SECRET`. This is the bridge between "phone verified" and "passkey ceremony" — nothing is a real session yet.

If `!hasCredentials`, the UI dead-ends at a "ask an admin for an enrollment link" message (`LoginForm.tsx:159-164`) — **there is no self-service enrollment initiation from the login screen.**

### 2.3 Step 3 — WebAuthn/passkey ceremony
`runPasskeyCeremony` (`LoginForm.tsx:49-63`):
1. `getAssertionOptionsAction()` re-validates the pending cookie, builds WebAuthn authentication options (`src/lib/auth/webauthn.ts:111-125`), signs the challenge into a 120s cookie `watchtower_webauthn_challenge` (payload `{ operatorId, challenge, purpose: 'webauthn-challenge' }`, also `ROOT_JWT_SECRET`).
2. Browser runs `startAuthentication()` (`@simplewebauthn/browser`).
3. `verifyAssertionAction(response)` re-derives the pending operator, verifies the challenge cookie, looks up the stored credential by `credential_id` and **checks it belongs to this operator** (`webauthn.ts:129-131` — this is what stops one operator's assertion being replayed against another's pending session), then delegates to `@simplewebauthn/server`'s `verifyAuthenticationResponse` (counter-based anti-cloning is handled inside that library call).
4. On success: deletes both short-lived cookies, signs the real session.

### 2.4 Session issuance
`signRootSession(operatorId, adminUserId)` (`root-session.ts:41-44`) — JWT payload `{ operatorId, adminUserId, purpose: 'root-session' }`, `ROOT_JWT_SECRET`, 7-day expiry. Cookie `watchtower_root_session`: `httpOnly`, `secure` in production, `sameSite: 'lax'`, `path: '/'`, `maxAge: 604800`.

### 2.5 Logout
`logoutRootAction` (`src/app/root/actions.ts:114-118`) — deletes `watchtower_root_session`, redirects to `/`. Does not clear the pending/challenge cookies, but those self-expire in 5 min/120s so this is low-risk.

There's a second logout-shaped route, `GET /api/force-logout` (`src/app/api/force-logout/route.ts:9-14`) — clears both `watchtower_root_session` and `watchtower_root_pending`. This exists specifically because `nexusFetch` (Server Component context) can't mutate cookies directly, so it redirects here on a nexus 401 instead.

---

## 3. Mechanism 2 — CMS Admin (Email/Password)

Entry point: `/admin/login` → `src/app/admin/login/page.tsx`.

`loginAction` (`src/app/admin/login/actions.ts:11-31`):
- `verifyAdminCredentials(email, password)` (`src/lib/auth/admin-session.ts:38-44`) — looks up `admin_users` by `{ email, is_active: true, blocked: false }`, `bcrypt.compare`. Any failure (no user, no password hash, mismatch) → the same generic `'Invalid email or password'` (`actions.ts:18`) — correctly doesn't distinguish "no such user" from "wrong password."
- Success → `signSession({ sub: user.id, email })`, `ADMIN_JWT_SECRET`, `expiresIn: '7d'`. Cookie `watchtower_session`: same flags as the root session, but the `60*60*24*7` maxAge is a **hardcoded literal here** rather than a shared named constant (unlike `root-session.ts`'s exported `ROOT_SESSION_MAX_AGE`).
- `redirect('/admin/content-manager')`.

### Session verification
`src/app/admin/(dashboard)/layout.tsx:14-17` is the **single choke point** for the whole `/admin/(dashboard)/*` tree — the closest thing to middleware in this app, but it's a route-group layout, not `middleware.ts`. Server Actions under that tree additionally self-guard via a local `requireAdminSession()` helper (`operators/actions.ts:10-16`, `users/actions.ts:8-14`) as defense-in-depth, since Server Actions can in principle be invoked directly, bypassing a layout that only runs on page navigation.

### Logout
`logoutAction` (`admin/login/actions.ts:33-37`) — deletes `watchtower_session`, redirects to `/admin/login`. Simple, correct.

---

## 4. Mechanism 3 — API Tokens (Strapi-Compatible)

Not a login — no cookie, no session. Per-request `Authorization: Bearer <token>` verification against the pre-existing Strapi-shaped `strapi_api_tokens` / `strapi_api_token_permissions*` tables (this app replicates Strapi's own `admin::api-token` scheme byte-for-byte, per the comment at `src/lib/auth/api-token.ts:19-23`).

- `hashToken` (`api-token.ts:24-26`): `HMAC-SHA512(rawToken, API_TOKEN_SALT)`.
- `authenticateApiToken(header)` (`api-token.ts:39-65`): extracts `Bearer <token>`, hashes it, looks up `access_key`, checks expiry, throttled `last_used_at` bump (only if >1h since last bump).
- `authorizeApiToken(token, contentTypeUid, scope)` (`api-token.ts:75-89`): `full-access` → always true; `read-only` → find/findOne only; `custom` → exact permission-row match; anything else → false.

**Enforced on the REST catch-all** (`src/app/api/[...slug]/route.ts`) at every verb — both authenticate *and* authorize per call.

**Enforced differently on GraphQL** (`src/app/graphql/route.ts:12-18`) — the `context()` callback only calls `authenticateApiToken`, **never `authorizeApiToken`**. This is a real gap: a valid `read-only` or scope-limited `custom` token can execute any GraphQL operation the schema allows, bypassing the scope model the REST path enforces. See §7.1.

No logout concept — revocation is deleting/expiring the `strapi_api_tokens` row directly (no in-app UI for this was found; presumably managed the same place console/Strapi's own token UI lives, or directly in the DB).

---

## 5. Enrollment (New Root Operator Setup)

Admin-initiated, not self-service. Flow:

1. **Provisioning** (`/admin/operators`, admin-session-guarded): `createOperatorAction` links an existing `admin_users.id` to a phone number (`watchtower_root_operators` row).
2. **Enrollment link**: `generateEnrollmentAction` → `createEnrollment` (`src/lib/auth/enrollment.ts:6-13`) — a proper CSPRNG token (`crypto.randomBytes(24)`, unlike the OTP code), 15-minute TTL, stored in `watchtower_passkey_enrollments`. Link = `${WEBAUTHN_ORIGIN}/enroll/${token}`.
3. **Operator visits `/enroll/[token]`**: `checkEnrollment` validates (not-found / already-used / expired), renders `EnrollForm`.
4. **Passkey registration ceremony**: `getRegistrationOptionsAction` → `buildRegistrationOptions` (excludes already-registered credentials) → browser `startRegistration()` → `completeEnrollmentAction` → `verifyRegistration` (`webauthn.ts:73-105`) inserts the new `watchtower_webauthn_credentials` row and `markEnrollmentUsed` makes the link single-use.
5. Redirects to `/` to log in for real.

Revocation (`revokeCredentialAction`, admin-session-guarded) hard-deletes the credential row — **there is no operator self-revoke for a lost device**, only an already-authenticated CMS admin can do it.

---

## 6. Route Protection Summary

| Surface | Guard | Mechanism |
|---|---|---|
| `/`, `/tickets`, `/customers`, `/customers/[id]`, `/providers`, `/pricing`, `/device-types`, `/provider-tiers`, `/audit-log`, `/cms` | Each page independently: read cookie → `verifyRootSession` → `redirect('/')` if null | Root session |
| `/admin` (index) | Dispatches to `/admin/content-manager` or `/admin/login` based on session | Admin session |
| `/admin/(dashboard)/*` | `layout.tsx:14-17` — the one real choke point | Admin session |
| Admin server actions (operators, users) | `requireAdminSession()` helper, per-action | Admin session (defense-in-depth) |
| `/api/[...slug]` | `authorize()` helper, authenticate + scope-authorize, every verb | API token |
| `/graphql` | Authenticate only, **no scope check** (§7.1) | API token |
| `/enroll/[token]` | `checkEnrollment` (not a session — a one-time token) | Enrollment token |

Every JWT-verify helper (`verifyRootSession`, `verifySession`, the WebAuthn challenge verifiers) uses a blanket `catch { return null }` — "expired," "tampered," and "wrong purpose" are all indistinguishable to the caller. Defensible for not leaking specifics, but makes debugging session issues harder (see §7.6).

---

## 7. Known Gaps / Remaining Work

Split the way the nexus doc does — small/contained vs. bigger/deliberate — so a future security pass doesn't have to rediscover these from scratch. **This app has real, live security gaps** (unlike serwise/radix's client-only findings), so treat this section as higher-priority reading than the equivalent section in the other three docs.

### 7.1 Basic — should fix soon, contained scope

- [ ] **GraphQL never calls `authorizeApiToken`.** `src/app/graphql/route.ts:12-18` authenticates but doesn't scope-check — a `read-only` or restricted `custom` token can run any GraphQL query/mutation the schema exposes. The REST catch-all does this correctly (`api-token.ts:75`, called per-verb); GraphQL needs the equivalent, likely via a resolver-wrapping or field-level check since Yoga's `context()` only runs once per request, not per-field.
- [ ] **`API_TOKEN_SALT` unset throws uncaught inside `authenticateApiToken`** (`api-token.ts:40-41`), bypassing its own `{authenticated:false}` contract — a missing env var would surface as an unhandled 500 instead of a clean 401. Wrap it.
- [ ] **`requirePendingOperator()`'s specific error message gets swallowed** in the passkey ceremony's generic `try/catch` (`LoginForm.tsx:49-63`) — a legitimately expired phone-verification step shows "Passkey ceremony was cancelled or failed on this device" instead of "start over," which sends the user down the wrong troubleshooting path. Have the client distinguish this thrown error from a genuine WebAuthn ceremony failure.
- [ ] **Hardcoded 7-day literal in `admin/login/actions.ts:27`** instead of a shared exported constant (root-session.ts already has `ROOT_SESSION_MAX_AGE` for this exact purpose) — cosmetic but easy to fix, and prevents the two session lifetimes silently drifting apart if one is ever changed without noticing the other.
- [ ] **Confirm none of the three hardcoded test phone numbers (`1234567890`, `9112345678`, `7016301968`) are real operators' phones in production data.** The bypass is gated on the number *also* being an active operator row, so this is low-actual-risk today, but it's an easy thing to accidentally violate later when provisioning a new operator.

### 7.2 Advanced — bigger effort, security-relevant, do deliberately

- [ ] **No rate limiting anywhere** (confirmed via repo-wide grep, zero hits) — OTP requests, OTP verify attempts, and CMS password login attempts are all unthrottled beyond the per-OTP-record 5-attempt cap (which resets on every new OTP request, so it's not a real brake on a determined attacker). This is the same gap flagged for nexus (nexus docs §8.1) but arguably more urgent here since a CMS admin password is a much higher-value target than a customer's OTP.
- [ ] **OTP code uses `Math.random()`, not a CSPRNG** (`otp.ts:24`). Weak for a 6-digit auth code on its own merits, though mitigated by bcrypt-at-rest + 10-min TTL + attempt cap. Swap for `crypto.randomInt()`.
- [ ] **No session revocation.** Both session types are stateless 7-day JWTs with no DB-backed session table, no `jti`, no revocation list. Deactivating an operator or admin user does **not** invalidate their already-issued session — they stay logged in up to 7 more days. Revoking a WebAuthn credential doesn't touch existing sessions either, only blocks future logins. If "deactivate this admin immediately" is ever a real operational need, this needs a session table + a per-request revocation check (accepting the latency/complexity tradeoff), not just a JWT `exp` claim.
- [ ] **`nexusFetch`'s 401-handling conflates "operator session is bad" with "NEXUS_JWT_SECRET is misconfigured on either side."** Both currently force-logout every root operator simultaneously (the code's own comment at `client.ts:55-60` acknowledges this as a known, accepted tradeoff) — a secret rotation or clock-skew issue on either service would look like a mass session-expiry incident. Worth a distinct "nexus unreachable/misconfigured" state if this ever actually happens in practice.
- [ ] **No CSRF token mechanism** beyond Next.js Server Actions' same-origin protections + `sameSite: 'lax'` cookies. Reasonable default for this app shape, but should be an explicit, documented decision rather than an implicit one if this app's threat model ever gets a formal review.
- [ ] **`checkEnrollment` is check-only, not atomic-consume** — called 3 separate times across the enrollment flow before the final `markEnrollmentUsed`. A narrow TOCTOU window exists where two concurrent completions of the same not-yet-consumed token could both attempt registration. Low real-world likelihood, but if enrollment is ever exposed more broadly (e.g. bulk operator onboarding), make the final consume step atomic (a single `UPDATE ... WHERE used_at IS NULL RETURNING ...`) rather than check-then-act.
- [ ] **Audit log actor attribution silently degrades to `null`** on any unexpected session-verify error (`src/lib/audit/log.ts:7-20`, swallowing try/catch) — could quietly produce unattributed audit rows instead of failing loudly. If audit trail integrity matters for compliance, this should probably fail the write (or at least alert) rather than silently proceed with `null` actor fields.

---

## 8. Environment Variables

| Variable | Purpose |
|---|---|
| `ROOT_JWT_SECRET` | Signs/verifies root pending tokens, root session JWTs, and WebAuthn challenge tokens (all three share this secret). |
| `ADMIN_JWT_SECRET` | Signs/verifies the CMS admin session JWT. |
| `API_TOKEN_SALT` | HMAC-SHA512 salt for hashing incoming bearer tokens (Strapi-compatible scheme). |
| `HANUOTP_API_KEY` | HanuOTP SMS provider key for root-login OTP delivery — separate credential/integration from nexus's own. |
| `HANUOTP_TEMPLATE_SID` | HanuOTP SMS template ID (defaults to `'default'`). |
| `WEBAUTHN_RP_ID` | WebAuthn Relying Party ID (domain). |
| `WEBAUTHN_RP_NAME` | WebAuthn Relying Party display name (defaults to `'Watchtower'`). |
| `WEBAUTHN_ORIGIN` | Expected WebAuthn origin — also reused as the base URL for `/enroll/{token}` links, so it must exactly match the public URL admins expect operators to open. |
| `NEXUS_JWT_SECRET` | Signs the short-lived service JWT watchtower mints to call nexus's data API — must match nexus's own verification secret. |
| `NEXUS_API_URL` | Base URL for nexus's data API. |
| `NODE_ENV` | Controls the `secure` cookie flag across all three mechanisms (`true` only in production). |

---

## 9. File Map

```
src/app/page.tsx                                    — "/" root login entry, redirects if already logged in
src/app/root/LoginForm.tsx                          — phone → OTP → passkey UI state machine
src/app/root/actions.ts                             — root login server actions, cookie management, logout
src/lib/auth/otp.ts                                 — OTP gen/verify against watchtower_otp_codes, test-phone bypass
src/lib/auth/hanuotp.ts                              — HanuOTP SMS integration (separate from nexus's own)
src/lib/auth/operators.ts                           — watchtower_root_operators CRUD/lookup
src/lib/auth/webauthn.ts                             — all WebAuthn logic: challenges, registration, authentication, revocation
src/lib/auth/root-session.ts                        — root session/pending cookie names, TTLs, JWT sign/verify
src/lib/auth/enrollment.ts                          — enrollment token lifecycle (create/check/mark-used)
src/app/enroll/[token]/{page,actions,EnrollForm}.tsx — passkey enrollment/registration flow
src/app/api/force-logout/route.ts                    — clears root cookies from contexts that can't mutate them directly
src/app/tickets/, customers/, providers/, pricing/, device-types/, provider-tiers/, audit-log/, cms/ (page.tsx each) — root-session-protected pages, each self-guarding
src/app/admin/login/{page,actions}.tsx              — CMS email/password login + logout
src/lib/auth/admin-session.ts                       — admin cookie name, JWT sign/verify, credential check
src/lib/auth/admin-users.ts                          — admin_users CRUD
src/app/admin/page.tsx                              — "/admin" dispatcher
src/app/admin/(dashboard)/layout.tsx                — the one real choke-point guard for the CMS admin area
src/app/admin/(dashboard)/operators/actions.ts      — operator management (admin-session-guarded)
src/app/admin/(dashboard)/users/actions.ts          — admin_users management (admin-session-guarded)
src/lib/auth/api-token.ts                            — Strapi-compatible API token hash/authenticate/authorize
src/app/api/[...slug]/route.ts                      — REST catch-all, authenticates + authorizes per verb
src/app/graphql/route.ts                             — GraphQL endpoint, authenticates only (see §7.1 gap)
src/lib/audit/log.ts                                 — audit log writer, reads root session cookie for actor attribution
src/lib/nexus/client.ts                              — nexusFetch: mints service JWT, calls nexus for data, force-logout on 401
docs/authentication.md                               — this file
```

---

## 10. Change Log

- **2026-09-07** — Initial documentation pass. No code changes made to watchtower in this session — this doc was written from a direct code audit alongside the nexus/serwise/radix authentication docs. §7 gaps (especially §7.1's GraphQL authorization gap and §7.2's rate-limiting/session-revocation gaps) are pre-existing and unaddressed; flagging them here is the first record of them.
