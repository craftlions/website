import * as t from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

export const user = sqliteTable(
	"user",
	{
		id: t.text("id").primaryKey(),
		name: t.text("name").notNull(),
		email: t.text("email").notNull(),
		emailVerified: t.integer("email_verified").notNull(),
		image: t.text("image"),
		createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: t.integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [t.uniqueIndex("user_email_idx").on(table.email)],
);

export const session = sqliteTable(
	"session",
	{
		id: t.text("id").primaryKey(),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		token: t.text("token").notNull(),
		expiresAt: t.integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		ipAddress: t.text("ip_address"),
		userAgent: t.text("user_agent"),
		createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: t.integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		activeOrganizationId: t.text("active_organization_id"),
		activeTeamId: t.text("active_team_id"),
	},
	(table) => [
		t.index("session_user_id_idx").on(table.userId),
		t.uniqueIndex("session_token_idx").on(table.token),
	],
);

export const account = sqliteTable(
	"account",
	{
		id: t.text("id").primaryKey(),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: t.text("account_id").notNull(),
		providerId: t.text("provider_id").notNull(),
		accessToken: t.text("access_token"),
		refreshToken: t.text("refresh_token"),
		accessTokenExpiresAt: t.integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: t.integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: t.text("scope"),
		idToken: t.text("id_token"),
		password: t.text("password"),
		createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: t.integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [t.index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: t.text("id").primaryKey(),
		identifier: t.text("identifier").notNull(),
		value: t.text("value").notNull(),
		expiresAt: t.integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: t.integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [t.index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = sqliteTable("rate_limit", {
	id: t.text("id").primaryKey(),
	key: t.text("key").notNull().unique(),
	count: t.integer("count").notNull(),
	lastRequest: t.blob("last_request", { mode: "bigint" }).notNull(),
});

export const organization = sqliteTable(
	"organization",
	{
		id: t.text("id").primaryKey(),
		name: t.text("name").notNull(),
		slug: t.text("slug").notNull(),
		logo: t.text("logo"),
		metadata: t.text("metadata"),
		createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [t.uniqueIndex("organization_slug_idx").on(table.slug)],
);

export const member = sqliteTable(
	"member",
	{
		id: t.text("id").primaryKey(),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		role: t.text("role").notNull(),
		createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		t.index("member_user_id_idx").on(table.userId),
		t.index("member_organization_id_idx").on(table.organizationId),
	],
);

export const invitation = sqliteTable(
	"invitation",
	{
		id: t.text("id").primaryKey(),
		email: t.text("email").notNull(),
		inviterId: t
			.text("inviter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		role: t.text("role"),
		status: t.text("status").notNull(),
		createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
		expiresAt: t.integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		t.index("invitation_email_idx").on(table.email),
		t.index("invitation_organization_id_idx").on(table.organizationId),
	],
);
