# Year-over-year spend

## Outcome

Enable client organizations to see their craftlions spend per year — total and per-project split, side by side across years — so that clients can justify continued spend internally without hand-tallied spreadsheets and renewals stop stalling on missing numbers.

## Constraints

- Spend is the sum of an organization's invoices with Stripe status open or paid; void, uncollectible, and draft invoices count in no total. Invoices without a Stripe status (manually recorded) count.
- An invoice belongs to the calendar year it was issued, regardless of payment date.
- Invoices without a phase count in year totals and appear as their own bucket in the per-project split.
- One spend definition everywhere: the existing "Invoiced this year" budget card adopts this definition.
- Every year with at least one counted invoice is visible; history is never truncated.
- Past years show spend only; budget remains a current-year concept.
- Amounts are EUR (D-003).
- Visible to the same audience as the org dashboard today; no new role gating.
- The portal view suffices; no export, no artifact for finance.

## Success

- A client answers "what did we spend with craftlions last year, and on what?" from the portal in one visit: hand-tallied spreadsheets → self-serve.
- Renewal sign-off stalling on a missing spend picture: recurring → rare.

## Out of scope

- Export (CSV/PDF), shareable or finance-facing views.
- Per-year budget history and hindsight budget adherence.
- Multi-currency aggregation (D-003).
- Connecting spend to delivered value or outcomes.
