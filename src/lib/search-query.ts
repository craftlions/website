import type { PhaseState, ProjectState } from "./status.ts";

export type SearchGroupId =
	| "organizations"
	| "projects"
	| "phases"
	| "invoices"
	| "members"
	| "pages"
	| "actions";

export interface SearchItem {
	id: string;
	label: string;
	sublabel: string;
	href: string;
}

export interface SearchGroup {
	id: SearchGroupId;
	label: string;
	items: SearchItem[];
	total: number;
}

export interface SearchResponse {
	query: string;
	filters: string[];
	groups: SearchGroup[];
}

export interface SearchField {
	text: string;
	words: string[];
	starts: number[];
	primary: boolean;
}

export interface RankItem extends SearchItem {
	group: SearchGroupId;
	fields: SearchField[];
	order: number;
	home?: boolean;
	projectState?: ProjectState;
	phaseState?: PhaseState;
	invoice?: {
		status: string;
		overdue: boolean;
		invoicedAt: Date;
		dueAt: Date | null;
		total: number;
		currency: string;
	};
}

export interface QueryContext {
	admin: boolean;
	now: Date;
	currencies: Iterable<string>;
}

export interface ParsedQuery {
	admin: boolean;
	terms: string[];
	pageTerms: string[];
	scopes: Set<SearchGroupId>;
	projectStates: Set<ProjectState>;
	phaseStates: Set<PhaseState>;
	stripeStatuses: Set<string>;
	overdue: boolean;
	year?: number;
	month?: number;
	amount?: {
		min?: number;
		max?: number;
		minExclusive?: boolean;
		maxExclusive?: boolean;
		eq?: number;
	};
	currency?: string;
	labels: string[];
}

export const fold = (text: string) =>
	text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

const wordPattern = /[\p{L}\p{N}]+/gu;

export const searchField = (text: string, primary: boolean): SearchField => {
	const folded = fold(text);
	const matches = [...folded.matchAll(wordPattern)];
	return {
		text: folded,
		words: matches.map(([word]) => word),
		starts: matches.map(({ index }) => index),
		primary,
	};
};

const groupOrder: SearchGroupId[] = [
	"organizations",
	"projects",
	"phases",
	"invoices",
	"members",
	"pages",
	"actions",
];

const groupLabel = (group: SearchGroupId, admin: boolean) =>
	({
		organizations: admin ? "Clients" : "Organizations",
		projects: "Projects",
		phases: "Phases",
		invoices: "Invoices",
		members: "Members",
		pages: "Pages",
		actions: "Actions",
	})[group];

const entityGroups = new Set<SearchGroupId>([
	"organizations",
	"projects",
	"phases",
	"invoices",
	"members",
]);

const memberScopes: Record<string, SearchGroupId> = {
	org: "organizations",
	orgs: "organizations",
	organization: "organizations",
	organizations: "organizations",
	project: "projects",
	projects: "projects",
	phase: "phases",
	phases: "phases",
	invoice: "invoices",
	invoices: "invoices",
	page: "pages",
	pages: "pages",
};

const adminScopes: Record<string, SearchGroupId> = {
	...memberScopes,
	client: "organizations",
	clients: "organizations",
	member: "members",
	members: "members",
	people: "members",
	user: "members",
	users: "members",
	action: "actions",
	actions: "actions",
};

const projectStates: Record<string, ProjectState> = {
	draft: "draft",
	active: "active",
	completed: "completed",
	archived: "archived",
};

const phaseStates: Record<string, PhaseState> = {
	submitted: "submitted",
	planned: "planned",
	approved: "approved",
	in_progress: "in_progress",
	"in-progress": "in_progress",
	inprogress: "in_progress",
	delivered: "delivered",
	accepted: "accepted",
	cancelled: "cancelled",
	canceled: "cancelled",
};

const stripeStatuses = new Set(["open", "paid", "void", "uncollectible"]);

const monthNames = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const months: Record<string, number> = Object.fromEntries(
	monthNames.flatMap((name, index) => [
		[name.toLowerCase(), index + 1],
		[name.slice(0, 3).toLowerCase(), index + 1],
	]),
);
months.sept = 9;

const currencySymbols: Record<string, string> = {
	"€": "EUR",
	$: "USD",
	"£": "GBP",
};

const sentence = (word: string) =>
	word.charAt(0).toUpperCase() + word.slice(1).replace(/_/g, " ");

