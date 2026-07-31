# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Freelance clients of craftlions who need a clear view of their active work, project phases, invoices, budgets, and account settings. They are likely checking status between meetings, validating cost and invoice details, or looking for the next concrete project artifact.

## Product Purpose

The website supports craftlions as a client-facing freelance IT services portal. It gives clients a plain, trustworthy place to understand project progress, budget use, invoice history, and relevant links without requiring extra explanation from the consultant. Success looks like clients finding the state of the work quickly, trusting the numbers, and knowing where to go next.

## Positioning

The differentiator is the engineering and advisory work itself: careful, durable software and technical decisions, communicated plainly, delivered as focused external expertise inside a team's existing process. The portal's transparency into project state, budgets, and invoices is a supporting convenience that demonstrates the plain-communication standard — it is not the headline claim, and it should not be marketed as radical openness.

## Operating Context

- Alexander operates the admin side solo: creating organizations, projects, phases, and invoices, moving work through phase and project transitions, and using read-only view-as impersonation to verify what a client sees.
- Clients are organization members. Today the portal is read-only for them apart from account settings (profile, API keys): they check project state, phases, budget use, and invoice history between meetings and validate cost details.
- Stripe is the source of truth for invoices; invoice status is synced into the database (per-invoice refresh today, periodic sync planned).
- Client self-service write access is planned: an API over projects, phases, and invoices, plus CSV export. Future work should not assume the client portal stays read-only forever.
- Runs on Cloudflare Workers with a PlanetScale Postgres database (Drizzle ORM); auth is Better Auth with the organization plugin.

## Capabilities and Constraints

- Confirmed functionality: email/password auth with password reset, organizations with members and invitations, projects with phases, milestones, invoices, budget tracking, an event history, a changelog page, an admin area (organization, user, project, phase, and invoice management plus welcome-mail onboarding), API keys, and rate limiting.
- Terminology: organization, project, phase, milestone, invoice, budget, event, transition. Use these words; do not introduce parallel terms for the same concepts.
- Explicitly undecided: notification channels (mail, Slack, webhook) and the exact shape of the self-service API are roadmap items, not commitments.

## Brand Personality

Plain and technical. The interface should feel careful, direct, and durable rather than decorative. It should communicate engineering competence through restraint, legibility, and consistent behavior.

## Anti-references

Avoid overdesigned SaaS gloss, decorative dashboards, marketing-heavy component patterns, novelty interactions, and visual noise that makes routine client review feel more complex than it is. Do not make the product feel like a generic startup template or a showpiece at the expense of clarity.

## Evidence on Hand

No usable proof material exists yet: no testimonials, case studies, client names or logos, press, or metrics. Future work must not cite or invent any of these; real material will be provided when it exists. The only shipped assets are the favicon and the landing-page copy.

## Product Principles

- The work is the pitch: engineering and advisory quality, communicated plainly, comes before any portal feature or brand gesture.
- Exact numbers earn trust quietly: verifiable project, budget, and invoice data is a working habit, not a marketing angle.
- Never fabricate proof: absent testimonials, clients, or metrics are stated as absent, not decorated around.
- Build for the read-only client today without walling off the self-service client tomorrow (API, exports).
- Everything must stay operable by one careful consultant without added process overhead.

## Design Principles

- Lead with the work: project state, invoices, phases, budgets, and actions should be easier to scan than the surrounding brand.
- Keep the system legible: plain labels, consistent controls, and direct tables are preferred over ornamental abstractions.
- Earn trust through restraint: use visual emphasis for hierarchy, state, and risk, not decoration.
- Preserve technical precision: numbers, dates, external links, and status labels must be exact, predictable, and easy to verify.
- Respect client attention: every screen should answer a concrete client question without forcing them through unnecessary steps.

## Accessibility & Inclusion

Target WCAG 3 Gold as the long-term accessibility aspiration, with practical implementation aligned to strong production accessibility standards: readable contrast, keyboard access, visible focus, semantic markup, clear labels, robust reduced-motion behavior, and interfaces that remain usable without relying on color alone.
