// Builds the Worker and serves it in local workerd for the a11y tests; the public
// pages need no secrets or database. Vite's preview server stops and exits on
// SIGTERM.
import { rmSync } from "node:fs";
import { build, preview } from "astro";

process.on("exit", () =>
	rmSync(".cloudflare/output", { recursive: true, force: true }),
);
await build({});
await preview({ server: { port: 4322 } });
