import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/lib/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		// The direct port (5432): DDL needs a session, which PgBouncer's
		// transaction pooling does not keep. See docs/notes/secrets.md.
		// biome-ignore lint/style/noNonNullAssertion: granted by the mise task
		url: process.env.DATABASE_DIRECT_URL!,
	},
});
