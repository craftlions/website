// Builds the Worker and serves it in local workerd for the a11y tests; the public
// pages need no secrets or database. Vite's preview server stops and exits on
// SIGTERM. The build lands in the deployable .cloudflare/output with /design in it,
// so it is deleted on exit to keep `cf deploy --prebuilt` from shipping it.
import { rmSync } from "node:fs";
import { build, preview } from "astro";

process.on("exit", () =>
	rmSync(".cloudflare/output", { recursive: true, force: true }),
);
await build({
	integrations: [
		{
			// The dev-only /design page, added to this build alone so it can be scanned.
			name: "a11y-design-page",
			hooks: {
				"astro:config:setup": ({ injectRoute }) =>
					injectRoute({
						pattern: "/design",
						entrypoint: "./src/pages/_design.astro",
					}),
			},
		},
	],
});
await preview({ server: { port: 4322 } });
