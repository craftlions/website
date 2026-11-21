# Session cookie cache

Better Auth serves `getSession` from an encrypted JWE cookie cache (`cookieCache`) for up to 5 minutes rather than querying the session and user rows on every request. Role, ban, and sign-out changes made from another session or directly in the database can therefore lag by up to 5 minutes.

`baseURL.fallback` is set to `https://craftlions.com` because Better Auth 1.7 fails closed without a request host, while server-side calls such as `createUser` and `requestPasswordReset` run without request headers.

**Alternatives considered:** Querying PostgreSQL on every request for immediate revocation. Eliminates the 5-minute staleness window, but adds database round-trips to every authenticated page and API call.

**Revisit when:** Immediate session revocation or instant role downgrades become a strict requirement.
