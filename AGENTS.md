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
- Style with inline Tailwind utility classes built on the role tokens in `DESIGN.md`. Standalone CSS is allowed in `src/styles/` for tokens and global rules; avoid `<style>` blocks in components.
- Use CSS grid, never flexbox.
- Keep markup minimal and semantic.
- Prefer accessing values directly where they are used instead of creating one-off aliases or derived variables. Add variables only when reused, needed for type narrowing, or when they remove real complexity.
- Use Drizzle Relational Query Builder v2 (`db.query.*`) for reads when relations or simple table lookups are involved.
- For schema changes, update `src/lib/schema.ts`; **never** run `aubx drizzle-kit generate` or create or edit migrations or snapshots. Leave generation to the user because it can prompt interactively and a blind answer can accept a wrong rename.
- Reuse `src/components/Button.astro` components

## Browser Support

- The target is Baseline Widely available: `browserslist("baseline widely available")` in `astro.config.ts` sets the lightningcss targets.
- Use features in that set without fallbacks. A newer feature needs a fallback that keeps the page working, as `ConfirmAction` opens its dialog with `showModal()` where invoker commands are missing.

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
aubr design:lint
aubx biome check --write
```

## Accessibility Scan

- `aubr a11y` runs axe-core on the public pages and `/design` in light and dark, and fails on any violation. Run it on demand after UI changes; it is not part of Validation.
- It needs the already-running dev server at `http://localhost:4321` (`A11Y_BASE_URL` overrides it) and never starts one. The browser comes from `aubx playwright install chromium`, once.
- Fix violations instead of excluding them. An exclusion names its rule with a one-line reason in `scripts/a11y.js`.

## PlanetScale Database

- **Organization:** `craftlions`
- **Database:** `website`
- **Branch:** `main`
