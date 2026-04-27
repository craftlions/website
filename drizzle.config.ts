import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/lib/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.PLANETSCALE_CONNECTION_STRING,
	},
});
