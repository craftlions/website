# Aggregate currency

The schema carries a `char(3)` currency on phases and invoices, but every client in production is billed in EUR. Spend aggregates (year totals, budget usage, per-project splits) hardcode EUR and sum without currency grouping; this is deliberate, not an oversight to generalize away.

## Alternatives considered

Defensive per-currency grouping (as `InvoiceTable` does for its status totals) was rejected for aggregates: it complicates every summary surface to defend against data that does not occur.

## Revisit when

A non-EUR invoice or phase enters production.
