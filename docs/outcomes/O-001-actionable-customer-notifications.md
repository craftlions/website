# Actionable customer notifications

## Outcome

Enable customers to notice and act on phase approvals and overdue invoices without repeatedly logging in, so that manual follow-up falls, deadlines are met, invoices are paid, and projects can start on time.

Behavior established by this outcome lives in the [notifications contract](../behavior/notifications.md).

## Success

- Manual follow-up to get approvals decided and invoices paid: frequent → rare.
- Projects blocked waiting on unnoticed approvals: recurring → exceptional.

## Out of scope

- Other channels: Slack, webhooks, SMS, browser push — deferred per [D-004](../decisions/D-004-email-only-notification-channel.md).
- In-app inbox, badges, delivery history, notification admin UI.
- Informational notifications: progress, completion, paid invoices.
- Stripe's own reminder emails; automatic Stripe sync.
- Preferences, opt-outs, localization, launch backfill.
