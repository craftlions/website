# Spend by year

## Goal

Build a "Spend by year" section on the org dashboard to reach [O-002](../outcomes/O-002-year-over-year-spend.md) (per-year spend, self-serve justification); placement and request-time computation per [D-004](../decisions/D-004-spend-view-placement.md) (dashboard section, no new infra).

## Requirements

1. Org dashboard renders a "Spend by year" section whenever the org has at least one counted invoice (counted per O-002 spend definition).
2. One entry per calendar year with counted spend, newest first, each with its year total.
3. The current year appears alongside past years, marked as in progress.
4. Within a year: one subtotal per project (invoice → phase → project); invoices without a phase form one separate bucket; subtotals and bucket sum to the year total.
5. Plain amounts only; no deltas or percentages between years.
6. The budget card ("Invoiced this year", used %, remaining, pace) and the section derive from one shared spend computation.

## Constraints

- The O-002 spend definition has exactly one implementation; every spend-showing surface uses it.
- An invoice's year derives from its uuidv7-embedded date; invoices only arrive via Stripe import, which backdates ids to the Stripe issue date.

## Acceptance criteria

Manual checks against seeded data; the repo has no test runner. Time-gated measures stay in O-002 Success.

| # | Proves | Verification | Check |
|---|--------|--------------|-------|
| 1 | R1 | manual | Org with zero counted invoices: no section rendered. |
| 2 | R2 | manual | Org with invoices in 3+ years (incl. backdated imports): one entry per year, newest first, totals equal per-year invoice sums. |
| 3 | R1, O-002 | manual | Seeded void, uncollectible, and draft invoices appear in no total; open and paid do. |
| 4 | R4 | manual | Phase-less invoice: counted in year total, shown as own bucket; project subtotals + bucket = year total. |
| 5 | R3, R6 | manual | Current-year entry marked in progress and exactly equals the budget card figure while a phase-less invoice exists. |
