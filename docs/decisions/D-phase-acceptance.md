# Phase acceptance

Recording a phase's delivery starts its acceptance window, and clients take weeks to respond. Acceptance is only ever recorded explicitly — by the client in the portal or by an admin relaying an out-of-band OK — with required-action reminder mail while it is pending; silence never becomes acceptance, because acceptance is a client commitment craftlions will not fabricate from a timeout.

**Alternatives considered** — Deemed acceptance after N days of silence: directly attacks the slow-client wait, but turns a missing answer into a billing event and invites disputes.

**Revisit when** — Pending acceptances routinely outlive reminders and the floating acceptance share becomes painful.
