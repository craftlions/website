# S-002 — Spend by year

**Goal** — A per-year, per-project spend section on the org dashboard, computed by Postgres aggregation over Stripe-dated invoices, reaching [O-002](../outcomes/O-002-year-over-year-spend.md) (self-served year-over-year spend).

## Requirements

1. `invoices.invoicedAt` (timestamptz, not null) holds the Stripe invoice's `created` moment; ids keep row-creation semantics per [D-uuidv7-primary-keys](../decisions/D-uuidv7-primary-keys.md) (ids never carry domain dates).
2. Recording a phase invoice fetches the Stripe invoice by the entered Stripe id and stores its `created` as `invoicedAt` — never entered by hand.
3. Import sets `invoicedAt` on insert and on re-import of an existing invoice; refresh re-persists it; import no longer back-stamps ids.
4. Migration backfills existing rows' `invoicedAt` from their id timestamps; the next import/refresh corrects them to Stripe's dates.
5. Org dashboard shows a Spend section: a vertical bar per calendar year from the first invoice's year through the current year, chronological left → right, each labeled with its exact year total; gap years keep their axis slot at zero height; no invoices → the existing empty-state line.
6. Bars stack by project (invoice → phase → project); phase-less spend forms a single Unassigned segment; a legend maps segments to projects; plain totals — no deltas, no past-year budgets.
7. A year's numbers sum org invoices by `invoicedAt` year, `stripeStatus` `void`/`uncollectible` excluded, produced by one Drizzle core `select().groupBy()` (year × project) — Postgres aggregates, the worker only renders.
8. Overview's "Invoiced this year" equals the Spend section's current-year total — same definition and query result, replacing today's phase-linked-only sum.
9. Org and project invoice lists display and sort by `invoicedAt`, replacing uuid-derived dates.

## Constraints

- Totals are EUR-only (existing formatter assumption); non-EUR invoices out of scope.
- The group-by is the sole core-select read; every other read stays RQB v2 (RQB has no aggregate support).
- Section is server-rendered on the worker; no client JS added.
- Chart stays in the neutral paper-and-ink vocabulary — segment fills use tones/patterns, state colors remain reserved for state (DESIGN.md); year totals and project breakdown reach assistive tech semantically, not only as drawn bars.
- Recording gains a Stripe dependency: Stripe unreachable → recording fails with the existing StripeUnavailable error, nothing written.
- Running the import per org (history backfill execution) is operations, outside this spec.

## Acceptance criteria

| # | Proves | Verification | Check |
| - | ------ | ------------ | ----- |
| 1 | R2 | manual | Record a phase invoice whose Stripe `created` is last year → `invoicedAt` = Stripe's date, id timestamp ≈ now |
| 2 | R3, R4 | manual | Re-run import on an org with backfilled dates → every imported invoice's `invoicedAt` matches Stripe `created` |
| 3 | R7 | manual | Void invoice → absent from its year's total, project lines, and Overview stat |
| 4 | R6 | manual | Imported phase-less invoice counts under Unassigned in its year; phase-linked under its project |
| 5 | R8 | manual | Org with phase-linked + imported invoices this year → Overview stat equals current-year row |
| 6 | R5 | manual | Invoices only in 2023 and 2025 → 2024 keeps its axis slot at zero; org without invoices → empty-state line |
| 7 | R9 | manual | Invoice list order and shown dates follow `invoicedAt`, not id time |
| 8 | R2 (failure) | manual | Stripe unreachable during recording → StripeUnavailable error, no invoice row written |
