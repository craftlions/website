// Builds the Worker and serves it in local workerd for the a11y tests; the public
// pages need no secrets or database. The programmatic preview stays in the
// foreground, where the CLI can detach from Playwright, and stops on SIGTERM.
// TEST_PORT moves it off 4322 so several runs can share a machine.
import { build, preview } from "astro";

await build({});
await preview({ server: { port: Number(process.env.TEST_PORT ?? 4322) } });
