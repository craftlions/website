# Route indexing and noindex enforcement

Sign-in, client, admin, API, and unlisted pages (`/admin`, `/api`, `/dash`, `/settings`, `/login`, `/forgot-password`, `/reset-password`, `/brand`) are excluded from search indexing across three coordinated layers defined from `src/lib/indexing.ts`:

1. `src/middleware.ts` attaches `X-Robots-Tag: noindex` to every response on private paths (including redirects and 404s).
2. `src/layouts/Shell.astro` emits `<meta name="robots" content="noindex">` because prerendered pages bypass the middleware.
3. `astro.config.ts` excludes private paths from the sitemap.

`/brand` remains listed in `privatePaths` (which also covers `/brand/specimen` beneath it) until `/brand` holds final owner-supplied copy instead of placeholders; replacing `"/brand"` with `"/brand/specimen"` publishes `/brand` while keeping the specimen unlisted.
