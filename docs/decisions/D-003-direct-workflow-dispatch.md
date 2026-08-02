# Direct Workflow dispatch over transactional outbox

Supersedes [D-001](D-001-transactional-outbox-cloudflare-workflows.md). A qualifying domain change starts its Cloudflare Workflow directly after the transaction commits, using a deterministic instance ID derived from the domain key (`phase-approval-<phaseId>`, `invoice-overdue-<invoiceId>`); Workflows' instance-ID deduplication and step checkpoints own idempotency, retries, waits, and observability. At craftlions' volume the priced cost of the rare crash between commit and dispatch — one lost notice, visible in Cloudflare logs — does not justify outbox tables, a dispatcher cron, and delivery state duplicated from the Workflow engine.

## Consequences

The only durable notification records are `approval_notice_sent` / `overdue_notice_sent` rows in the existing events table, written by the workflow after mail acceptance and used both to guard invoice re-dispatch and to compute the 90-day outcome measures. A skipped notice leaves no database trace, so a suppressed overdue notice may send once if a later Stripe fetch re-evaluates a still-open invoice after Cloudflare's instance retention expires — an accepted relaxation of the brief's original never-resurrect rule.

## Revisit when

Notification volume or a real incident makes a lost initial notice costlier than outbox machinery, or additional channels need fan-out state a single Workflow instance cannot hold.
