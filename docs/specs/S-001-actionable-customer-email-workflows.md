# Actionable customer email workflows

## Goal

Build a transactional notification outbox and Cloudflare Workflow delivery pipeline to reach [O-001: Actionable customer notifications](../outcomes/O-001-actionable-customer-notifications.md), following [D-001: Transactional outbox with Cloudflare Workflows](../decisions/D-001-transactional-outbox-cloudflare-workflows.md) and [D-002: At-least-once email delivery](../decisions/D-002-at-least-once-email-delivery.md).

## Requirements

1. **Notification activation and intent**
   - Each environment has an explicit notification activation timestamp.
   - A phase transition to `planned` at or after activation creates at most one `phase_approval` intent in the same database transaction as the transition when at least one eligible recipient exists.
   - Each per-invoice Stripe refresh and organization-wide Stripe import evaluates every newly fetched invoice for an `invoice_overdue` intent in the same database transaction as its stored Stripe update.
   - An invoice is eligible exactly once when its Stripe state is `open`, its due date has passed, its due date is at or after notification activation, and at least one eligible recipient exists.
   - Each invoice records that its first eligible overdue state was evaluated even when no notification intent was created, so later verification, unbanning, refreshes, or imports cannot resurrect the suppressed notice.
   - Missing or invalid activation configuration fails closed: business changes continue, no notification intent is created, and an operational error is logged.

2. **Transactional dispatch**
   - Committed notification intents remain pending independently of the request that created them; a dispatch failure never rolls back or changes the qualifying phase or invoice state.
   - Pending intents are reconciled at least once per minute and dispatched to Cloudflare Workflows within the five-minute initial-delivery bound.
   - Each intent maps to one stable Workflow instance ID. Repeated dispatch attempts are idempotent and cannot create a second Workflow instance for the same intent.
   - The intent records when Workflow dispatch succeeds and remains available as the durable mapping between the domain action and its Workflow instance.

3. **Phase-approval workflow**
   - One Workflow instance owns the initial notice and both possible reminders for one phase transition to `planned`.
   - The initial notice is eligible immediately. Reminder checkpoints are anchored to the transition time at the same local time in `Europe/Berlin`, two and five calendar days later.
   - A late or recovering Workflow skips reminder checkpoints whose scheduled times have already passed; missed reminders are never bunched together.
   - Immediately before each send, the Workflow reads the current phase, project, organization, and recipients. It completes without further email once the phase is no longer `planned`.
   - When no eligible recipient exists at a reminder checkpoint, that reminder is recorded as skipped and the Workflow continues to the next checkpoint. The next checkpoint may send if recipient eligibility returns.
   - Each phase has its own email sequence even when other phase notices or reminders are due at the same time.

4. **Overdue-invoice workflow**
   - One Workflow instance owns the single overdue notice for one invoice; multiple overdue invoices discovered by one import produce separate intents and emails.
   - Immediately before sending, the Workflow reads the current invoice, any attached phase and project, its organization, and current recipients.
   - The email is recorded as skipped when the invoice is no longer `open`, has no due date, is no longer past due, or has no eligible recipient.
   - An overdue-invoice Workflow never schedules a reminder.

5. **Recipients**
   - Eligible recipients are current organization members whose organization role is `owner` or `admin`, whose email is verified, and whose user is not banned. Prior login activity and global application role do not affect eligibility.
   - All eligible owners appear in **To**, all eligible organization admins appear in **CC**, and ordinary members never receive the email.
   - One `MAIL.send()` call contains every current recipient. A message with eligible admins only uses **CC** with no **To** recipient.
   - Recipients are resolved fresh for every send and are not persisted in the intent or Workflow payload.

6. **Email message**
   - Every notification is an English, plain-text email from `craftlions <no-reply@craftlions.com>` with no reply invitation, HTML body, attachment, or action performed from the message.
   - A phase email has a stable subject that names the project and phase. Its body identifies the organization, project, phase, phase cost, due date or `Not scheduled`, required approval action, and one portal URL.
   - The initial phase email and every reminder use the same subject. The first successfully sent message establishes the thread; later successfully sent reminders reference its provider message ID.
   - An overdue-invoice email has a subject that names the overdue invoice. Its body identifies the organization, invoice number, attached project and phase when present, total, due date, required payment action, and one portal URL.
   - Dates and money use the portal's existing `de-DE` presentation so email and authenticated data remain directly comparable.

7. **Destinations and authentication**
   - Phase links open the relevant project at `#phases`.
   - An attached invoice link opens its project at `#invoices`; an unattached invoice link opens the organization dashboard's invoice section.
   - A signed-in authorized customer reaches the destination directly.
   - A signed-out customer is sent through login and returned to the exact same-origin path, query, and fragment after authentication.
   - Return destinations accept only normalized internal portal paths. Invalid, malformed, or external destinations fall back to `/dash`.
   - Authorization remains enforced after login. A recipient whose access was removed sees the portal's existing safe fallback rather than notification data.
   - A stale email link opens the normal destination and its current domain state without a notification-specific expired page or banner.

8. **Delivery state, retries, and observability**
   - Every phase stage and overdue send has a stable identity and a durable `sent` or `skipped` result. Sent results retain the Email Service message ID and timestamp; skipped results retain a machine-readable reason and timestamp.
   - Ordinary Workflow replay, duplicate dispatch, repeated Stripe fetches, and idempotent domain requests do not resend a completed stage.
   - `MAIL.send()` is returned from one individually retryable Workflow step. Mail errors use five retries with exponential backoff before the Workflow becomes errored.
   - An ambiguous failure after Email Service acceptance is retried according to D-002, accepting the documented rare duplicate edge case.
   - Workflow failures and invalid configuration produce structured Cloudflare logs containing the intent ID, Workflow ID, notification kind, stage, and non-sensitive aggregate identifiers; recipient addresses and message bodies are not written to custom logs.
   - Cloudflare's Workflow instance state, metrics, and Worker logs provide the operational view. No portal notification administration interface exists.

