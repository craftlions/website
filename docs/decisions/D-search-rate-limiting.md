# Search authorization and rate limiting

`/api/search` loads the caller's authorised slice per request (`loadSearchSlice`) and never caches it in isolate memory, because a single Worker isolate serves many users. An admin searches every organization; any other session — including an admin impersonating a client — searches only the organizations that user belongs to. An empty query returns only home pages (`loadSearchHome`) without loading the full slice.

The Cloudflare rate limiter (`SEARCH_RATE_LIMIT`) is keyed by `session.session.impersonatedBy ?? session.user.id`, so an admin viewing as a client spends the admin's own budget rather than the client's. Because Cloudflare counts per location, the limiter caps abuse rather than enforcing a strict global quota. If the limiter call throws, the endpoint logs the error and fails open so a limiter outage does not take search down.

**Alternatives considered:** Failing closed when the limiter errors, or caching search slices in isolate memory. Failing closed turns a limiter failure into a full search outage; isolate caching risks cross-tenant leaks.