const parseNumber = (text: string) => {
	const match = /^(?!0\d)(\d[\d.,]*)(k?)$/i.exec(text);
	if (!match?.[1]) return undefined;
	const body = match[1];
	const factor = match[2] ? 1000 : 1;
	const hasDot = body.includes(".");
	const hasComma = body.includes(",");
	let value: number | undefined;

	if (hasDot && hasComma) {
		const decimal = body.lastIndexOf(".") > body.lastIndexOf(",") ? "." : ",";
		const [whole = "", fraction = "", ...rest] = body.split(decimal);
		const digits = whole.replace(/[.,]/g, "");
		if (rest.length === 0 && /^\d+$/.test(digits) && /^\d+$/.test(fraction)) {
			value = Number(`${digits}.${fraction}`);
		}
	} else if (hasDot || hasComma) {
		const [whole = "", ...groups] = body.split(hasDot ? "." : ",");
		if (groups.every((group) => /^\d{3}$/.test(group))) {
			value = Number(whole + groups.join(""));
		} else if (groups.length === 1 && /^\d{1,2}$/.test(groups[0] ?? "")) {
			value = Number(`${whole}.${groups[0]}`);
		}
	} else {
		value = Number(body);
	}

	return value === undefined || Number.isNaN(value)
		? undefined
		: value * factor;
};

type Amount = NonNullable<ParsedQuery["amount"]>;

const parseAmount = (
	token: string,
	currencyOf: (text: string) => string | undefined,
): { amount: Amount; bare: boolean; currency?: string } | undefined => {
	const compare = /^(>=|<=|>|<|=)(.+)$/.exec(token);
	let body = compare?.[2] ?? token;
	let currency: string | undefined;

	const prefix = /^(€|\$|£|[a-z]{3})(?=\d)/i.exec(body)?.[1];
	const suffix = /(?<=[\dk])(€|\$|£|[a-z]{3})$/i.exec(body)?.[1];
	if (prefix && currencyOf(prefix)) {
		currency = currencyOf(prefix);
		body = body.slice(prefix.length);
	} else if (suffix && currencyOf(suffix)) {
		currency = currencyOf(suffix);
		body = body.slice(0, -suffix.length);
	}

	if (compare?.[1]) {
		const value = parseNumber(body);
		if (value === undefined) return undefined;
		const amount: Amount = {
			">": { min: value, minExclusive: true },
			">=": { min: value },
			"<": { max: value, maxExclusive: true },
			"<=": { max: value },
			"=": { eq: value },
		}[compare[1]] as Amount;
		return { amount, bare: false, ...(currency && { currency }) };
	}

	const range = body.split(/[-–]/);
	if (range.length === 2) {
		const min = parseNumber(range[0] ?? "");
		const max = parseNumber(range[1] ?? "");
		if (min === undefined || max === undefined) return undefined;
		return {
			amount: { min: Math.min(min, max), max: Math.max(min, max) },
			bare: false,
			...(currency && { currency }),
		};
	}

	const value = parseNumber(body);
	if (value === undefined) return undefined;
	return {
		amount: { eq: value },
		bare: !currency,
		...(currency && { currency }),
	};
};

const formatAmount = (value: number, currency: string | undefined) =>
	currency
		? new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(
				value,
			)
		: new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(
				value,
			);

const amountLabel = (amount: Amount, currency: string | undefined) => {
	const format = (value: number) => formatAmount(value, currency);
	if (amount.eq !== undefined) return `= ${format(amount.eq)}`;
	if (amount.min !== undefined && amount.max !== undefined) {
		return `${format(amount.min)} – ${format(amount.max)}`;
	}
	if (amount.min !== undefined) {
		return `${amount.minExclusive ? ">" : "≥"} ${format(amount.min)}`;
	}
	return `${amount.maxExclusive ? "<" : "≤"} ${format(amount.max ?? 0)}`;
};

const maxTerms = 8;

