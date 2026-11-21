# Form action Post/Redirect/Get

Astro form actions run through a Post/Redirect/Get cycle in `src/middleware.ts`. On action completion, the middleware stores the action result — and, on failure, the submitted non-secret text fields — in a single session entry (`lastActionResult`).

- On success, the middleware redirects to the action data's `next` path if it passes `sameOriginPath`, otherwise back to the posting page.
- On failure, the middleware redirects back to the referring page so the form re-renders with its errors and submitted values (`submittedValues`, `Field`). Fields whose names match `/pass|secret|token|key|otp|credential/i` and file inputs are never stored.
- The session entry survives intermediate redirects and is deleted only once a non-redirect HTML response consumes it. `/api/*` requests (such as command-palette searches between the 303 and the landing page) neither read nor delete the entry.
- Every redirect target is validated with `sameOriginPath`, which normalises tabs, newlines, and backslashes via `URL` parsing and rejects any pathname still starting with `//` so protocol-relative open redirects never reach a `Location` header.

**Alternatives considered:** Letting failed actions render directly on POST without redirecting. Avoids storing submitted values in the session, but leaves browsers with duplicate-POST prompts on refresh.
