import type { Db } from "./database.ts";

// events.aggregate_id is text (it also stores non-uuid organization ids), so
// phases cannot join it relationally (uuid = text has no Postgres operator);
// fetch by parameterized ids instead.
export const getPhaseEventTypes = async (
	db: Db,
	phaseIds: string[],
): Promise<Map<string, string[]>> => {
	const phaseEventTypes = new Map<string, string[]>();

	if (phaseIds.length === 0) {
		return phaseEventTypes;
	}

	for (const row of await db.query.events.findMany({
		columns: { aggregateId: true, event: true },
		where: { aggregateType: "phase", aggregateId: { in: phaseIds } },
	})) {
		const list = phaseEventTypes.get(row.aggregateId) ?? [];
		list.push(row.event);
		phaseEventTypes.set(row.aggregateId, list);
	}

	return phaseEventTypes;
};
