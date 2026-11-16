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
	// The scans and design tests run in both schemes. The end-to-end tests check
	// behaviour, which the scheme does not change, so they run once; the
	// specimen shows both schemes side by side anyway.
	projects: [
		{ name: "light", use: { colorScheme: "light" }, testIgnore: "e2e/**" },
		{ name: "dark", use: { colorScheme: "dark" }, testIgnore: "e2e/**" },
		{ name: "e2e", testMatch: "e2e/**/*.spec.ts" },
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
