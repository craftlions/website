import { defineConfig, devices } from "@playwright/test";

// A11Y_BASE_URL tests an already running site instead of building one on
// TEST_PORT (4322 by default), which scripts/a11y-server.js serves.
const baseURL =
	process.env.A11Y_BASE_URL ??
	`http://localhost:${process.env.TEST_PORT ?? 4322}`;

export default defineConfig({
	testDir: "tests",
	forbidOnly: !!process.env.CI,
	retries: 0,
	// CI keeps an HTML report and the traces of failed tests for the artifact.
	reporter: process.env.CI
		? [["github"], ["list"], ["html", { open: "never" }]]
		: "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		trace: process.env.CI ? "retain-on-failure" : "off",
		viewport: { width: 1280, height: 800 },
	},
	projects: [
		{ name: "light", use: { colorScheme: "light" } },
		{ name: "dark", use: { colorScheme: "dark" } },
	],
	...(!process.env.A11Y_BASE_URL && {
		webServer: {
			command: "node scripts/a11y-server.js",
			url: baseURL,
			reuseExistingServer: false,
			timeout: 120_000,
			gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
		},
	}),
});
