- (Notifications e.g. Mail, Slack, Webhook)
- Self-service
  - API
    - Projects
    - Phases
    - Invoices
  - Export CSV
- Refactor: store `null` instead of `0` for phase cost components that carry nothing (currently zero-cost phases must keep one `0` component because of the `phases_cost_components_consistency` check; UI/billing code filters `amount === 0` as a workaround)

## commands

Install all dev tools

```shell
mise upgrade --interactive --bump --local
mise i
```

Install git hooks

```shell
hk install
```

Install all deps if not done by `mise` add `sfw` beforehand

```shell
sfw aube ci
sfw aube i
```

Update browserlist

```shell
aubx update-browserslist-db latest
```

Generate types

```shell
aubr types
```

sync astro

```shell
aubx astro sync
```

Biome

```shell
aubx biome check --write
```

Types

```shell
aubr check
```

Deploy to cloudflare

```shell
aubr deploy
```

```shell
aubx auth info
aubx auth generate

aubx drizzle-kit up
aubx drizzle-kit generate
aubx drizzle-kit check

aubx drizzle-kit migrate
```

```shell
git switch $1
git fetch --all
git rebase -i origin/main

git switch main
git pull
git merge --ff-only $1

git push

git push origin --delete $1
git branch -d $1
```

```shell
hk check --all
jactionlint
aubx ci-doctor
aubx gha-budget
```
