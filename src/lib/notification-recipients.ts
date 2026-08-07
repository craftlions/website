import type { Db } from "./database.ts";
import { eq } from "drizzle-orm";
import { member, user } from "./schema.ts";

interface NotificationRecipient {
	email: string;
	role: "owner" | "admin";
}

export const resolveNotificationRecipients = async (
	db: Db,
	organizationId: string,
): Promise<{
	owners: NotificationRecipient[];
	admins: NotificationRecipient[];
}> => {
	const members = await db
		.select({
			email: user.email,
			emailVerified: user.emailVerified,
			banned: user.banned,
			role: member.role,
		})
		.from(member)
		.innerJoin(user, eq(member.userId, user.id))
		.where(eq(member.organizationId, organizationId));

	const owners: NotificationRecipient[] = [];
	const admins: NotificationRecipient[] = [];

	for (const m of members) {
		if (m.emailVerified && !m.banned) {
			if (m.role === "owner") {
				owners.push({ email: m.email, role: "owner" });
			} else if (m.role === "admin") {
				admins.push({ email: m.email, role: "admin" });
			}
		}
	}

	return { owners, admins };
};
