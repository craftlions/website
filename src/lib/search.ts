// The caller's authorised search slice, read with the page queries' shapes,
// and the items the ranker in search-query.ts searches. The slice is loaded
// per request and never cached: an isolate serves many users.

import type { Db } from "./database.ts";
import { clientPhaseLabel } from "./client-worklist.ts";
import { formatDate, formatDays, formatMoney } from "./format.ts";
import { type RankItem, searchField } from "./search-query.ts";
import {
	costPartLabel,
	daysOverdue,
	invoiceStatus,
	isInvoiceOverdue,
	memberRole,
	phaseStatus,
	projectStatus,
} from "./status.ts";
import { stripeInvoiceFields } from "./stripe.ts";

const invoiceColumns = {
	columns: stripeInvoiceFields.columns,
	extras: { total: stripeInvoiceFields.extras.total },
} as const;

const phaseColumns = {
	publicId: true,
	title: true,
	state: true,
	cost: true,
	currency: true,
} as const;

// Every organization, as admin/index.astro, admin/org/[id]/members.astro and
// admin/org/[id]/projects(/[publicId]).astro list them, and every invoice the
// organizations' Invoices tabs show (attached ones of any status, unattached
// ones except drafts). Only for a session whose user is an admin.
const loadAdminSlice = (db: Db) =>
	Promise.all([
		db.query.organization.findMany({
			columns: { id: true, name: true, slug: true },
			with: {
				members: {
					columns: { id: true, role: true },
					with: { user: { columns: { name: true, email: true } } },
					orderBy: { createdAt: "asc" },
				},
				projects: {
					columns: { publicId: true, name: true, state: true },
					with: { phases: { columns: phaseColumns, orderBy: { id: "asc" } } },
					orderBy: { name: "asc" },
				},
			},
			orderBy: { name: "asc" },
		}),
		db.query.stripeInvoices.findMany({
			...invoiceColumns,
			with: {
				link: {
					columns: { component: true },
					with: {
						phase: {
							columns: {
								publicId: true,
								title: true,
								upfrontAmount: true,
								deliveryAmount: true,
								acceptanceAmount: true,
							},
							with: {
								project: {
									columns: { publicId: true, name: true, organizationId: true },
								},
							},
						},
					},
				},
				metadata: { columns: { organizationId: true } },
			},
			where: {
				OR: [
					{ link: true },
					{ NOT: { link: true }, status: { ne: "draft" }, metadata: true },
				],
			},
			orderBy: { invoicedAt: "desc" },
		}),
	]);

// The organizations the user is a member of, with their projects and phases
// as dash/org/[slug].astro and its project pages show them, and the invoices
// their Invoices tabs show (organizationStripeInvoices: no drafts). Both
// queries are bound to the session's user id and nothing else.
const loadMemberSlice = (db: Db, userId: string) =>
	Promise.all([
		db.query.member.findMany({
			columns: { role: true },
			with: {
				organization: {
					columns: { id: true, name: true, slug: true },
					with: {
						projects: {
							columns: { publicId: true, name: true, state: true },
							with: {
								phases: {
									columns: phaseColumns,
									orderBy: { dueAt: "asc", id: "asc" },
								},
							},
							orderBy: { name: "asc" },
						},
					},
				},
			},
			where: { userId },
		}),
		db.query.stripeInvoices.findMany({
			...invoiceColumns,
			with: {
				link: {
					columns: { component: true },
					with: {
						phase: {
							columns: { publicId: true, title: true },
							with: { project: { columns: { publicId: true, name: true } } },
						},
					},
				},
				metadata: { columns: { organizationId: true } },
			},
			where: {
				status: { ne: "draft" },
				metadata: { organization: { members: { userId } } },
			},
			orderBy: { invoicedAt: "desc" },
		}),
	]);

interface Invoice {
	id: string;
	number: string;
	status: string;
	currency: string;
	invoicedAt: Date;
	dueAt: Date | null;
	paidAt: Date | null;
	total: number;
}

export interface SearchSlice {
	items: RankItem[];
	currencies: Set<string>;
}

// Paid date, days overdue, due date or issue date, as the admin Invoices tab
// words it; the client's invoice list shows due and paid dates only.
const invoiceDate = (invoice: Invoice, now: Date, admin: boolean) =>
	invoice.status === "paid" && invoice.paidAt
		? `Paid ${formatDate(invoice.paidAt)}`
		: admin && isInvoiceOverdue(invoice, now)
			? `${formatDays(daysOverdue(invoice, now))} overdue`
			: invoice.dueAt
				? `Due ${formatDate(invoice.dueAt)}`
				: `Issued ${formatDate(invoice.invoicedAt)}`;

