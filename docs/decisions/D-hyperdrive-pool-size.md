# Hyperdrive connection pool size

Cloudflare Workers allow at most 6 concurrent outbound sockets per request. The shared Drizzle/Hyperdrive connection pool (`src/lib/database.ts`) is capped at `max: 5` so outbound `fetch()` calls (such as Better Auth, mail, or external requests) retain headroom while parallel page queries execute.

**Alternatives considered:** Setting a larger pool or relying on the driver default. Risks exhausting the 6-socket Worker limit when a route fans out parallel queries alongside an outbound `fetch()`.

**Revisit when:** Cloudflare Workers raises the per-request concurrent socket limit.
