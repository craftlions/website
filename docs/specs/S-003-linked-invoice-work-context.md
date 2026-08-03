# S-003 — Linked invoice work context

## Goal

Build inline Work and Delivery links across client invoice rows, backed by phase-owned delivery state managed in the invoice admin flow, to reach [O-003 — traceable invoice context](../outcomes/O-003-traceable-invoice-context.md) (direct review context and timely payment).

## Requirements

1. **Phase-owned Delivery.** Each phase holds exactly one Delivery state, separate from its existing client-tracker Epic link.

   | State | Meaning | Client label |
   | --- | --- | --- |
   | HTTPS URL | One canonical delivery PR or MR | `Open` link |
   | No delivery | The absence of a PR or MR was explicitly confirmed | `No delivery` |
   | Not recorded | No choice exists for legacy data | `Not recorded` |

2. **Derived invoice context.** An attached invoice derives its project, phase, and Delivery from its one phase; the invoice holds no copied work or Delivery reference.
3. **Inline invoice links.** Every client invoice table, including the organization dashboard and project page, contains one `Work` column and one `Delivery` column.

   | Invoice state | Work | Delivery |
   | --- | --- | --- |
   | Attached | Linked project name and linked phase title | Phase Delivery state from R1 |
   | Unattached | `Unassigned` | `Unavailable` |

4. **Exact work navigation.** The project link opens the existing project page; the phase link opens that page at a stable fragment for the exact phase row; the targeted row is visibly highlighted in light and dark modes without motion or color-only meaning.
5. **Phase evidence.** Every client phase row labels its existing client-tracker destination `Epic` when present and separately exposes Delivery using the states from R1.
6. **Invoice-time capture.** Recording or attaching an invoice requires an explicit `Delivery link` or `No delivery PR/MR` choice; the first requires an HTTPS URL; the choice is stored on the phase in the same successful operation as the invoice relationship.
7. **Correction and backfill.** Every attached invoice admin row allows its phase Delivery state to be set or changed without changing the invoice’s phase relationship, payment data, or lifecycle state.
8. **Safe failure.** Missing or invalid required Delivery input leaves both invoice and phase unchanged and returns a readable error beside the originating admin flow.
9. **Existing data.** Existing phase and invoice relationships remain intact; phases without a Delivery choice begin as `Not recorded`; unattached invoices remain client-visible with their existing Stripe action.
10. **Link behavior.** Internal Work links stay in the current browsing context; Epic and Delivery links open a new context with an accessible destination label and safe external-link behavior.

## Constraints

- One invoice ↔ at most one phase; one Delivery reference per phase.
- Any HTTPS PR or MR provider accepted; no provider API, reachability check, metadata sync, or automatic provider detection.
- No invoice or phase detail page, multiple-delivery model, portal invoice-approval state, or change to Stripe-hosted invoices and PDFs.
- Existing invoice payment, status, filtering, pagination, Epic links, and phase approval behavior unchanged.

## Acceptance criteria

| AC | Requirement | Verification | Observable check |
| --- | --- | --- | --- |
| 1 | R1–R2 | Data integration test | URL, explicit no-delivery, and legacy not-recorded states round-trip on a phase; its attached invoice resolves the same project, phase, and Delivery without invoice-owned copies. |
| 2 | R3 | Render test on both client routes | Organization and project invoice tables each show `Work` and `Delivery`; attached rows show the correct project, phase, and Delivery. |
| 3 | R3, R9 | Render test | Unattached invoices remain visible with `Unassigned` and `Unavailable`; attached legacy invoices show `Not recorded`; payment actions remain available. |
| 4 | R4 | Browser test | Following a phase link loads the correct project URL and fragment, places the exact phase row in view, and leaves that row visibly targeted in light and dark modes. |
| 5 | R5, R10 | Browser test | A phase with both destinations shows distinct `Epic` and `Delivery` links; each is keyboard reachable, clearly named, and opens the correct external URL. |
| 6 | R6, R8 | Action integration tests | Record and attach flows accept either a valid HTTPS Delivery URL or explicit no-delivery; blank, malformed, and non-HTTPS link choices show an error and create no partial invoice or phase change. |
| 7 | R7 | Action integration test | Updating Delivery from an attached invoice admin row updates every derived client display while invoice relationship, payment fields, and lifecycle states remain unchanged. |
| 8 | R9 | Migration test | Existing invoice-phase associations survive unchanged and every pre-existing phase without a choice resolves to `Not recorded`. |
| 9 | R10 | Browser test | Work links navigate internally; external links expose descriptive accessible names and use safe new-context behavior. |
