# S-004 — Shared budget consumption

**Goal** — A shared single-organization budget-consumption module and consistent display rules across existing product surfaces, reaching [O-004](../outcomes/O-004-shared-budget-consumption.md) (one trusted figure across the product).

## Requirements

1. One shared server module owns full-history invoice-spend aggregation and budget-consumption derivation; no product surface calculates budget consumption locally.
2. Each module read accepts one organization id and returns its complete spend history grouped per [S-002 R5–R7](./S-002-spend-by-year.md) (UTC calendar year × project, including Unassigned, eligible invoices only).
3. The client organization dashboard calls the module once; its Spend chart, current-year invoice total, remaining budget, and budget consumption derive from the returned rows.
4. The admin landing page calls the module once per organization; the admin organization overview calls it once; both derive budget consumption from the returned current-year rows.
5. The module applies [D-budget-consumption-definition](../decisions/D-budget-consumption-definition.md) (shared current-year definition, uncapped percentage).
6. Every user-facing usage label reads “Budget used.”
7. Budget-use display behavior follows this table:

| Condition | Displayed value | Progress, where rendered | Emphasis |
| --- | --- | --- | --- |
| No positive yearly budget | `No budget` | Absent | Neutral |
| Positive budget, no current-year spend | `0.0%` | `0` | Neutral |
| Usage from 0% through 100% | Percentage to one decimal | Exact percentage | Neutral |
| Usage above 100% | Uncapped percentage to one decimal | Capped at `100` | Existing red warning treatment |

8. Any module read failure aborts the page render; no partial ledger, blank value, or alternate calculation appears.

## Constraints

- Every read returns full history for one organization; no batched or current-year-only query variant.
- No persisted totals, cache, schema change, or new client-side JavaScript.
- Existing layouts and chart structure remain; no shared presentation component.
- Budget setup, invoice ingestion or status refresh, fiscal-year configuration, and chart redesign remain out of scope.

## Acceptance criteria

| # | Proves | Verification | Check |
| --- | --- | --- | --- |
| 1 | R1–R5 | manual | Code review finds invoice aggregation and percentage derivation only in the shared module; all three surfaces consume it. |
| 2 | R2, R3 | manual | Organization with past- and current-year invoices → dashboard chart retains both years; current-year total, remaining budget, and Budget used agree with the current-year chart row. |
| 3 | R2, R4 | manual | Same organization on client dashboard, admin landing, and admin overview → identical current-year percentage despite historical spend. |
| 4 | R2, R5 | manual | Current-year phase-less invoice → included everywhere; void or uncollectible invoice → excluded everywhere. |
| 5 | R6, R7 | manual | No positive yearly budget → every surface labels the metric Budget used, shows `No budget`, and renders no percentage or progress. |
| 6 | R5, R7 | manual | Current-year spend above budget → uncapped one-decimal percentage everywhere, red warning treatment, progress capped at `100`. |
| 7 | R8 | manual | Force one organization read to fail during admin landing render → the page fails instead of showing a partial ledger. |