9. **Outcome measurement**
   - Retained intent, delivery, phase-event, invoice-payment, and Stripe-paid timestamps are sufficient to evaluate the brief's rolling 90-day phase-resolution and overdue-payment targets without a new analytics interface.
   - Manual follow-up remains operator-assessed; the notification system does not infer or fabricate whether off-platform follow-up occurred.

## Constraints

- The brief's constraints and out-of-scope boundaries are inherited without restatement.
- One notification sequence maps to one Cloudflare Workflow instance; Workflow inputs contain only stable internal identifiers, and each database connection is scoped to the Workflow step using it.
- PostgreSQL is the transactional source for notification intent and durable delivery results; Cloudflare Workflows own waits, mail retry execution, and instance observability.
- Cloudflare Email Service remains the only mail provider. Its lack of an idempotency key makes delivery at-least-once at the acceptance/checkpoint boundary as recorded in D-002.
- Production and preview configuration each provide their own activation value, Workflow binding, and dispatcher schedule.
- No automated test framework is introduced. Behavioral verification is manual and uses preview Workflow/email evidence plus the repository's existing static validation commands.

## Acceptance criteria

1. **AC1 — Atomic phase intent (R1, R2):** A manual database inspection after transitioning an eligible phase to `planned` shows the phase event and exactly one pending notification intent committed together. Repeating the idempotent request creates no second intent. A forced transaction failure commits neither state change nor intent.
2. **AC2 — Phase recipient and content contract (R3, R5, R6):** A controlled preview transition produces one plain-text email within five minutes; every verified, unbanned owner is in **To**, every verified, unbanned organization admin is in **CC**, and members, banned users, and unverified users are absent. Manual message inspection verifies the required context and single portal link.
3. **AC3 — Phase timing and threading (R3, R6, R8):** A manual preview sequence left unresolved produces checkpoints at the same Europe/Berlin local time on day two and day five. The received reminders retain the initial subject and thread headers, while Cloudflare shows one Workflow instance and one durable result per stage.
4. **AC4 — Phase suppression and recovery (R3, R5, R8):** Manual scenarios verify that approval, decline, or cancellation before a checkpoint prevents all later email; an ineligible checkpoint is skipped; restored eligibility can receive only a later still-pending checkpoint; and delayed recovery never bunches missed reminders.
5. **AC5 — Invoice qualification and one-time behavior (R1, R4):** Manual per-invoice refresh and bulk-import scenarios verify that only `open`, past-due invoices with due dates on or after activation qualify; paid, void, uncollectible, draft, pre-activation, or not-yet-due invoices do not. Repeated fetches create no duplicate, and multiple newly overdue invoices each produce one intent.
6. **AC6 — Invoice recipient, content, and destination (R4–R7):** A qualifying preview invoice produces one plain-text email within five minutes of the successful fetch, using the To/CC contract, exact invoice context, and the attached-project or organization-level destination as applicable. A paid or otherwise resolved invoice is skipped when state changes before send.
7. **AC7 — Recipient-free suppression (R1, R3–R5):** A manual scenario with no eligible owner or admin creates no initial intent. Later verification or unbanning and another Stripe fetch do not resurrect the suppressed overdue notice. A running phase Workflow with temporarily no eligible recipient skips only the affected checkpoint.
8. **AC8 — Safe authenticated return (R7):** Manual signed-out link checks return an authorized customer to the exact project section after login. External, malformed, and unauthorized return paths cannot redirect off-site or reveal organization data and fall back safely.
9. **AC9 — Durable dispatch and failure visibility (R2, R8):** Manual preview inspection verifies that repeated reconciliation maps one intent to one Workflow instance. An induced mail failure retries five times, leaves the domain transition committed, ends as an errored Workflow, and is diagnosable in Cloudflare without recipient data in custom logs.
10. **AC10 — Existing validation contract:** `aubx drizzle-kit check`, `aubr types`, `aubr cf-check`, `aubx astro sync`, `aubr check`, and `aubx biome check --write` complete successfully after the implementation.
11. **AC11 — Outcome metrics (R9):** After each rolling 90-day measurement window, retained timestamps and operator follow-up records can calculate both success measures in O-001 without a notification analytics UI.

## Work sketch (draft)

1. Add notification intent and durable stage-result schema, invoice overdue-evaluation state, relations, and a generated Drizzle migration.
2. Add per-environment activation configuration, Workflow bindings, the one-minute pending-intent dispatcher, generated Worker types, and Workflow exports.
3. Make phase planning, invoice refresh, and invoice import atomically qualify notification intent without coupling business success to Workflow dispatch.
4. Add shared recipient resolution, plain-text message construction, portal destination construction, and durable phase and overdue-invoice Workflow execution.
5. Preserve safe portal return destinations through login and verify authorization and stale-link behavior.
6. Exercise the acceptance scenarios in preview, inspect Cloudflare execution evidence, and run the repository validation contract.

## Open questions

- The exact production and preview activation timestamps are chosen at rollout; they block enabling email, not implementation.
- The verified preview owner/admin addresses used for manual delivery and threading checks are chosen before acceptance testing; they block those external smoke checks only.
