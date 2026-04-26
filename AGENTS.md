# craftlions website

## Setup

Run these commands before making changes:

```shell
mise i
pn i
pn types
pn astro sync
```

## Hard Requirements

- Never run a dev server; assume one is already running.
- Use inline Tailwind utility classes only; avoid standalone CSS rules or style blocks.
- Use CSS grid, never flexbox.
- Keep markup minimal and semantic.
- Prefer accessing values directly where they are used instead of creating one-off aliases or derived variables. Add variables only when reused, needed for type narrowing, or when they remove real complexity.
- Use Drizzle Relational Query Builder v2 (`db.query.*`) for reads when relations or simple table lookups are involved.
- For schema changes, update `src/lib/schema.ts` and run `pn drizzle-kit generate`; do not manually edit existing migrations or snapshots.

## Validation

Run these commands after making changes:

```shell
pn biome check --write
pn types
pn astro sync
pn run check
pn run cf-check
pn drizzle-kit check
```
