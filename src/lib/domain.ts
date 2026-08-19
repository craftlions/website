import type { Db } from "./database.ts";

export class DomainError extends Error {
	constructor(
		public code:
			| "AlreadyExists"
			| "Conflict"
			| "Forbidden"
			| "InvalidTransition"
			| "NotFound"
			| "StripeUnavailable"
			| "Validation",
		message: string,
	) {
		super(message);
	}
}

export const assertAdminUser = async (db: Db, actorId: string) => {
	const actor = await db.query.user.findFirst({
		columns: { id: true, role: true },
		where: { id: actorId },
	});

	if (actor?.role !== "admin") {
		throw new DomainError("Forbidden", "Only admins can perform this action.");
	}
};
