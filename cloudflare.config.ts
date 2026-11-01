import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	accountId: "1dc7f5dfd6f1830ea5b903d051c6d624",
	worker: {
		name: "craftlions-website",
		compatibilityDate: "2026-04-08",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./src/worker.ts",
		workersDev: false,
		previewUrls: false,
		placement: {
			region: "aws:eu-central-1",
		},
		limits: {
			cpuMs: 60000,
		},
		cache: {
			enabled: true,
		},
		observability: {
			logs: {
				enabled: true,
				invocationLogs: true,
				headSamplingRate: 1,
				persist: true,
			},
			traces: {
				enabled: true,
				headSamplingRate: 1,
				persist: true,
			},
		},
		domains: [{ hostname: "craftlions.com", production: true, previews: true }],
		env: {
			GITHUB_CLIENT_ID: bindings.text("Ov23lieleOx1ivZtTJvO"),
			BETTER_AUTH_SECRETS: bindings.secret(),
			BETTER_AUTH_API_KEY: bindings.secret(),
			GITHUB_CLIENT_SECRET: bindings.secret(),
			STRIPE_SECRET_KEY: bindings.secret(),
			HYPERDRIVE: bindings.hyperdrive({
				id: "e78aea8d41fe4c13af446a0bd61f77b2",
				dev: {
					connectionString: "postgres://user:password@localhost:5432/database",
				},
			}),
			SESSION: bindings.kv({
				id: "988dbc04d7e84fdca174d4b899123594",
			}),
			MAIL: bindings.sendEmail({
				dev: {
					remote: true,
				},
			}),
			IMAGES: bindings.images({
				dev: {
					remote: true,
				},
			}),
			CF_VERSION_METADATA: bindings.versionMetadata(),
			ASSETS: bindings.assets(),
		},
	},
});
