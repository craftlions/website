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

- Never start `astro dev` (`aubr dev`, `mise run dev`): the dev server is the owner's and runs against real data. Assume none is running; `aubr a11y` and `aubr design:test` build and serve their own preview on port 4322.
- For analysis-only requests, do not modify files, branches, staging, or commits.
- Style with inline Tailwind utility classes built on the role tokens in `DESIGN.md` while the site moves to native CSS. Standalone CSS lives in `src/styles/`: `global.css` declares the layer order (`theme, reset, tokens, base, layout, components, utilities`; Tailwind's theme and utilities fill `theme` and `utilities` until it is removed) and imports the other files, each inside one layer: `reset.css` replaces Tailwind's Preflight, `tokens.css` holds the tokens and `base.css` the element defaults. Avoid `<style>` blocks in components.
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
mise run db:check
aubr types
aubr cf-check
aubx astro sync
aubr check
aubr design:lint
aubx biome check --write
```

## Git

- Never commit on `main`. Work on a branch in a worktree at `../.worktrees/website/<name>` beside the owner's checkout, which stays untouched: `git worktree add -b <branch> ../.worktrees/website/<name> origin/main`.
- Make each commit one logical change that reverts on its own and leaves Validation passing.
- Write Conventional Commit subjects as in `git log`: `type(scope): lowercase imperative summary`.
- Add no attribution to commits or pull requests: no `Co-Authored-By` trailer, no "Generated with" line.
- Let the hk pre-commit hooks run and fix what they report; never bypass them with `--no-verify` or `HK_SKIP_STEPS`.
- Open one pull request per logical change, always against `main`; it deploys a preview Worker. Never base one on another branch, because GitHub closes it when that branch is deleted on merge; keep work that depends on an unmerged pull request local until that one lands.
- Merge only after the owner approves on the pull request (e.g. "lgtm ff no merge commit"), and only by fast-forward from the command line, never a merge commit or a squash. If `main` has moved, rebase the branch and push it with `--force-with-lease=<branch>:<sha you expect on the remote>`; then `git push origin <branch>:main`, which deploys production and marks the pull request merged.
- Force-push only branches an agent created, always with `--force-with-lease`; never force-push `main`.
- This repository is public: commit messages and pull request text never describe an unfixed security weakness. Add the reasoning once the fix is live.

## Secrets

- Secret values live age-encrypted in `fnox.toml` and reach a process only through a mise task grant; `docs/notes/secrets.md` describes the setup.
- Never read, print, copy or write a secret value: no `.env` files, no `~/.config/fnox/`, no `fnox get`, `fnox export`, `fnox exec` or `op read`, no `--secrets` flags.
- `mise run db:check` is the only secret-granted task for agents; it receives only the database URL. `mise run dev` and `mise run secrets:push` are the owner's.
- The pre-commit step `fnox-scan` rejects staged changes that contain a value from `fnox.toml`.

## Accessibility Scan

- `aubr a11y` runs Playwright Test with axe-core on the public pages, the component specimen at `/brand/specimen` included, in light and dark, and fails on any violation. Run it on demand after UI changes; it is not part of Validation.
- It needs no dev server, secrets or database: `scripts/a11y-server.js` builds the Worker and serves it with Astro's preview API on `http://localhost:4322`; the `astro preview` CLI would detach from Playwright. `A11Y_BASE_URL` scans a running site instead. The browser comes from `aubx playwright install chromium`, once.
- Fix violations instead of excluding them. An exclusion names its rule with a one-line reason in `tests/a11y.spec.ts`.

## Design Tests

- `aubr design:test` runs Playwright Test on `tests/design/`, over the routes in `tests/routes.ts` in light and dark. `reflow.spec.ts` fails when a page scrolls sideways at 320px, at 640px with a device scale factor of 2 (200% zoom) or with a 32px default font size (200% text), when text sits in a zero-width box, or when a control clips its text outside `.truncate`. `targets.spec.ts` fails on a target below 24×24px that misses the spacing exception of WCAG 2.5.8; links inside a sentence are exempt. Run it on demand after UI changes; it is not part of Validation.
- It shares `playwright.config.ts` with the accessibility scan, so it builds and serves the Worker on `http://localhost:4322` and needs no dev server, secrets or database; `aubr a11y` runs only `tests/a11y.spec.ts`. `A11Y_BASE_URL` points both at a running site.
- Pages behind login have no harness: `/brand/specimen` renders the primitives they use, and the owner reviews the pages themselves by eye.

## PlanetScale Database

- **Organization:** `craftlions`
- **Database:** `website`
- **Branch:** `main`
