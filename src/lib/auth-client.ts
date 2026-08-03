import { apiKeyClient } from "@better-auth/api-key/client";
import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	plugins: [
		// @better-auth/infra ships better-fetch types that are incompatible with
		// better-auth's; casting to the generic BetterAuthClientPlugin would erase
		// the inferred routes of every other plugin (e.g. admin.impersonateUser),
		// so narrow to the plugin's own shape instead.
		dashClient() as {
			id: "dash";
			getActions: () => ReturnType<ReturnType<typeof dashClient>["getActions"]>;
			pathMethods: ReturnType<typeof dashClient>["pathMethods"];
		},
		organizationClient(),
		adminClient(),
		apiKeyClient(),
	],
	sessionOptions: {
		refetchInterval: 0,
		refetchOnWindowFocus: true,
		refetchWhenOffline: false,
	},
	fetchOptions: {
		onError: async (context) => {
			const { response } = context;
			if (response.status === 429) {
				const retryAfter = response.headers.get("X-Retry-After");
				console.log(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
			}
		},
	},
});
