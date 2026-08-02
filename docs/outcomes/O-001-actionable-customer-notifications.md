# Actionable customer notifications

## Outcome

Enable customers to notice and act on phase approvals and overdue invoices without repeatedly logging in, so that manual follow-up falls, deadlines are met, invoices are paid, and projects can start on time.

## Constraints

- The initial outbound channel is English transactional email from `no-reply@craftlions.com`; individual preferences and opt-outs do not apply.
- Email is reserved for required customer action: a phase awaiting approval, its two reminders, and one overdue-invoice notice. Informational project or payment-status changes do not generate email.
- A phase awaiting approval generates one email within five minutes, one reminder after two calendar days, and one final reminder after five calendar days. Each phase has its own email thread, and reminders are not consolidated across phases.
- Phase emails stop when the phase is approved, declined, or cancelled. Current phase or invoice state is checked immediately before every send, including the initial email, and resolved actions are suppressed.
- Stripe remains responsible for standard invoice and payment reminders. One craftlions email is generated within five minutes only when an existing Stripe fetch first reveals that an invoice is unpaid and past its due date; the system does not automate Stripe refreshes.
- One organization-level email is sent for each notice. All eligible owners appear in **To**, all eligible admins appear in **CC**, and ordinary members receive nothing. Recipients are resolved again before each send.
- An eligible recipient is a current owner or admin whose email is verified and who is not banned. Prior login activity is irrelevant. If no eligible recipient exists when a notice is attempted, the notice is skipped. A skipped phase notice is not retried; a skipped overdue-invoice notice may send once if a later Stripe fetch finds the invoice still open and past due.
- Each email contains only the organization, project, phase or invoice identifier, amount and due date where relevant, the required action, and one authenticated portal link. Email never performs approval or payment and includes no attachments or general project updates.
- Delivery is durable and duplicate-resistant. A mail failure never rolls back or blocks the underlying business transition, retries stop after the mail service accepts a stable notice, and permanent failures are visible through Cloudflare operations rather than a portal admin view. A crash in the instant between a committed business change and the start of its delivery may lose that single notice; this rare, priced loss is accepted in place of additional delivery infrastructure.
- Reminder sends occur within 24 hours of becoming due. Phases planned before the system is enabled are not backfilled; an invoice that became overdue before enablement may still receive its one notice on the first Stripe fetch that reveals it.
- Every organization having at least one owner remains a precondition; hardening member management is not part of this outcome.

## Success

- Phase approval requests resolved without manual follow-up: currently unmeasured and frequently require chasing → at least 80% resolved by the final day-five reminder over a rolling 90-day window.
- Overdue invoices paid without manual follow-up: currently unmeasured and frequently require chasing → at least 80% paid within seven calendar days of the overdue email over a rolling 90-day window.

## Out of scope

- Slack, webhooks, SMS, browser push, and other outbound channels.
- An in-app notification inbox, unread badges, customer-visible delivery history, or notification admin UI.
- Project progress, completion, paid-invoice, and other informational notifications.
- Standard invoice issuance and payment reminders already sent by Stripe, plus automatic Stripe synchronization.
- Per-user notification preferences, opt-outs, localization, and launch-time backlog notification.
