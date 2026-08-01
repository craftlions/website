import type { Db } from "./database.ts";

export const getAdminOrganizationCore = (db: Db, id: string) =>
	db.query.organization.findFirst({
		columns: {
			id: true,
			name: true,
			slug: true,
		},
		where: {
			id,
		},
	});
