# At-least-once email delivery

Cloudflare Email Service returns a message ID after accepting a send but offers no idempotency key or delivery lookup that can be committed atomically with Workflow state. Ambiguous send failures are retried, accepting a rare duplicate rather than risking a lost actionable notification; stable Workflow identities and persisted delivery results prevent ordinary duplicate sends.

## Consequences

An interruption after Email Service accepts a message but before Workflow checkpoints the returned ID may produce one duplicate email on retry.
