// Builds the Worker and serves it in local workerd for the a11y tests; the public
// pages need no secrets or database. The programmatic preview stays in the
// foreground, where the CLI can detach from Playwright, and stops on SIGTERM.
import { build, preview } from "astro";

await build({});
await preview({ server: { port: 4322 } });