export const parseQuery = (
	q: string,
	context: QueryContext,
	asText = false,
): ParsedQuery => {
	const currencies = new Set(
		[...context.currencies].map((code) => code.toUpperCase()),
	);
	const currencyOf = (text: string) => {
		if (Object.hasOwn(currencySymbols, text)) return currencySymbols[text];
		const code = text.toUpperCase();
		return currencies.has(code) ? code : undefined;
	};
	const scopeWords = context.admin ? adminScopes : memberScopes;
	const parsed: ParsedQuery = {
		admin: context.admin,
		terms: [],
		pageTerms: [],
		scopes: new Set(),
		projectStates: new Set(),
		phaseStates: new Set(),
		stripeStatuses: new Set(),
		overdue: false,
		labels: [],
	};
	const labels: Array<() => string> = [];
	let monthYear: number | undefined;

	const tokens = q.split(/["“”]/).flatMap((part, index) =>
		(index % 2 ? part : part.replace(/([<>]=?|=)\s+/g, "$1"))
			.split(/\s+/)
			.filter(Boolean)
			.map((text) => ({ text, quoted: asText || index % 2 === 1 })),
	);

	const addText = (token: string) => {
		const words = fold(token).match(wordPattern) ?? [];
		parsed.terms.push(...words);
		parsed.pageTerms.push(...words);
	};

	const setAmount = (amount: Amount, currency: string | undefined) => {
		parsed.amount = { ...parsed.amount, ...amount };
		if (currency) parsed.currency = currency;
		labels.push(() => amountLabel(amount, currency));
	};

	for (let index = 0; index < tokens.length; index++) {
		const { text: token, quoted } = tokens[index] ?? {
			text: "",
			quoted: false,
		};
		if (quoted) {
			addText(token);
			continue;
		}
		const word = fold(token);
		const next = tokens[index + 1]?.quoted
			? undefined
			: tokens[index + 1]?.text;

		const scope = Object.hasOwn(scopeWords, word)
			? scopeWords[word]
			: undefined;
		if (scope) {
			parsed.scopes.add(scope);
			if (scope !== "pages" && scope !== "actions") parsed.pageTerms.push(word);
			labels.push(() => groupLabel(scope, context.admin));
			continue;
		}

		if (Object.hasOwn(projectStates, word)) {
			const state = projectStates[word] as ProjectState;
			parsed.projectStates.add(state);
			if (state === "draft" && context.admin)
				parsed.stripeStatuses.add("draft");
			labels.push(() => sentence(state));
			continue;
		}

		if (Object.hasOwn(phaseStates, word)) {
			const state = phaseStates[word] as PhaseState;
			parsed.phaseStates.add(state);
			labels.push(() => sentence(state));
			continue;
		}

		if (stripeStatuses.has(word)) {
			parsed.stripeStatuses.add(word);
			labels.push(() => sentence(word));
			continue;
		}

		if (word === "overdue") {
			parsed.overdue = true;
			labels.push(() => "Overdue");
			continue;
		}

		const yearMonth = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(word);
		if (yearMonth) {
			const year = Number(yearMonth[1]);
			const month = Number(yearMonth[2]);
			parsed.year = year;
			parsed.month = month;
			labels.push(() => `${monthNames[month - 1]} ${year}`);
			continue;
		}

		if (/^20\d{2}$/.test(word)) {
			parsed.year = Number(word);
			labels.push(() => word);
			continue;
		}

		if (Object.hasOwn(months, word)) {
			const month = months[word] as number;
			parsed.month = month;
			monthYear =
				month <= context.now.getUTCMonth() + 1
					? context.now.getUTCFullYear()
					: context.now.getUTCFullYear() - 1;
			labels.push(() => `${monthNames[month - 1]} ${parsed.year ?? monthYear}`);
			continue;
		}

		const currency = currencyOf(word);
		if (currency) {
			const following = next && parseAmount(next, currencyOf);
			if (following && !following.currency) {
				setAmount(following.amount, currency);
				index++;
			} else {
				parsed.currency = currency;
				labels.push(() => currency);
			}
			continue;
		}

		const amount = parseAmount(token, currencyOf);
		if (amount) {
			const trailing =
				!amount.currency && next ? currencyOf(fold(next)) : undefined;
			if (trailing) {
				setAmount(amount.amount, trailing);
				index++;
				continue;
			}
			if (!amount.bare) {
				setAmount(amount.amount, amount.currency);
				continue;
			}
		}

		addText(token);
	}

	if (parsed.year === undefined && monthYear !== undefined) {
		parsed.year = monthYear;
	}
	parsed.terms = parsed.terms.slice(0, maxTerms);
	parsed.pageTerms = parsed.pageTerms.slice(0, maxTerms);
	parsed.labels = labels.map((label) => label());
	return parsed;
};

const boundedDistance = (a: string, b: string, k: number) => {
	if (Math.abs(a.length - b.length) > k) return k + 1;
	let before: number[] = [];
	let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			let value = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				value = Math.min(value, (before[j - 2] ?? 0) + 1);
			}
			current[j] = value;
			rowMin = Math.min(rowMin, value);
		}
		if (rowMin > k) return k + 1;
		before = previous;
		previous = current;
	}
	return previous[b.length] ?? k + 1;
};

