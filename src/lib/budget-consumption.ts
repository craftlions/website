import type { Db } from "./database.ts";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { invoices, phases, projects } from "./schema.ts";

/**
 * S-004 R2 / S-002 R5–R7 row: one organization's complete spend history
 * grouped by UTC calendar year × project, phase-less invoices bucketed as
 * "Unassigned", with void and uncollectible invoice rows excluded.
 */
export interface SpendByYearRow {
	year: number;
	projectId: string | null;
	projectName: string;
	total: number;
}

export interface BudgetConsumption {
	/** Sum of eligible invoices in the current UTC calendar year. */
	currentYearTotal: number;
	/** yearlyBudget − currentYearTotal; negative when the budget is exceeded. */
	remainingBudget: number;
	/**
	 * currentYearTotal ÷ yearlyBudget, uncapped (D-budget-consumption-definition);
	 * 0 when there is no positive yearly budget.
	 */
	usagePercentage: number;
}

/**
 * S-004 R2: one module read accepts one organization id and returns its
 * complete spend history — no batched or current-year-only variant. The
 * group-by is the sole core-select read; every other read stays RQB v2.
 */
export async function getSpendByYear(
	db: Db,
	organizationId: string,
): Promise<SpendByYearRow[]> {
	return db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM ${invoices.invoicedAt} AT TIME ZONE 'UTC')::int`,
			projectId: projects.id,
			projectName: sql<string>`COALESCE(${projects.name}, 'Unassigned')`,
			total: sql<number>`SUM(${invoices.total})::float8`,
		})
		.from(invoices)
		.leftJoin(phases, eq(invoices.phaseId, phases.id))
		.leftJoin(projects, eq(phases.projectId, projects.id))
		.where(
			and(
				eq(invoices.organizationId, organizationId),
				or(
					isNull(invoices.stripeStatus),
					ne(invoices.stripeStatus, "void"),
					ne(invoices.stripeStatus, "uncollectible"),
				),
			),
		)
		.groupBy(
			sql`EXTRACT(YEAR FROM ${invoices.invoicedAt} AT TIME ZONE 'UTC')::int`,
			projects.id,
			projects.name,
		);
}

/**
 * S-004 R3 + R5 / D-budget-consumption-definition: the current-year invoice
 * total and derived budget figures come from the module's full-history rows —
 * no product surface computes consumption locally.
 */
export function deriveBudgetConsumption(
	rows: SpendByYearRow[],
	yearlyBudget: number,
	now = new Date(),
): BudgetConsumption {
	const currentYear = now.getUTCFullYear();
	const currentYearTotal = rows
		.filter((row) => row.year === currentYear)
		.reduce((total, row) => total + row.total, 0);
	const remainingBudget = yearlyBudget - currentYearTotal;
	const usagePercentage =
		yearlyBudget > 0 ? (currentYearTotal / yearlyBudget) * 100 : 0;
	return { currentYearTotal, remainingBudget, usagePercentage };
}
