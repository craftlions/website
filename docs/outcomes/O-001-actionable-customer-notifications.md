# Actionable customer notifications

## Outcome

Enable customers to notice and act on phase approvals and overdue invoices without repeatedly logging in, so that manual follow-up falls, deadlines are met, invoices are paid, and projects can start on time.

## Behavior

### Channel and content

- Outbound channel: email only per [D-004](../decisions/D-004-email-only-notification-channel.md); English plain text from `no-reply@craftlions.com`; no preferences or opt-outs.
- Email only for required customer action; informational changes never send.
- Body: organization, project, phase or invoice identifier, amount and due date where relevant, the required action, one authenticated portal link — nothing else.
- Email never performs the action; the portal does.

### Triggers and cadence

| Trigger | Emails | Timing |
|---|---|---|
| Phase awaits approval | initial + two reminders, own thread | on trigger; day 2; day 5 |
| Invoice unpaid past due, revealed by an existing Stripe fetch | one notice | on the fetch |

- Reminders: never consolidated across phases; stop on approve, decline, or cancel.
- State re-checked immediately before every send, including the initial; resolved actions suppressed.
- No phase backfill at enablement; a pre-enablement overdue invoice may notice once on its first fetch.

### Recipients

| Who | Field |
|---|---|
| Eligible owners | To |
| Eligible admins | CC |
| Members | — |

- Eligible = current owner/admin + verified email + not banned; login history irrelevant.
- One email per notice, every current recipient on it; resolved fresh before each send.
- No eligible recipient → notice skipped; a skipped phase notice never retries; a skipped overdue notice may send on a later qualifying fetch.

### Reliability

- A mail failure never rolls back or blocks the business transition.
- Retries stop once the mail service accepts a notice; failures visible via Cloudflare operations, no portal admin view.
- Priced and accepted: a crash between a committed change and dispatch may lose that single notice.

## Givens

- Stripe sends its own invoice and payment reminders; the portal has no automated Stripe refresh.
- Every organization has at least one owner; hardening member management is not this outcome.
- One-person operation: no capacity for channels or dashboards beyond what Cloudflare provides.

## Success

- Manual follow-up to get approvals decided and invoices paid: frequent → rare.
- Projects blocked waiting on unnoticed approvals: recurring → exceptional.

## Out of scope

- Other channels: Slack, webhooks, SMS, browser push — deferred per D-004.
- In-app inbox, badges, delivery history, notification admin UI.
- Informational notifications: progress, completion, paid invoices.
- Stripe's own reminder emails; automatic Stripe sync.
- Preferences, opt-outs, localization, launch backfill.
