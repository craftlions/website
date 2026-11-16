# Secrets

Four values are secret. Three are Worker secrets that Cloudflare keeps between deploys; the fourth is the PlanetScale connection string that local dev and Drizzle use.

| Name                                                       | Used by                                         |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `BETTER_AUTH_SECRETS`                                      | Worker, `mise run dev`, `mise run secrets:push` |
| `BETTER_AUTH_API_KEY`                                      | Worker, `mise run dev`, `mise run secrets:push` |
| `GITHUB_CLIENT_SECRET`                                     | Worker, `mise run dev`, `mise run secrets:push` |
| `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` | `mise run dev`, `mise run db:check`             |

`BETTER_AUTH_API_KEY` is the key of Better Auth Infrastructure, which the `dash` plugin in `src/lib/auth.ts` reads; it is not a key of this site's own API, which does not exist yet. `GITHUB_CLIENT_ID` is public and set in `cloudflare.config.ts`, which declares the three Worker secrets as `bindings.secret()`. CI holds only `CLOUDFLARE_API_TOKEN`: `.github/workflows/deploy.yml` builds and deploys with `--prebuilt` and never touches a Worker secret.

## How it works

- [fnox](https://fnox.jdx.dev) 1.48.0, pinned in `mise.toml`, stores each value age-encrypted in the committed `fnox.toml`. The age key is `~/.config/fnox/age.txt` on the owner's machine.
- `fnox.toml` sets `env = "exec"`, so no value enters an interactive shell, and `if_missing = "error"`, so a value that does not decrypt stops the command.
- mise reads fnox through `[secrets.fnox]`. A task receives only the keys in its `secrets` list, and mise prints `[redacted]` wherever a value appears in its output. A task's dependencies receive nothing.
  - `mise run dev` gets all four and runs `aubr dev` (owner only).
  - `mise run db:check` gets only the database URL and runs `aubx drizzle-kit check`. It is the only secret-granted task agents run.
  - `mise run secrets:push` builds without secrets, asks before it deploys, and runs `cf deploy --prebuilt --secrets-file cloudflare.secrets.env` with the three Worker secrets (owner only). That file holds only `NAME=${NAME}` lines; `cf` fills them from the task's environment and uploads them with the new version. Worker secrets that are not in the file stay as they are. A second run waits until the first one exits, in any worktree of the repository, so two deploys never overlap.
- The hk pre-commit step `fnox-scan` runs `fnox scan --values --staged`. It decrypts the values with the age key and rejects a commit whose staged changes contain one, printing only the secret's name. Without the age key it fails.
- `.claude/settings.json` denies agents reading `.env` files and `~/.config/fnox/`, running `fnox get`, `fnox export`, `fnox exec` and `op read`, passing `--secrets` to mise, and running `dev` and `secrets:push`.

## Agents

- Never read, print, copy or write a secret value: no `.env` files, no `~/.config/fnox/`, no `fnox get`, `fnox export`, `fnox exec` or `op read`, no `--secrets` flags.
- Run `mise run db:check` as part of Validation; it is the only task that hands an agent a secret. `mise run dev` and `mise run secrets:push` are the owner's.

## When `fnox-scan` rejects a commit

The hooks are never bypassed: no `--no-verify`, no `HK_SKIP_STEPS`.

- It names a secret: a staged change holds that value. Remove the value from the file, stage the file again and commit.
- It fails because the age key is missing: fnox cannot decrypt the values, so the commit cannot be checked on that machine. Commit from a machine that has the key.

## What this protects, and what it does not

- The ciphertext in `fnox.toml` is public in git history for good. It is only as safe as `~/.config/fnox/age.txt`, a plain file that any process running as the owner can read: an editor plugin, a dependency's install script, or an agent's subprocess. Whoever copies the key, now or later, can decrypt every value ever committed. The X25519 key that `age-keygen` makes by default is not post-quantum, so stored ciphertext can also be attacked later.
- Keep a copy of `age.txt` somewhere safe outside this machine, such as a password manager. Without it the committed values cannot be decrypted, and nothing else holds them.
- Grants keep values out of the shell, of other tasks and of task output. They do not isolate them: mise's docs say that grants "do not isolate it from other processes of that user: such a process can read a granted task's environment and its secret files while it runs."
- The Claude Code deny rules match the commands an agent usually writes, not every way to read a file. The docs say a Bash deny rule "isn't a security boundary around the program", and Read rules do not cover "arbitrary subprocesses that read or write files indirectly, like a Python or Node script". They stop accidental reads, not a determined process.
- `mise run db:check` puts the production database credential into the agent's `drizzle-kit` process. Its output is redacted, but the process and its dependencies hold the value. The `fnox-scan` hook decrypts all four values inside `fnox` on every commit, including an agent's; it prints only names.
- The values sat in a plaintext `.env` that earlier agent sessions could read. They are not rotated.
- To require a human for each decryption, point the age provider's `key_file` at a passphrase-protected identity (`age-keygen | age -p -o identity.age`) or store the identity in the macOS keychain. fnox then needs a terminal to decrypt, so agents can no longer run `mise run db:check` and the hook needs the passphrase on every commit.

## Changes

Run these yourself, in your own terminal in the repository root, outside any agent session. None prints a value.

- Check the setup: `fnox check` resolves each value and prints none; `mise secrets ls` lists the four keys with their tasks.
- Change or rotate a value: `fnox set NAME --provider age` (hidden prompt), commit `fnox.toml`, then push it to the Worker if it is a Worker secret.
- Push the Worker secrets from a clean `main` that matches what is deployed, because it deploys the build: `mise run secrets:push --dry-run` builds and checks without uploading; `mise run secrets:push` deploys a new version with the three secrets. Check the site afterwards.
- Add a secret: add it the same way, list it in the `secrets` of each task that needs it, and add `NAME=${NAME}` to `cloudflare.secrets.env` and a `bindings.secret()` to `cloudflare.config.ts` if the Worker needs it.
- Give CI a value: create a separate age key for CI, add its public key to `recipients`, run `fnox reencrypt -p age`, and store the private key as the `FNOX_AGE_KEY` GitHub secret.

## History

The values moved from a plaintext `.env` into `fnox.toml` in `5945edd` (`build(fnox): add the age-encrypted secrets`). The one-time migration runbook is in this file as of `bda362e`.