const createItems = () => {
	const items: RankItem[] = [];
	const currencies = new Set<string>();
	// The label and each sublabel part are fields; the label is primary.
	const add = (
		item: Omit<RankItem, "fields" | "order" | "sublabel">,
		parts: string[],
		fields = [
			searchField(item.label, true),
			...parts.map((part) => searchField(part, false)),
		],
	) => {
		items.push({
			...item,
			sublabel: parts.join(" · "),
			fields,
			order: items.length,
		});
	};
	const addInvoice = (
		invoice: Invoice,
		href: string,
		parts: string[],
		now: Date,
	) => {
		currencies.add(invoice.currency);
		add(
			{
				group: "invoices",
				id: `invoice:${invoice.id}`,
				label: `Invoice ${invoice.number}`,
				href,
				invoice: {
					status: invoice.status,
					overdue: isInvoiceOverdue(invoice, now),
					invoicedAt: invoice.invoicedAt,
					dueAt: invoice.dueAt,
					total: invoice.total,
					currency: invoice.currency,
				},
			},
			parts,
		);
	};
	const page = (
		label: string,
		sublabel: string,
		href: string,
		home = false,
		// Pages of an organization are found by either word.
		primarySublabel = false,
	) =>
		add(
			{ group: "pages", id: `page:${href}`, label, href, home },
			[sublabel],
			[searchField(label, true), searchField(sublabel, primarySublabel)],
		);
	return { items, currencies, add, addInvoice, page };
};

type Page = ReturnType<typeof createItems>["page"];

// The pages each kind of user starts from. The full slice and the empty query
// list them from here, so both show the same home pages.
const adminPages = (page: Page) => {
	page("Admin", "All clients", "/admin", true);
	page("Dashboard", "Your organizations", "/dash", true);
	page("Profile", "Account", "/settings/profile", true);
	page("API keys", "Account", "/settings/api", true);
};

const memberPages = (
	page: Page,
	organizations: Array<{ name: string; slug: string }>,
) => {
	for (const org of organizations) {
		const base = `/dash/org/${org.slug}`;
		page("Overview", org.name, base, true, true);
		page("Invoices", org.name, `${base}/invoices`, false, true);
		page("Spend by year", org.name, `${base}/spend`, false, true);
	}
	if (organizations.length > 1) {
		page("Organizations", "Your organizations", "/dash");
	}
	page("Profile", "Account", "/settings/profile", true);
	page("API keys", "Account", "/settings/api", true);
};

// What the palette shows before anything is typed: only the home pages, so
// the admin's need no query and a member's only their organizations' names.
export const loadSearchHome = async (
	db: Db,
	session: { user: { id: string; role?: string | null | undefined } },
): Promise<SearchSlice> => {
	const { items, currencies, page } = createItems();
	if (session.user.role === "admin") {
		adminPages(page);
	} else {
		const memberships = await db.query.member.findMany({
			columns: {},
			with: { organization: { columns: { name: true, slug: true } } },
			where: { userId: session.user.id },
		});
		memberPages(
			page,
			memberships.flatMap(({ organization }) =>
				organization ? [organization] : [],
			),
		);
	}
	return { items, currencies };
};