const subsequenceGap = (term: string, field: SearchField) => {
	let best = Number.POSITIVE_INFINITY;
	for (const start of field.starts) {
		if (field.text[start] !== term[0]) continue;
		let position = start;
		let gap = 0;
		for (const char of term.slice(1)) {
			const found = field.text.indexOf(char, position + 1);
			if (found === -1) {
				gap = Number.POSITIVE_INFINITY;
				break;
			}
			gap += found - position - 1;
			position = found;
		}
		best = Math.min(best, gap);
	}
	return best;
};

const termScore = (term: string, field: SearchField) => {
	if (field.text === term) return 100;
	if (field.text.startsWith(term)) return 90;
	if (field.words.some((word) => word.startsWith(term))) return 80;
	if (field.text.includes(term)) return 60;
	if (/\d/.test(term)) return 0;
	if (term.length >= 3) {
		const gap = subsequenceGap(term, field);
		if (gap !== Number.POSITIVE_INFINITY) return 40 - Math.min(gap, 20);
	}
	const k = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
	let best = 0;
	if (k > 0) {
		for (const word of field.words) {
			if (word.length < term.length - k) continue;
			const distance = boundedDistance(term, word.slice(0, term.length), k);
			if (distance <= k) best = Math.max(best, 30 - 5 * distance);
		}
	}
	return best;
};

const itemScore = (item: RankItem, terms: string[]) => {
	let total = 0;
	let allPrimary = true;
	for (const term of terms) {
		let best = 0;
		let primary = false;
		for (const field of item.fields) {
			const score = termScore(term, field) * (field.primary ? 1 : 0.6);
			if (score > best) {
				best = score;
				primary = field.primary;
			}
		}
		if (best === 0) return undefined;
		total += best;
		allPrimary &&= primary;
	}
	return terms.length > 0 && allPrimary ? total + 5 : total;
};

const candidateTerms = (item: RankItem, parsed: ParsedQuery) => {
	const otherStripe = [...parsed.stripeStatuses].some((s) => s !== "draft");
	const invoiceOnly =
		parsed.overdue ||
		parsed.month !== undefined ||
		parsed.amount !== undefined ||
		parsed.currency !== undefined;
	const yearTerms =
		parsed.year === undefined
			? parsed.terms
			: [...parsed.terms, `${parsed.year}`];

	switch (item.group) {
		case "organizations":
		case "members":
			return parsed.projectStates.size ||
				parsed.phaseStates.size ||
				parsed.stripeStatuses.size ||
				invoiceOnly
				? undefined
				: yearTerms;
		case "projects":
			return parsed.phaseStates.size ||
				otherStripe ||
				invoiceOnly ||
				(parsed.projectStates.size &&
					!(item.projectState && parsed.projectStates.has(item.projectState)))
				? undefined
				: yearTerms;
		case "phases":
			return parsed.projectStates.size ||
				parsed.stripeStatuses.size ||
				invoiceOnly ||
				(parsed.phaseStates.size &&
					!(item.phaseState && parsed.phaseStates.has(item.phaseState)))
				? undefined
				: yearTerms;
		case "invoices": {
			const invoice = item.invoice;
			const amount = parsed.amount;
			const total = invoice?.total ?? 0;
			const otherProject = [...parsed.projectStates].some((s) => s !== "draft");
			const passes =
				invoice &&
				!otherProject &&
				!parsed.phaseStates.size &&
				(!parsed.projectStates.size || parsed.stripeStatuses.has("draft")) &&
				(!parsed.stripeStatuses.size ||
					parsed.stripeStatuses.has(invoice.status)) &&
				(!parsed.overdue || invoice.overdue) &&
				(parsed.year === undefined ||
					invoice.invoicedAt.getUTCFullYear() === parsed.year) &&
				(parsed.month === undefined ||
					invoice.invoicedAt.getUTCMonth() + 1 === parsed.month) &&
				(parsed.currency === undefined ||
					invoice.currency.toUpperCase() === parsed.currency) &&
				(!amount ||
					((amount.eq === undefined ||
						Math.round(total * 100) === Math.round(amount.eq * 100)) &&
						(amount.min === undefined ||
							(amount.minExclusive
								? total > amount.min
								: total >= amount.min)) &&
						(amount.max === undefined ||
							(amount.maxExclusive
								? total < amount.max
								: total <= amount.max))));
			return passes ? parsed.terms : undefined;
		}
		case "pages":
		case "actions": {
			const otherScope =
				(parsed.scopes.has("pages") || parsed.scopes.has("actions")) &&
				!parsed.scopes.has(item.group);
			const filtered =
				otherScope ||
				parsed.projectStates.size ||
				parsed.phaseStates.size ||
				parsed.stripeStatuses.size ||
				parsed.year !== undefined ||
				invoiceOnly;
			return filtered ||
				(parsed.pageTerms.length === 0 && !parsed.scopes.has(item.group))
				? undefined
				: parsed.pageTerms;
		}
	}
};

