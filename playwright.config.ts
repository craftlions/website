import { defineConfig, devices } from "@playwright/test";

// A11Y_BASE_URL scans an already running site instead of building one on :4322.
const baseURL = process.env.A11Y_BASE_URL ?? "http://localhost:4322";

export default defineConfig({
	testDir: "tests",
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: process.env.CI ? [["github"], ["list"]] : "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL,
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
