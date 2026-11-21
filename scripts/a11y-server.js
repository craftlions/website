import { build, preview } from "astro";

await build({});
await preview({ server: { port: Number(process.env.TEST_PORT ?? 4322) } });
