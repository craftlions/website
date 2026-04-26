import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	plugins: [dashClient(), organizationClient(), adminClient()],
	sessionOptions: {
		refetchInterval: 0,
		refetchOnWindowFocus: true,
		refetchWhenOffline: false,
	},
});
