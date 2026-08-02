# Actionable customer notifications

## Outcome

Enable customers to notice and act on phase approvals and overdue invoices without repeatedly logging in, so that manual follow-up falls, deadlines are met, invoices are paid, and projects can start on time.

## Constraints

### Channel and content

- English plain-text email from `no-reply@craftlions.com`; no preferences or opt-outs.
- Email only for required customer action; informational changes never send.
- Body: organization, project, phase or invoice identifier, amount and due date where relevant, the required action, one authenticated portal link — nothing else.
- Email never performs the action; the portal does.

### Triggers and cadence

| Trigger | Emails | Timing |
|---|---|---|
| Phase awaits approval | initial + two reminders, own thread | ≤ 5 min; day 2; day 5 |
| Invoice unpaid past due, revealed by an existing Stripe fetch | one notice | ≤ 5 min after the fetch |

- Reminders: within 24 h of due; never consolidated across phases; stop on approve, decline, or cancel.
- State re-checked immediately before every send, including the initial; resolved actions suppressed.
- Stripe keeps its own invoice and payment reminders; no automated Stripe refresh.
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
- Precondition: every organization has at least one owner; hardening member management is not this outcome.

## Success

- Phase approvals resolved without manual follow-up: unmeasured → ≥ 80 % by the day-five reminder, rolling 90 days.
- Overdue invoices paid without manual follow-up: unmeasured → ≥ 80 % within 7 days of the notice, rolling 90 days.

## Out of scope

- Other channels: Slack, webhooks, SMS, browser push.
- In-app inbox, badges, delivery history, notification admin UI.
- Informational notifications: progress, completion, paid invoices.
- Stripe's own reminder emails; automatic Stripe sync.
- Preferences, opt-outs, localization, launch backfill.