const invoiceOrder = (
	a: NonNullable<RankItem["invoice"]>,
	b: NonNullable<RankItem["invoice"]>,
) =>
	Number(b.overdue) - Number(a.overdue) ||
	(a.overdue && b.overdue
		? (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0)
		: 0) ||
	b.invoicedAt.getTime() - a.invoicedAt.getTime();

const maxPerGroup = 8;
const maxPerScopedGroup = 25;
const maxItems = 50;

export const rank = (
	items: readonly RankItem[],
	parsed: ParsedQuery,
): SearchGroup[] => {
	const nothingTyped =
		parsed.pageTerms.length === 0 &&
		parsed.terms.length === 0 &&
		parsed.scopes.size === 0 &&
		parsed.labels.length === 0;

	const scored = nothingTyped
		? items.filter((item) => item.home).map((item) => ({ item, score: 0 }))
		: items.flatMap((item) => {
				if (
					entityGroups.has(item.group) &&
					parsed.scopes.size > 0 &&
					!parsed.scopes.has(item.group)
				) {
					return [];
				}
				const terms = candidateTerms(item, parsed);
				if (!terms) return [];
				const score = itemScore(item, terms);
				return score === undefined ? [] : [{ item, score }];
			});

	scored.sort(
		(a, b) =>
			b.score - a.score ||
			(a.item.invoice && b.item.invoice
				? invoiceOrder(a.item.invoice, b.item.invoice)
				: 0) ||
			a.item.order - b.item.order ||
			a.item.label.localeCompare(b.item.label, "en") ||
			(a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
	);

	const scopedEntities = [...parsed.scopes].filter((scope) =>
		entityGroups.has(scope),
	);
	const cap = scopedEntities.length === 1 ? maxPerScopedGroup : maxPerGroup;

	const groups = groupOrder
		.map((id) => {
			const matches = scored.filter(({ item }) => item.group === id);
			return {
				id,
				best: matches[0]?.score ?? 0,
				total: matches.length,
				items: matches.slice(0, cap).map(({ item }) => item),
			};
		})
		.filter((group) => group.total > 0)
		.sort((a, b) => b.best - a.best);

	let excess =
		groups.reduce((sum, group) => sum + group.items.length, 0) - maxItems;
	for (const group of groups.toReversed()) {
		if (excess <= 0) break;
		const cut = Math.min(excess, group.items.length);
		group.items = group.items.slice(0, group.items.length - cut);
		excess -= cut;
	}

	return groups
		.filter((group) => group.items.length > 0)
		.map((group) => ({
			id: group.id,
			label: groupLabel(group.id, parsed.admin),
			items: group.items.map(({ id, label, sublabel, href }) => ({
				id,
				label,
				sublabel,
				href,
			})),
			total: group.total,
		}));
};

export const searchItems = (
	items: readonly RankItem[],
	q: string,
	context: QueryContext,
): Pick<SearchResponse, "filters" | "groups"> => {
	const parsed = parseQuery(q, context);
	const groups = rank(items, parsed);
	return groups.length > 0 || parsed.labels.length === 0
		? { filters: parsed.labels, groups }
		: { filters: [], groups: rank(items, parseQuery(q, context, true)) };
};
