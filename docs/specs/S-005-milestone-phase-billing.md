> Frozen by /to-issues

# S-005 — Milestone phase billing

**Goal** — Split each phase's cost into upfront / delivery / acceptance components billed at their milestones, reaching [O-005](../outcomes/O-005-milestone-phase-billing.md) (revenue follows milestones) under [D-phase-billing-truth](../decisions/D-phase-billing-truth.md) (derived billing, work-only lifecycle) and [D-phase-acceptance](../decisions/D-phase-acceptance.md) (explicit acceptance, reminder mail).

**Requirements**

Components:

1. `phases` holds three nullable component amounts: upfront, delivery, acceptance.
2. DB check: present components sum to `cost`; at least one present.
3. Amounts mutable until `approved`, immutable after — backfilled phases included.
4. Admin phase form offers a percentage calculator (percent of `cost` → amount); only amounts stored.

Lifecycle and events:

5. `phase_state`: submitted → planned → approved → in_progress → delivered → accepted, plus cancelled; `invoiced`/`paid` removed.
6. Due triggers:

| Component | Due when |
|---|---|
| upfront | phase reaches `approved` |
| delivery | delivery recorded (`url` or `none`) — transitions to `delivered` |
| acceptance | acceptance recorded — transitions to `accepted` |

7. Delivery recording requires no invoice — its own mutation, split out of invoice recording.
8. Acceptance recordable by the client in the portal and by an admin on their behalf.

Billing:

9. Invoices carry a component tag; at most one invoice per (phase, component); the one-invoice-per-phase index gives way.
10. Invoice recording rejected for a component not yet due.
11. Component status derived per [D-phase-billing-truth](../decisions/D-phase-billing-truth.md): due (event fired, no invoice) / invoiced (tagged invoice) / paid (its `stripeStatus`); never stored.
12. Admin UI warns, non-blocking, when a tagged invoice's `total` differs from its component amount (both gross — like-for-like).
13. Cancellation stops reminders and nothing else; recorded invoices untouched, settlement manual in Stripe.

Surfaces:

14. Wherever a phase's cost shows (portal approval and phase views, admin org surfaces), the component breakdown and each component's status show with it.
15. Admin work-planning surfaces flag phases past `approved` whose upfront component is unpaid — signal only, no gating.

Notifications:

16. A delivered phase pending acceptance mails a reminder every 7 days — none at delivery itself — until accepted or cancelled; recipients identical to the phase-approval mail; a Workflow `phase-acceptance-<phaseId>` per [D-notification-dispatch](../decisions/D-notification-dispatch.md) (direct dispatch, instance-ID dedupe).

Migration:

17. Backfill: existing `cost` → acceptance component; existing phase invoices → tagged acceptance; `invoiced`/`paid` phases → `accepted`.

**Constraints**

- Exactly three component types; a fourth is a schema change (columns on `phases` chosen over a child table).
- No auto-created or auto-sent invoices; billing stays manual admin work.
- No deemed acceptance, no refund or void mechanics.

**Acceptance criteria**

| # | Proves | Verification | Check |
|---|---|---|---|
| 1 | R2 | test | components summing ≠ cost rejected at DB |
| 2 | R3 | test | amount edit rejected on approved phase, accepted on planned |
| 3 | R5, R6 | test | invalid tail transitions rejected; delivery → `delivered`, acceptance → `accepted` |
| 4 | R7 | manual | delivery recorded with no invoice fields; phase `delivered`, no invoice exists |
| 5 | R8 | manual | portal accept and admin accept both yield `accepted` |
| 6 | R9 | test | second invoice for same (phase, component) rejected |
| 7 | R10 | test | invoice for un-due component rejected |
| 8 | R11 | test | component reads due → invoiced → paid across event, tagging, Stripe paid fetch |
| 9 | R12 | manual | divergent total shows warning, recording still succeeds |
| 10 | R4 | manual | entering 30% fills 30% of `cost` as the amount |
| 11 | R15 | manual | in-progress phase with unpaid upfront flagged on worklist |
| 12 | R16, R13 | manual | no mail at delivery; reminder after 7 pending days; none after acceptance or cancellation |
| 13 | R17 | test | legacy paid phase reads `accepted`, cost on acceptance, invoice tagged acceptance |
| 14 | R14 | manual | portal phase shows breakdown with per-component statuses |
