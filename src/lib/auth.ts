import { env } from "cloudflare:workers";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { db } from "./database.ts";

export const auth = betterAuth({
	account: {
		encryptOAuthTokens: true,
		skipStateCookieCheck: false,
		storeAccountCookie: false,
		storeStateStrategy: "database",
		updateAccountOnSignIn: true,
	},
	advanced: {
		ipAddress: {
			ipAddressHeaders: ["cf-connecting-ip"],
			ipv6Subnet: 64,
		},
	},
	appName: "craftlions website",
	baseURL: {
		allowedHosts: [
			"craftlions.com",
			"craftlions-website.craftlions.workers.dev",
			"*-craftlions-website.craftlions.workers.dev",
			"localhost:*",
		],
		protocol: "auto",
	},
	database: drizzleAdapter(db, {
		provider: "sqlite",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await env.MAIL.send({
				from: {
					name: "craftlions",
					email: "no-reply@craftlions.com",
				},
				to: user.email,
				subject: "Reset your password",
				text: `Click the link to reset your password: ${url}`,
			});
		},
	},
	emailVerification: {
		sendOnSignIn: true,
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url }) => {
			await env.MAIL.send({
				from: {
					name: "craftlions",
					email: "no-reply@craftlions.com",
				},
				to: user.email,
				subject: "Verify your email address",
				text: `Click the link to verify your email: ${url}`,
			});
		},
	},
	user: {
		changeEmail: {
			enabled: true,
			sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
				await env.MAIL.send({
					from: {
						name: "craftlions",
						email: "no-reply@craftlions.com",
					},
					to: user.email,
					subject: "Approve email change",
					text: `Click the link to approve the change to ${newEmail}: ${url}`,
				});
			},
		},
	},
	experimental: {
		// joins: true,
	},
	plugins: [
		dash({
			activityTracking: {
				enabled: true,
				updateInterval: 300000, // Update interval in ms (default: 5 minutes)
			},
		}),
		organization({
			allowUserToCreateOrganization: false,
			// teams
			// sendInvitationEmail
		}),
	],
	rateLimit: {
		storage: "database",
		window: 60,
		max: 100,
	},
	session: {
		cookieCache: {
			enabled: false,
			maxAge: 5 * 60,
			strategy: "jwe",
		},
		storeSessionInDatabase: true,
	},
});
