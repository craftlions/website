# Phase billing truth

Milestone billing gives one phase up to three invoices at different moments, so `invoiced`/`paid` phase states become aggregates no single event produces. The phase lifecycle tracks work only — submitted → planned → approved → in_progress → delivered → accepted, plus cancelled — while each invoice carries the component it bills, and a component's due/invoiced/paid status derives from its trigger event and its tagged invoice's Stripe status, because stored billing state duplicates what invoices already persist and drifts from Stripe.

**Alternatives considered** — Stored per-component billing state: no derivation logic, but a second copy of Stripe truth that can drift. Keeping `invoiced`/`paid` as all-components aggregates: minimal migration, but states no single event produces.

**Consequences** — Existing `invoiced`/`paid` rows migrate to `accepted`; every surface reading those states changes with them.
