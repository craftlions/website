// Scans the public pages and the dev-only /design page with axe-core, in light and
// dark, against the dev server that is already running; it never starts one.
// Every violation fails, best-practice included, so fix it instead of excluding it.
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const base = process.env.A11Y_BASE_URL ?? "http://localhost:4321";
const routes = [
	"/",
	"/login",
	"/forgot-password",
	"/reset-password",
	"/imprint/",
	"/changelog/",
	"/design",
];
const tags = [
	"wcag2a",
	"wcag2aa",
	"wcag21a",
	"wcag21aa",
	"wcag22aa",
	"best-practice",
];
// Each exclusion names its rule and says why: { id: "rule-id", reason: "…" }.
const excluded = [];

try {
	await fetch(base, { redirect: "manual" });
} catch {
	console.error(
		`No dev server at ${base}; start it yourself (never from an agent) or set A11Y_BASE_URL.`,
	);
	process.exit(1);
}

const browser = await chromium.launch();
const violations = [];
const incomplete = new Map();

for (const colorScheme of ["light", "dark"]) {
	const context = await browser.newContext({
		colorScheme,
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();
	for (const route of routes) {
		const response = await page.goto(new URL(route, base).href);
		if (!response?.ok()) {
			violations.push(
				`${route} [${colorScheme}] HTTP ${response?.status()} → the page must load before it can be scanned`,
			);
			continue;
		}
		const results = await new AxeBuilder({ page })
			.withTags(tags)
			.disableRules(excluded.map(({ id }) => id))
			.analyze();
		for (const { id, impact, help, helpUrl, nodes } of results.violations) {
			violations.push(
				`${route} [${colorScheme}] ${id} (${impact}): ${help} — ${nodes.length} nodes — ${helpUrl}`,
				...nodes.map(({ target }) => `  ${target.join(" ")}`),
			);
		}
		for (const { id, nodes } of results.incomplete) {
			incomplete.set(id, (incomplete.get(id) ?? 0) + nodes.length);
		}
	}
	await context.close();
}
await browser.close();

if (incomplete.size) {
	console.log(
		`Needs review (not failing): ${[...incomplete].map(([id, count]) => `${id} ×${count}`).join(", ")}`,
	);
}
if (violations.length) {
	console.error(violations.join("\n"));
	process.exit(1);
}
console.log(
	`No accessibility violations on ${routes.length} pages in light and dark.`,
);
