import type { Db } from "./database.ts";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { invoices, organizationMetadata, phases, projects } from "./schema.ts";
import { liveInvoices, stripeInvoiceTotal } from "./stripe.ts";

export interface SpendByYearRow {
	year: number;
	projectId: string | null;
	projectName: string;
	total: number;
}

export interface BudgetConsumption {
	currentYearTotal: number;
	remainingBudget: number;
	usagePercentage: number;
}

export async function getSpendByYear(
	db: Db,
	organizationId: string,
): Promise<SpendByYearRow[]> {
	return db
		.select({
			year: sql<number>`EXTRACT(YEAR FROM to_timestamp(${liveInvoices.invoicedAt}) AT TIME ZONE 'UTC')::int`,
			projectId: projects.id,
			projectName: sql<string>`COALESCE(${projects.name}, 'Unassigned')`,
			total: sql<number>`SUM(${stripeInvoiceTotal(liveInvoices)})::float8`,
		})
		.from(liveInvoices)
		.innerJoin(
			organizationMetadata,
			eq(organizationMetadata.stripeCustomerId, liveInvoices.customer),
		)
		.leftJoin(invoices, eq(invoices.stripeId, liveInvoices.id))
		.leftJoin(phases, eq(invoices.phaseId, phases.id))
		.leftJoin(projects, eq(phases.projectId, projects.id))
		.where(
			and(
				eq(organizationMetadata.organizationId, organizationId),
				notInArray(liveInvoices.status, ["draft", "void", "uncollectible"]),
			),
		)
		.groupBy(
			sql`EXTRACT(YEAR FROM to_timestamp(${liveInvoices.invoicedAt}) AT TIME ZONE 'UTC')::int`,
			projects.id,
			projects.name,
		);
}

export function deriveBudgetConsumption(
	rows: SpendByYearRow[],
	yearlyBudget: number,
	now = new Date(),
): BudgetConsumption {
	const currentYear = now.getUTCFullYear();
	const currentYearTotal = rows
		.filter((row) => row.year === currentYear)
		.reduce((total, row) => total + row.total, 0);
	return {
		currentYearTotal,
		remainingBudget: yearlyBudget - currentYearTotal,
		usagePercentage:
			yearlyBudget > 0 ? (currentYearTotal / yearlyBudget) * 100 : 0,
	};
}
