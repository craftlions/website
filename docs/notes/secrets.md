# Secrets

Four values are secret. Three are Worker secrets that Cloudflare keeps between deploys; the fourth is the PlanetScale connection string that local dev and Drizzle use.

| Name                                                       | Used by                                         |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `BETTER_AUTH_SECRETS`                                      | Worker, `mise run dev`, `mise run secrets:push` |
| `BETTER_AUTH_API_KEY`                                      | Worker, `mise run dev`, `mise run secrets:push` |
| `GITHUB_CLIENT_SECRET`                                     | Worker, `mise run dev`, `mise run secrets:push` |
| `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` | `mise run dev`, `mise run db:check`             |

`GITHUB_CLIENT_ID` is public and set in `cloudflare.config.ts`. CI holds only `CLOUDFLARE_API_TOKEN`.

## How it works

- [fnox](https://fnox.jdx.dev) 1.48.0, pinned in `mise.toml`, stores each value age-encrypted in the committed `fnox.toml`. The age key is `~/.config/fnox/age.txt` on the owner's machine.
- `fnox.toml` sets `env = "exec"`, so no value enters an interactive shell, and `if_missing = "error"`, so a value that does not decrypt stops the command.
- mise reads fnox through `[secrets.fnox]`. A task receives only the keys in its `secrets` list, and mise prints `[redacted]` wherever a value appears in its output. A task's dependencies receive nothing.
  - `mise run dev` gets all four (owner only).
  - `mise run db:check` gets only the database URL and runs `aubx drizzle-kit check`.
  - `mise run secrets:push` builds without secrets, asks before it deploys, and runs `cf deploy --prebuilt --secrets-file cloudflare.secrets.env` with the three Worker secrets (owner only). That file holds only `NAME=${NAME}` lines; `cf` fills them from the task's environment and uploads them with the new version. Worker secrets that are not in the file stay as they are.
- The hk pre-commit step `fnox-scan` runs `fnox scan --values --staged`. It decrypts the values with the age key and rejects a commit whose staged changes contain one, printing only the secret's name. Without the age key it fails; on such a machine, commit with `HK_SKIP_STEPS=fnox-scan`.
- `.claude/settings.json` denies agents reading `.env` files and `~/.config/fnox/`, running `fnox get`, `fnox export`, `fnox exec` and `op read`, passing `--secrets` to mise, and running `dev` and `secrets:push`.

## What this protects, and what it does not

- The ciphertext in `fnox.toml` is public in git history for good. It is only as safe as `~/.config/fnox/age.txt`, a plain file that any process running as the owner can read: an editor plugin, a dependency's install script, or an agent's subprocess. Whoever copies the key, now or later, can decrypt every value ever committed. The X25519 key that `age-keygen` makes by default is not post-quantum, so stored ciphertext can also be attacked later.
- Grants keep values out of the shell, of other tasks and of task output. They do not isolate them: mise's docs say that grants "do not isolate it from other processes of that user: such a process can read a granted task's environment and its secret files while it runs."
- The Claude Code deny rules match the commands an agent usually writes, not every way to read a file. The docs say a Bash deny rule "isn't a security boundary around the program", and Read rules do not cover "arbitrary subprocesses that read or write files indirectly, like a Python or Node script". They stop accidental reads, not a determined process.
- `mise run db:check` puts the production database credential into the agent's `drizzle-kit` process. Its output is redacted, but the process and its dependencies hold the value. The `fnox-scan` hook decrypts all four values inside `fnox` on every commit, including an agent's; it prints only names.
- The values sat in a plaintext `.env` that earlier agent sessions could read. They are not rotated.
- To require a human for each decryption, point the age provider's `key_file` at a passphrase-protected identity (`age-keygen | age -p -o identity.age`) or store the identity in the macOS keychain. fnox then needs a terminal to decrypt, so agents can no longer run `mise run db:check` and the hook needs the passphrase on every commit.

## Migrate from .env

Run every step yourself, in your own terminal in the repository root, outside any agent session. No command prints a value. Steps 1 to 5 change nothing that others depend on; until step 9, `.env` and `aubx drizzle-kit check` keep working.

1. Install the pinned fnox and check mise (2026.11.8 or newer):

   ```sh
   mise i
   mise --version
   fnox --version   # fnox 1.48.0
   ```

2. Confirm the age key. If it exists, keep it; otherwise create it with owner-only permissions:

   ```sh
   test -f ~/.config/fnox/age.txt && echo "age key present"
   # only if it is missing:
   mkdir -p ~/.config/fnox && (umask 077 && mise x age@1.3.2 -- age-keygen -o ~/.config/fnox/age.txt)
   chmod 600 ~/.config/fnox/age.txt
   ```

   Keep a copy of `age.txt` somewhere safe outside this machine, such as a password manager. Without it the committed values cannot be decrypted, and once `.env` is gone nothing else holds them.

3. Add the age provider with your public recipient (`age-keygen -y` prints only the public key):

   ```sh
   recipient=$(mise x age@1.3.2 -- age-keygen -y ~/.config/fnox/age.txt)
   printf '\n[providers.age]\ntype = "age"\nrecipients = ["%s"]\n' "$recipient" >> fnox.toml
   ```

4. Encrypt the four values from `.env` into `fnox.toml`. The dry run lists only key names; the real run asks for confirmation and prints only names:

   ```sh
   keys='^(BETTER_AUTH_SECRETS|BETTER_AUTH_API_KEY|GITHUB_CLIENT_SECRET|CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE)$'
   fnox import -i .env -p age --filter "$keys" --dry-run   # must list exactly the four names
   fnox import -i .env -p age --filter "$keys"
   fnox check            # resolves each value, prints none
   mise secrets ls       # four keys, ENV exec, with their tasks
   git diff fnox.toml    # [providers.age] and four `value = "YWdl…"` ciphertexts, nothing else
   ```

   fnox reads `.env` as dotenv. Vite also expands `$NAME` inside unquoted and double-quoted `.env` values; if one of the four contains a `$`, compare the result in step 5 with care.

5. Verify without `.env`. Stop your running dev server, then move `.env` out of the repository (not to `.env.*`, which the gitignore does not cover):

   ```sh
   mv .env ~/craftlions-website.env.bak
   mise run db:check
   mise run dev
   ```

   In the dev server, sign in with GitHub and with email, and open a page that reads the database. A failure here means the dev server does not pick secrets up from the environment: move the file back with `mv ~/craftlions-website.env.bak .env` and stop.

6. Dry-run the Worker secrets, then push them. Run this from a clean `main` that matches what is deployed, because it deploys the build:

   ```sh
   mise run secrets:push --dry-run   # answer the prompt; builds and checks, uploads nothing
   mise run secrets:push             # deploys a new version with the three secrets
   ```

   The values are the ones the Worker already has, so the site should behave the same. Check it after the deploy.

7. Commit the ciphertext. The `fnox-scan` hook now decrypts the values and checks the commit:

   ```sh
   fnox scan --values   # no tracked file holds a value
   git add fnox.toml
   git commit -m "build(fnox): add the age-encrypted secrets"
   ```

8. Delete the old plaintext file:

   ```sh
   rm ~/craftlions-website.env.bak
   ```

9. Switch the validation command, which now needs the database URL from fnox. In the `## Validation` block of `AGENTS.md` (`CLAUDE.md` links to it), replace the line `aubx drizzle-kit check` with `mise run db:check`:

   ```sh
   sed -i '' 's/^aubx drizzle-kit check$/mise run db:check/' AGENTS.md
   git diff AGENTS.md   # one line changed
   git commit -m "docs(agents): check migrations through mise run db:check" AGENTS.md
   ```

## Later changes

- Change a value: `fnox set NAME --provider age` (hidden prompt), commit `fnox.toml`, then `mise run secrets:push` for a Worker secret.
- Add a secret: add it the same way, list it in the `secrets` of each task that needs it, and add `NAME=${NAME}` to `cloudflare.secrets.env` if the Worker needs it.
- Give CI a value: create a separate age key for CI, add its public key to `recipients`, run `fnox reencrypt -p age`, and store the private key as the `FNOX_AGE_KEY` GitHub secret.
