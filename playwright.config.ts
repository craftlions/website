import { defineConfig, devices } from "@playwright/test";

const baseURL =
	process.env.A11Y_BASE_URL ??
	`http://localhost:${process.env.TEST_PORT ?? 4322}`;

const ignored = ["e2e/**", "unit/**", "design-lint/**"];

export default defineConfig({
	testDir: "tests",
	forbidOnly: !!process.env.CI,
	retries: 0,
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
		{ name: "light", use: { colorScheme: "light" }, testIgnore: ignored },
		{ name: "dark", use: { colorScheme: "dark" }, testIgnore: ignored },
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
