# Pricing Migration + Global Audit Log — Tracking

Plan: see conversation / `C:\Users\Admin\.claude\plans\splendid-mapping-eich.md` at time of writing.

## 1. Audit log table
- [x] `prisma/manual-migrations/0002_watchtower_audit_log.sql` written
- [x] Applied against local DB
- [x] `yarn prisma:pull` run, `watchtower_audit_logs` model present in `prisma/schema.prisma`
- [ ] `npx tsc --noEmit` clean (recheck after all sections)

## 2. Shared logging helper
- [x] `src/lib/audit/log.ts` — `getActor`, `diffFields`, `logAudit`

## 3. Instrument entity-repository.ts
- [x] `createEntity` logs CREATE
- [x] `updateEntity` fetches before, logs UPDATE with diff
- [x] `deleteEntity` fetches before, logs DELETE

## 4. Pricing page
- [x] `app/pricing/page.tsx` (sequenced fetches, device-type options via direct prisma query)
- [x] `app/pricing/PricingView.tsx` (tabs: Plans / Addons / Parts, popup-on-row-click, red CTA delete)
- [x] Visit-services / features repeater editors (dedicated, not a generic RepeaterField — simpler given only 2 fixed shapes)
- [x] `app/pricing/actions.ts` (create/update/delete for all three UIDs + image upload for addon)
- [x] Nav entry in `RootSidebar.tsx`
- [x] Bonus fix: `entity-repository.ts`'s `listEntities` row hydration sequenced (was Promise.all'd — root cause of the earlier P2024 pool-exhaustion incident, now fixed for every content type, not just Device Types)

## 5. Instrument nexus-backed actions
- [x] `app/providers/actions.ts`
- [x] `app/customers/actions.ts` + `app/customers/[id]/actions.ts`
- [x] `app/tickets/actions.ts`
- [x] `app/provider-tiers/actions.ts`

## 6. Audit Log UI
- [x] `app/audit-log/page.tsx` (searchParams-driven filtering + pagination)
- [x] `app/audit-log/AuditLogView.tsx` (filter bar, table, diff-view popup)
- [x] Nav entry in `RootSidebar.tsx`

## Verification
- [x] Full `npx tsc --noEmit` clean in watchtower
- [x] `npx eslint` clean on all new/changed files
- [ ] Manual: Device type create/edit/delete logs correctly (needs a running dev server + DB — not run in this session)
- [ ] Manual: Pricing plan/addon/part create/edit logs correctly
- [ ] Manual: Provider/Customer/Ticket/Provider-Tier actions log correctly
- [ ] Manual: `/audit-log` filters work, diff popup readable

Code-complete. Manual click-through verification still needed once deployed/running — flagged to the user.
