import type { BetterAuthClientPlugin } from "better-auth/client";
import { apiKeyClient } from "@better-auth/api-key/client";
import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	plugins: [
		dashClient() as unknown as BetterAuthClientPlugin,
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
