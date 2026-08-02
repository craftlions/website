# Actionable customer email workflows

> Frozen — decomposed into [#249](https://github.com/craftlions/website/issues/249); never edited again — further change starts a new spec.

## Goal

Build Cloudflare Workflow email delivery started directly by qualifying domain changes to reach [O-001](../outcomes/O-001-actionable-customer-notifications.md), honoring the [notifications contract](../behavior/B-notifications.md), per [D-003](../decisions/D-notification-dispatch.md) and [D-002](../decisions/D-email-delivery.md).

## Requirements

1. **Dispatch** — direct, deterministic, post-commit.

   | Domain change | Instance ID | When |
   |---|---|---|
   | Phase → `planned` | `phase-approval-<phaseId>` | immediately after commit |
   | Stripe fetch (refresh or import) stores an `open`, past-due invoice with no `overdue_notice_sent` event | `invoice-overdue-<invoiceId>` | after the stored update commits |

   - Dispatch failure → one structured log line; the committed change stands (D-003).
   - Instance-ID uniqueness + the sent-event check absorb duplicate dispatch.
   - No activation configuration; pre-enablement overdue invoices per the contract.

2. **Phase workflow** — one instance owns initial + day-2 + day-5.
   - Checkpoints anchor to the transition time, same local time `Europe/Berlin`.
   - Late recovery skips passed checkpoints; never bunches reminders.
   - Re-reads phase, project, organization, recipients before each send; completes silently once not `planned`.
   - Recipient-free checkpoint → skip with logged reason, continue to the next.

3. **Invoice workflow** — one instance, one notice, no reminders.
   - Re-reads invoice, attached phase and project, organization, recipients before send.
   - Skips with logged reason when not `open`, not past due, or recipient-free; a skip leaves no database trace — later fetches may re-dispatch per the contract.

4. **Message** — plain text per the contract; the intervention adds:
   - Phase subject names project + phase, stable across the thread; reminders reference the initial provider message ID from the checkpointed step result.
   - Invoice subject names the invoice.
   - `de-DE` dates and money, matching the portal.
   - Recipients resolved inside the workflow at send time; never in instance params.

5. **Destinations and login return**

   | Notice | Destination |
   |---|---|
   | Phase approval | project `#phases` |
   | Overdue invoice, attached to a phase | project `#invoices` |
   | Overdue invoice, unattached | organization dashboard invoices |

   - Signed-out → login → exact same-origin path + query + fragment; invalid, malformed, or external → `/dash`.
   - Authorization enforced after login; stale links show current state, no notification-specific page.

6. **Delivery and observability**
   - `MAIL.send()` returned from one retryable step; five exponential retries, then errored instance; at-least-once per D-002.
   - Accepted send → one `approval_notice_sent` / `overdue_notice_sent` event row, actor `system`; step checkpoints prevent resend on replay; the sent event guards invoice re-dispatch.
   - Structured logs carry workflow ID, domain IDs, reason — never recipient addresses or bodies.
   - Cloudflare instance state, metrics, and logs are the only operational view.

7. **Measurement** — sent-notice events + existing domain events let O-001's Success be judged; follow-up stays operator-assessed.

## Constraints

- One notification sequence = one Workflow instance keyed by its domain ID; params carry only internal identifiers; database connections scoped to the step using them.
- No notification-specific tables; the only notification state is event rows, enabled by the `system` actor type value.
- No automated test framework; verification is manual preview evidence plus the repository's static validation commands.

## Acceptance criteria

| # | Proves | Verify | Check |
|---|---|---|---|
| 1 | R1 | preview | planned → exactly one `phase-approval-<id>`; idempotent repeat → no second instance; forced dispatch failure → transition committed + one log line |
| 2 | R1, R4 | preview | one plain-text email ≤ 5 min; To/CC per the contract, no members/banned/unverified; required context + one portal link |
| 3 | R2, R4 | preview | day-2/day-5 at the same Berlin local time; stable subject + thread headers; one instance with checkpointed step results |
| 4 | R2 | preview | approve/decline/cancel stops all later email; ineligible checkpoint skipped + logged; restored eligibility gets only later checkpoints; recovery never bunches |
| 5 | R1, R3 | preview | only `open` past-due invoices without a sent event dispatch; repeats → no duplicate; N invoices → N emails; pre-enablement invoice notices once |
| 6 | R3–R5 | preview | invoice email ≤ 5 min after fetch; correct destination per table; resolved-before-send skipped |
| 7 | R2, R3 | preview | recipient-free notice → skip logged, no email; a later fetch may re-notice a still-open invoice |
| 8 | R5 | preview | signed-out link → login → exact section; malformed/external → `/dash`, no data leak |
| 9 | R6 | preview | induced mail failure: five retries, committed transition, errored instance, no recipient data in logs; replay resends nothing; sent event row present |

Static validation is inherited from the repository contract; Success lives in [O-001](../outcomes/O-001-actionable-customer-notifications.md) and is judged from R7's event rows.