export const loadSearchSlice = async (
	db: Db,
	session: { user: { id: string; role?: string | null | undefined } },
	now: Date,
): Promise<SearchSlice> => {
	const { items, currencies, add, addInvoice, page } = createItems();

	if (session.user.role === "admin") {
		const [organizations, invoices] = await loadAdminSlice(db);
		const byId = new Map(organizations.map((org) => [org.id, org]));

		adminPages(page);
		add(
			{
				group: "actions",
				id: "action:/admin#onboard-client",
				label: "Onboard client",
				href: "/admin#onboard-client",
			},
			["Admin"],
		);

		for (const org of organizations) {
			const base = `/admin/org/${org.id}`;
			add(
				{
					group: "organizations",
					id: `org:${org.id}`,
					label: org.name,
					href: base,
				},
				[
					org.slug,
					`${org.projects.length} ${org.projects.length === 1 ? "project" : "projects"}`,
				],
			);
			for (const [label, path] of [
				["Overview", ""],
				["Worklist", "/worklist"],
				["Projects", "/projects"],
				["Invoices", "/invoices"],
				["Members", "/members"],
				["Settings", "/settings"],
			] as const) {
				page(label, org.name, `${base}${path}`, false, true);
			}
			for (const [label, href] of [
				[`New project for ${org.name}`, `${base}/projects#create-project`],
				[`Add member to ${org.name}`, `${base}/members#add-member`],
				[`Attach invoices for ${org.name}`, `${base}/invoices#to-attach`],
				[
					`Billing settings for ${org.name}`,
					`${base}/settings#billing-heading`,
				],
			] as const) {
				add({ group: "actions", id: `action:${href}`, label, href }, [
					org.name,
				]);
			}

			for (const project of org.projects) {
				const projectHref = `${base}/projects/${project.publicId}`;
				add(
					{
						group: "projects",
						id: `project:${project.publicId}`,
						label: project.name,
						href: projectHref,
						projectState: project.state,
					},
					[org.name, projectStatus[project.state].label],
				);
				// As canAddPhase on the project page.
				if (project.state === "draft" || project.state === "active") {
					add(
						{
							group: "actions",
							id: `action:${projectHref}#add-phase`,
							label: `Add phase to ${project.name}`,
							href: `${projectHref}#add-phase`,
						},
						[org.name],
					);
				}
				for (const phase of project.phases) {
					currencies.add(phase.currency);
					add(
						{
							group: "phases",
							id: `phase:${phase.publicId}`,
							label: phase.title,
							href: `${projectHref}#phase-${phase.publicId}`,
							phaseState: phase.state,
						},
						[
							org.name,
							project.name,
							phaseStatus[phase.state].label,
							formatMoney(phase.cost, phase.currency),
						],
					);
				}
			}

			for (const member of org.members) {
				add(
					{
						group: "members",
						id: `member:${member.id}`,
						label: member.user.name,
						href: `${base}/members#member-${member.id}`,
					},
					[member.user.email, org.name, memberRole(member.role).label],
				);
			}
		}

		for (const { link, metadata, ...invoice } of invoices) {
			// An attached invoice belongs to the client of its cost part and shows
			// only while that part is priced, as the Invoices tab lists it; an
			// unattached one to the client its Stripe customer is linked to.
			const phase = link?.phase;
			const org = byId.get(
				(link ? phase?.project?.organizationId : metadata?.organizationId) ??
					"",
			);
			if (!org || (link && !phase?.[`${link.component}Amount`])) continue;
			const status = invoiceStatus(invoice, now);
			addInvoice(
				invoice,
				`/admin/org/${org.id}/invoices#invoice-${invoice.id}`,
				[
					org.name,
					formatMoney(invoice.total, invoice.currency),
					status.label,
					...(link && phase?.project
						? [phase.project.name, phase.title, costPartLabel[link.component]]
						: ["Unattached"]),
					invoiceDate(invoice, now, true),
				],
				now,
			);
		}

		return { items, currencies };
	}

	const [memberships, invoices] = await loadMemberSlice(db, session.user.id);
	const organizations = memberships.flatMap(({ organization }) =>
		organization ? [organization] : [],
	);
	const byId = new Map(organizations.map((org) => [org.id, org]));
	memberPages(page, organizations);

	for (const org of organizations) {
		const base = `/dash/org/${org.slug}`;
		add(
			{
				group: "organizations",
				id: `org:${org.id}`,
				label: org.name,
				href: base,
			},
			["Organization"],
		);

		for (const project of org.projects) {
			const projectHref = `${base}/project/${project.publicId}`;
			add(
				{
					group: "projects",
					id: `project:${project.publicId}`,
					label: project.name,
					href: projectHref,
					projectState: project.state,
				},
				[org.name, projectStatus[project.state].label],
			);
			for (const phase of project.phases) {
				currencies.add(phase.currency);
				add(
					{
						group: "phases",
						id: `phase:${phase.publicId}`,
						label: phase.title,
						href: `${projectHref}#phase-${phase.publicId}`,
						phaseState: phase.state,
					},
					[
						org.name,
						project.name,
						clientPhaseLabel[phase.state],
						formatMoney(phase.cost, phase.currency),
					],
				);
			}
		}
	}

	for (const { link, metadata, ...invoice } of invoices) {
		// The query already keeps only the user's organizations' invoices.
		const org = byId.get(metadata?.organizationId ?? "");
		if (!org) continue;
		const phase = link?.phase;
		addInvoice(
			invoice,
			`/dash/org/${org.slug}/invoices#invoice-${invoice.id}`,
			[
				org.name,
				formatMoney(invoice.total, invoice.currency),
				invoiceStatus(invoice, now).label,
				...(phase?.project
					? [phase.project.name, phase.title]
					: ["Unassigned"]),
				invoiceDate(invoice, now, false),
			],
			now,
		);
	}

	return { items, currencies };
};
