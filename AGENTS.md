# craftlions website

## Setup

Before any repository edit, run all of these commands:

```shell
mise i
aube ci
aubr types
aubx astro sync
```

## Hard Requirements

- Never run a dev server; assume one is already running.
- For analysis-only requests, do not modify files, branches, staging, or commits.
- Use inline Tailwind utility classes only; avoid standalone CSS rules or style blocks.
- Use CSS grid, never flexbox.
- Keep markup minimal and semantic.
- Prefer accessing values directly where they are used instead of creating one-off aliases or derived variables. Add variables only when reused, needed for type narrowing, or when they remove real complexity.
- Use Drizzle Relational Query Builder v2 (`db.query.*`) for reads when relations or simple table lookups are involved.
- For schema changes, update `src/lib/schema.ts`; **never** run `aubx drizzle-kit generate` or create or edit migrations or snapshots. Leave generation to the user because it can prompt interactively and a blind answer can accept a wrong rename.
- Reuse `src/components/Button.astro` components

## Visual Style

- Aim for a professional minimal look that could be sketched with a pen on a piece of paper
- Match existing design patterns of the project

## Validation

After making changes, run every command below. Report any failure; never claim full validation passed unless every command succeeds:

```shell
aubx drizzle-kit check
aubr types
aubr cf-check
aubx astro sync
aubr check
aubx biome check --write
```

## PlanetScale Database

- **Organization:** `craftlions`
- **Database:** `website`
- **Branch:** `main`
