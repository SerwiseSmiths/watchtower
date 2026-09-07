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

## 7. Group-wise Part Pricing (Provider Tiers = "Group")

Plan: `C:\Users\Admin\.claude\plans\splendid-mapping-eich.md` (2nd plan in that file's history).

- [x] Nexus: `ServicePartTierPricing` model added to `prisma/schema.prisma` + reverse relation on `ProviderTier`
- [x] Nexus: `types/service-part-pricing.types.ts`
- [x] Nexus: `services/service-part-pricing.service.ts` (listByTier, listByPart, upsert, remove — soft-delete)
- [x] Nexus: `controllers/service-part-pricing.controller.ts` + `routes/service-part-pricing.route.ts`, registered in `routes/index.ts`
- [x] Nexus: migration generated + applied locally (`20260830165402_add_service_part_tier_pricing`) — deploy to dev/prod deferred, needs user confirmation
- [x] Nexus `npx tsc --noEmit` clean
- [x] Watchtower: `lib/nexus/servicePartPricing.ts`
- [x] Watchtower: `app/pricing/page.tsx` fetches provider tiers, passed to `PricingView`
- [x] Watchtower: `app/pricing/actions.ts` — fetch/upsert/reset pricing actions
- [x] Watchtower: `PartsTab` rewrite — Group + Device Type (with "All") filter row, device-type-grouped collapsible sections, inline-editable Sales Price/Expense/Labour/Max Discount with Default-badge fallback + Reset link, computed read-only Gross Profit, name-click opens a detail drawer (description/category/type/visibility/device types/base defaults + delete)
- [x] `npx tsc --noEmit` clean in both nexus and watchtower
- [x] `npx eslint` clean on changed watchtower files (fixed a `react-hooks/set-state-in-effect` violation in `EditableMoneyCell` by switching to an uncontrolled input + `key`-based reset instead of a synced-via-effect controlled input)

Note: Type/Category/Device Type ended up living in the detail drawer rather than as inline table cells — a many-to-many relation (Device Types) doesn't fit a single inline cell, so all three non-pricing fields were kept together in one place rather than splitting the edit surface inconsistently.
