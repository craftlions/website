# Direct Workflow dispatch

A qualifying domain change starts its Cloudflare Workflow directly after the transaction commits, using a deterministic instance ID derived from the domain key (`phase-approval-<phaseId>`, `invoice-overdue-<invoiceId>`); Workflows' instance-ID deduplication and step checkpoints own idempotency, retries, waits, and observability. At craftlions' volume the priced cost of the rare crash between commit and dispatch — one lost notice, visible in Cloudflare logs — does not justify durable dispatch machinery.

## Alternatives considered

- Transactional outbox + one-minute dispatcher cron: intent tables and delivery state duplicate what Workflows persist natively; their only win is closing the rare commit-to-dispatch crash window, which is priced and accepted instead.
- Postgres outbox + cron-owned scheduling without Workflows: the application would own retry state, concurrency control, and multi-day waits that Workflows provide.

## Consequences

The only durable notification records are `approval_notice_sent` / `overdue_notice_sent` rows in the existing events table, written by the workflow after mail acceptance and used both to guard invoice re-dispatch and to judge O-001's Success. A skipped notice leaves no database trace, so a suppressed overdue notice may send once if a later Stripe fetch re-evaluates a still-open invoice after Cloudflare's instance retention expires.

## Revisit when

Notification volume or a real incident makes a lost notice costlier than dispatch machinery, or additional channels need fan-out state a single Workflow instance cannot hold.
