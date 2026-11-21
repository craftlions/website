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

export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const shareFormatter = new Intl.NumberFormat("de-DE", {
	maximumFractionDigits: 4,
});

export const formatShare = (value: number) =>
	`${shareFormatter.format(value)}%`;

const currencyNames = new Intl.DisplayNames("en", { type: "currency" });

export const formatCurrency = (code: string) =>
	`${code} · ${currencyNames.of(code) ?? code}`;

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

export const formatDays = (days: number) =>
	`${days} ${days === 1 ? "day" : "days"}`;
