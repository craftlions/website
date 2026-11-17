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

- Never start `astro dev` (`aubr dev`, `mise run dev`): the dev server is the owner's and runs against real data. The test suites build and serve their own preview.
- For analysis-only requests, do not modify files, branches, staging, or commits.
- Use the element that carries the meaning (`nav`, `ul`, `dl`, `table`) before a `div`, and add no wrapper without a style or a role.
- Prefer accessing values directly where they are used instead of creating one-off aliases or derived variables. Add variables only when reused, needed for type narrowing, or when they remove real complexity.
- Use Drizzle Relational Query Builder v2 (`db.query.*`) for reads when relations or simple table lookups are involved.
- For schema changes, update `src/lib/schema.ts`; never run `aubx drizzle-kit generate` or create or edit migrations or snapshots. Leave generation to the user because it can prompt interactively and a blind answer can accept a wrong rename.

## Styling

- Style with the native CSS in `src/styles/`; `global.css` imports every file and declares the cascade layers. Read `DESIGN.md#vocabulary` before writing CSS: it lists the tokens, element defaults, layout primitives, the lines pattern and the role utilities.
- Compose layouts from the primitives in `src/styles/layout.css` before writing layout CSS, and let them switch on their own width rather than the window's: no container queries and no window-width media queries.
- Put a component's rules in its own `src/styles/components/<name>.css`, never in a `<style>` in a component; a page keeps only its one-off layout in a scoped `<style>` holding `@layer page { … }`.
- Show a list of things to find and act on as lines (`DESIGN.md#lines`), with no column heads; keep a real `<table>` only for data compared across rows, in a labelled scroll region with `tabindex="0"`.
- Set a variant with a `data-*` attribute from the owning component and a state with ARIA or a native pseudo-class; a class says what a thing is.
- `aubr design:lint` enforces the tokens, layers, vocabulary and primitives; its message names what to use instead.

## Browser Support

- What a page needs to work is Baseline Widely available: `browserslist("baseline widely available")` in `astro.config.ts` sets the lightningcss targets; use those features without fallbacks.
- Use a newer feature only where a browser without it still works: mark it `/* enhancement: what is lost without it */` when only polish is lost, as `hidden="until-found"` loses find in page, or keep the Widely available way beside it and mark it `/* fallback: … */`, as `ConfirmAction` opens its dialog with `showModal()` where invoker commands are missing. In markup write `{/* … */}`, in scripts `// …`.
- Never put layout in a rule that browsers without the feature drop whole (`@scope`, `@function`) without that fallback; a dropped rule is a broken page, not lost polish.
- Check a feature's status in `web-features` or the modern-web-guidance guide, not from memory.

## Visual Style

- Aim for a professional minimal look that could be sketched with a pen on a piece of paper: match `DESIGN.md` and the components on `/brand/specimen`.

## Validation

After making changes, run every command below. Report any failure; never claim full validation passed unless every command succeeds:

```shell
mise run db:check
aubr types
aubr cf-check
aubx astro sync
aubr check
aubr design:lint
aubr unit
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

## Tests

- `aubr e2e` checks behaviour a signed-out visitor gets: the public pages and their headers, the login redirects, the auth forms up to the API, the dialogs and disclosures on `/brand/specimen`, and the logo files.
- `aubr design:test` checks rendering in `tests/design/` over `tests/routes.ts` in light and dark: reflow, target sizes, the element defaults, the fluid scales, the primitives and the lines on their specimen fixtures, the logo and contrast.
- `aubr a11y` runs axe-core on the public pages and `/brand/specimen` in light and dark, and again on the states axe skips while hidden: the specimen's disclosures, confirmations and palette open, and the auth forms showing their errors. What axe cannot decide does not fail; each test attaches it as `axe-incomplete.json` for a person to triage. A clean scan is not proof of accessibility. Fix a violation instead of excluding it; an exclusion names its rule with a one-line reason in `tests/a11y.spec.ts`.
- `aubr unit` runs `node:test` without a browser: the pure helpers in `src/lib` (`tests/unit/`) and `scripts/design-lint.js` on accepted and rejected fixtures that mirror `src/` (`tests/design-lint/`). Add a rejected fixture with its expected message when a lint rule changes.
- Run them after UI or behaviour changes; the Test workflow runs all three on every pull request and push to `main`, beside a static job that runs every Validation command but `db:check`, which needs the database URL. They build and serve the Worker on port 4322 (or `TEST_PORT`, so runs can share a machine) and need no dev server, secrets or database; `A11Y_BASE_URL` points them at a running site. The browser comes from `aubx playwright install chromium`, once.
- Test only what works without the database: anything that signs in, sends mail or reads data waits for a test database. Never mock the backend or add test-only paths to `src/`. Pages behind login have no harness; `/brand/specimen` renders what they use, and the owner reviews them by eye.

## PlanetScale Database

- **Organization:** `craftlions`
- **Database:** `website`
- **Branch:** `main`
