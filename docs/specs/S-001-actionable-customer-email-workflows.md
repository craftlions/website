# Actionable customer email workflows

## Goal

Build Cloudflare Workflow email delivery started directly by qualifying domain changes to reach [O-001: Actionable customer notifications](../outcomes/O-001-actionable-customer-notifications.md), following [D-003: Direct Workflow dispatch](../decisions/D-003-direct-workflow-dispatch.md) and [D-002: At-least-once email delivery](../decisions/D-002-at-least-once-email-delivery.md).

## Requirements

1. **Dispatch**
   - A phase transition to `planned` starts one Workflow instance with the deterministic ID `phase-approval-<phaseId>` immediately after its transaction commits. A phase reaches `planned` at most once, so the ID is stable for the phase's lifetime.
   - Each per-invoice Stripe refresh and organization-wide Stripe import starts one Workflow instance `invoice-overdue-<invoiceId>` for every fetched invoice that is `open`, past its due date, and has no `overdue_notice_sent` event. No activation configuration exists; an invoice that became overdue before the system was enabled may notify once on its first qualifying fetch.
   - A dispatch failure is logged with structured detail and never rolls back, blocks, or retries the committed phase or invoice change; the rare resulting lost notice is accepted per D-003.
   - Duplicate dispatch attempts are absorbed by Workflow instance-ID uniqueness and, for invoices, the `overdue_notice_sent` event check; neither can create a second live instance for the same domain key.

2. **Phase-approval workflow**
   - One instance owns the initial notice and both reminders for its phase. The initial notice is eligible immediately; reminder checkpoints are anchored to the transition time at the same local time in `Europe/Berlin`, two and five calendar days later.
   - A late or recovering instance skips checkpoints whose scheduled times have passed; missed reminders are never bunched.
   - Immediately before each send, the instance re-reads the current phase, project, organization, and recipients. It completes without further email once the phase is no longer `planned`.
   - A checkpoint with no eligible recipient is skipped with a logged reason and the instance continues; a later checkpoint may send if eligibility returns.
   - Each phase has its own email sequence even when other notices are due at the same time.

3. **Overdue-invoice workflow**
   - One instance owns the single overdue notice for one invoice; multiple overdue invoices in one import produce separate instances and emails, and no instance ever schedules a reminder.
   - Immediately before sending, the instance re-reads the invoice, any attached phase and project, the organization, and recipients, and skips with a logged reason when the invoice is no longer `open`, past due, or has no eligible recipient.
   - A skip leaves no database trace; a later Stripe fetch may legitimately dispatch a fresh instance for a still-open invoice once the prior instance has expired from Cloudflare retention.

4. **Recipients**
   - Eligible recipients are current organization members with role `owner` or `admin`, verified email, and no ban. Prior login activity and global application role are irrelevant.
   - All eligible owners appear in **To**, all eligible admins in **CC**, ordinary members never receive the email, and a message with only eligible admins uses **CC** alone.
   - One `MAIL.send()` call contains every current recipient; recipients are resolved fresh for every send and never persisted in Workflow parameters.

5. **Email message**
   - Every notification is an English, plain-text email from `craftlions <no-reply@craftlions.com>` with no reply invitation, HTML body, attachment, or action performed from the message.
   - A phase email has a stable subject naming the project and phase; its body identifies the organization, project, phase, cost, due date or `Not scheduled`, the approval action, and one portal URL. Reminders reuse the subject and reference the initial send's provider message ID, held in the instance's checkpointed step result.
   - An overdue-invoice email names the invoice in its subject; its body identifies the organization, invoice number, attached project and phase when present, total, due date, the payment action, and one portal URL.
   - Dates and money use the portal's existing `de-DE` presentation.

6. **Destinations and authentication**
   - Phase links open the project at `#phases`; an attached invoice link opens its project at `#invoices`; an unattached invoice link opens the organization dashboard's invoice section.
   - A signed-out customer passes through login and returns to the exact same-origin path, query, and fragment; invalid, malformed, or external destinations fall back to `/dash`; authorization remains enforced after login.
   - A stale link opens the normal destination with current domain state, without a notification-specific page or banner.

7. **Delivery state, retries, and observability**
   - `MAIL.send()` is returned from one individually retryable Workflow step with five exponential retries before the instance becomes errored; an ambiguous failure after acceptance retries per D-002, accepting the documented rare duplicate.
   - After acceptance, the workflow records one `approval_notice_sent` or `overdue_notice_sent` row in the existing events table with actor type `system`. Checkpointed step results prevent any resend on replay, and the sent event guards invoice re-dispatch.
   - Failures and skips produce structured Cloudflare logs naming the workflow ID, domain identifiers, and reason; recipient addresses and message bodies never appear in custom logs.
   - Cloudflare's instance state, metrics, and Worker logs are the only operational view; no portal notification administration exists.

