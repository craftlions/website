# Transactional outbox with Cloudflare Workflows

Notification intent must remain durable without blocking domain transitions, while approval reminders wait for two- and five-day intervals. The system records notification intent in the same database transaction as the qualifying domain change, then dispatches an idempotent Cloudflare Workflow instance to own state checks, recipient resolution, email delivery, retries, and waits. This is preferred over a Postgres-only cron scheduler because Workflows provides persisted execution and Cloudflare-visible failures without requiring the application to own the full scheduler and retry state machine.

## Consequences

A lightweight dispatcher and reconciliation path remains necessary to close the gap between committing an outbox record and starting its Workflow instance.
