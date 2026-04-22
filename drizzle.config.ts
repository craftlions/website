import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dbCredentials: {
		accountId: "1dc7f5dfd6f1830ea5b903d051c6d624",
		databaseId: "78c70e61-7e19-4ebe-8cf0-7bde68d1b911",
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		token: process.env.CLOUDFLARE_D1_TOKEN!,
	},
	dialect: "sqlite",
	driver: "d1-http",
	out: "./drizzle",
	schema: "./src/lib/schema.ts",
});