8. **Outcome measurement**
   - Sent-notice event rows plus existing phase, invoice, and payment events are sufficient to evaluate the brief's rolling 90-day targets without a new analytics interface; manual follow-up remains operator-assessed.

## Constraints

- The brief's constraints and out-of-scope boundaries are inherited without restatement.
- One notification sequence maps to one Workflow instance keyed by a deterministic domain ID; Workflow parameters contain only stable internal identifiers, and each database connection is scoped to the step using it.
- No notification-specific tables exist. The only notification state is sent-notice rows in the existing events table, enabled by the `system` value added to the `actor_type` enum.
- Cloudflare Email Service remains the only mail provider; its lack of an idempotency key keeps delivery at-least-once as recorded in D-002.
- No automated test framework is introduced; verification is manual preview evidence plus the repository's existing static validation commands.

## Acceptance criteria

1. **AC1 — Direct dispatch (R1):** Transitioning an eligible phase to `planned` starts exactly one `phase-approval-<phaseId>` instance; repeating the idempotent request starts no second instance; an induced dispatch failure leaves the transition committed and produces one structured log entry.
2. **AC2 — Phase recipient and content contract (R2, R4, R5):** A controlled preview transition produces one plain-text email within five minutes with every eligible owner in **To**, every eligible admin in **CC**, and no members, banned, or unverified users; manual inspection verifies the required context and single portal link.
3. **AC3 — Phase timing and threading (R2, R5, R7):** An unresolved preview sequence produces checkpoints at the same Europe/Berlin local time on day two and day five, reminders retain the initial subject and thread headers, and Cloudflare shows one instance with checkpointed step results per stage.
4. **AC4 — Phase suppression and recovery (R2, R4, R7):** Approval, decline, or cancellation before a checkpoint prevents all later email; an ineligible checkpoint is skipped with a logged reason; restored eligibility receives only a later still-pending checkpoint; delayed recovery never bunches missed reminders.
5. **AC5 — Invoice qualification (R1, R3):** Per-invoice refresh and bulk import dispatch only `open`, past-due invoices without a prior `overdue_notice_sent` event; paid, void, uncollectible, draft, and not-yet-due invoices never dispatch; repeated fetches produce no duplicate email; several newly overdue invoices each produce one email.
6. **AC6 — Invoice recipient, content, and destination (R3–R6):** A qualifying preview invoice produces one plain-text email within five minutes of the fetch using the To/CC contract, exact invoice context, and the attached-project or organization-level destination; an invoice resolved before send is skipped.
7. **AC7 — Recipient-free suppression (R2–R4):** With no eligible recipient, the notice is skipped with a logged reason and no email; a running phase instance skips only the affected checkpoint; a suppressed overdue notice may send once on a later qualifying fetch, and this is observable rather than silent.
8. **AC8 — Safe authenticated return (R6):** Signed-out link checks return an authorized customer to the exact section after login; external, malformed, and unauthorized destinations fall back safely without leaking organization data.
9. **AC9 — Durable execution and failure visibility (R7):** An induced mail failure retries five times, leaves the domain transition committed, ends as an errored instance diagnosable in Cloudflare, and writes no recipient data to custom logs; replaying a completed instance resends nothing; a successful send leaves one sent-notice event row.
10. **AC10 — Existing validation contract:** `aubx drizzle-kit check`, `aubr types`, `aubr cf-check`, `aubx astro sync`, `aubr check`, and `aubx biome check --write` complete successfully after the implementation.
11. **AC11 — Outcome metrics (R8):** After a rolling 90-day window, sent-notice events and existing domain events can calculate both success measures in O-001 without a notification analytics UI.

## Work sketch (draft)

1. Add the `system` actor type value with its generated migration; dispatch the phase Workflow directly from the planned transition; deliver the initial notice and record its sent event.
2. Extend the phase Workflow with the day-two and day-five checkpoints, threading, and skip behavior.
3. Evaluate overdue eligibility on both Stripe fetch paths and deliver the single invoice notice per invoice.
4. Preserve safe portal return destinations through login and verify authorization and stale-link behavior.
5. Exercise the acceptance scenarios in preview, inspect Cloudflare execution evidence, and run the repository validation contract.

## Open questions

- The verified preview owner/admin addresses used for manual delivery and threading checks are chosen before acceptance testing; they block those external smoke checks only.
