// Shared de-DE display formatting for amounts, dates and percentages.

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export const formatMoney = (amount: number, currency: string) => {
	const formatter =
		moneyFormatters.get(currency) ??
		new Intl.NumberFormat("de-DE", { style: "currency", currency });
	moneyFormatters.set(currency, formatter);
	return formatter.format(amount);
};

export const formatDate = (date: Date) => dateFormatter.format(date);

// One decimal, uncapped, matching the client dashboard's budget percentages.
export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// Amounts in several currencies cannot be added, so each currency is summed
// and formatted on its own and the totals are joined with " + ".
export const sumByCurrency = (
	items: ReadonlyArray<{ amount: number; currency: string }>,
	emptyCurrency = "EUR",
) => {
	const sums = new Map<string, number>();
	for (const item of items) {
		sums.set(item.currency, (sums.get(item.currency) ?? 0) + item.amount);
	}
	if (sums.size === 0) return formatMoney(0, emptyCurrency);
	return [...sums]
		.map(([currency, total]) => formatMoney(total, currency))
		.join(" + ");
};
