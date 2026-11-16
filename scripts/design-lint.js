// Fails on styling that bypasses the role tokens in DESIGN.md. Locking the palette
// makes raw color classes render nothing, silently; this makes them fail loudly.
import { globSync, readFileSync } from "node:fs";

const hues =
	"slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const colorUtilities =
	"text|bg|border|divide|outline|ring|decoration|fill|stroke|accent|caret|from|via|to";
const colorFunctions =
	"rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark";

const rules = [
	{
		id: "raw-palette",
		pattern: new RegExp(
			`(?<![\\w-])(?:${colorUtilities})(?:-[trblxyse])?-(?:(?:${hues})-\\d+|black|white)(?![\\w-])`,
			"g",
		),
		use: "a role token such as text-fg, bg-panel or border-line",
		doc: "DESIGN.md#role-tokens",
	},
	{
		id: "arbitrary-color",
		pattern: new RegExp(
			`-\\[(?:#|color:|(?:${colorFunctions})\\()|(?<![\\w-])(?:${colorUtilities})(?:-[trblxyse])?-(?:\\[(?:var\\(|[a-z]+\\])|\\(--)`,
			"g",
		),
		use: "a role token, or add one to src/styles/tokens.css",
		doc: "DESIGN.md#role-tokens",
	},
	{
		id: "interpolated-class",
		pattern: new RegExp(`(?<![\\w-])(?:${colorUtilities})-\\$\\{`, "g"),
		use: "complete class names, because Tailwind cannot see interpolated ones",
		doc: "DESIGN.md#role-tokens",
	},
	{
		id: "font-size",
		pattern: new RegExp(
			`(?<![\\w-])text-(?:(?:base|lg|[2-9]?xl)(?![\\w-])|\\(length:|\\[(?!#|color:|var\\(|[a-z]+\\]|(?:${colorFunctions})\\())`,
			"g",
		),
		use: "text-display, text-headline, text-title, text-label, text-caption, label-caps, text-sm or text-xs",
		doc: "DESIGN.md#3-typography",
	},
	{
		id: "outline-removed",
		pattern: /(?<![\w-])outline-(?:none|hidden|0)(?![\w-])/g,
		use: "the global :focus-visible outline; adjust only outline-offset",
		doc: "DESIGN.md#role-tokens",
	},
	{
		id: "shadow",
		pattern:
			/(?<![\w-])(?:inset-|drop-)?shadow(?!-none(?![\w-]))(?:-[a-z0-9]+)*(?:-\[[^\]]*\]|-\([^)]*\))?(?![\w-])/g,
		classOnly: true,
		use: "a dashed border, because surfaces are flat",
		doc: "DESIGN.md#4-elevation",
	},
	{
		id: "radius",
		pattern:
			/(?<![\w-])rounded(?!-none(?![\w-]))(?:-[a-z0-9]+)*(?:-\[[^\]]*\]|-\([^)]*\))?(?![\w-])/g,
		classOnly: true,
		use: "square corners",
		doc: "DESIGN.md#5-components",
	},
	{
		id: "flexbox",
		pattern:
			/(?<![\w-])(?:inline-)?flex(?:-[a-z0-9/]+)*(?:-\[[^\]]*\])?(?![\w-])/g,
		classOnly: true,
		use: "grid or inline-grid",
		doc: "AGENTS.md",
	},
	{
		id: "raw-button",
		pattern: /<button\b/g,
		use: '<Button>, with variant="quiet" or variant="hint" for smaller actions',
		doc: "DESIGN.md#buttons",
		ignore: "src/components/Button.astro",
	},
	{
		id: "style-block",
		pattern: /<style\b/g,
		use: "inline Tailwind utilities, or a global rule in src/styles/",
		doc: "CLAUDE.md",
		only: "src/components/",
	},
	{
		id: "font-utility",
		pattern: /(?<![\w-])font-(?:\[[^\]]*\]|\([^)]*\)|[\w-]+)/g,
		classOnly: true,
		use: "a type role such as text-label or text-caption for 600, or no class for 400",
		doc: "DESIGN.md#3-typography",
	},
	{
		id: "line-height",
		pattern:
			/(?<![\w-])(?:leading-(?!none(?![\w-]))|text-(?:xs|sm|display|headline|title|label|caption)\/)(?:\[[^\]]*\]|\([^)]*\)|[\w.-]+)/g,
		classOnly: true,
		use: "the role's own line height, or leading-none in a tight metric row",
		doc: "DESIGN.md#3-typography",
	},
	{
		id: "link-recipe",
		pattern:
			/(?<![\w-])(?:underline|decoration-(?:dashed|dotted|double|wavy))(?![\w-])/g,
		classOnly: true,
		use: "the link class, which draws the dashed underline and its hover",
		doc: "DESIGN.md#links",
		ignore: "src/styles/global.css",
	},
	// Checkbox wraps its control in its label; the cost split labels number
	// inputs that sit in a % suffix box, which Input cannot draw yet.
	{
		id: "raw-label",
		pattern: /<label\b/g,
		use: "<Field> for a labelled control, or <Checkbox>",
		doc: "DESIGN.md#inputs--fields",
		ignore: [
			"src/components/Field.astro",
			"src/components/Checkbox.astro",
			"src/components/PhaseAmountCalculator.astro",
		],
	},
	{
		id: "native-disclosure",
		pattern: /<(?:details|summary)\b/g,
		use: "<DisclosureButton> with a hidden panel",
		doc: "DESIGN.md#disclosure",
	},
	{
		id: "dark-variant",
		pattern: /(?<![\w-])dark:/g,
		classOnly: true,
		use: "a role token, which switches scheme through light-dark()",
		doc: "DESIGN.md#role-tokens",
	},
];

// Shadow, rounded and flex are also ordinary words, so those rules skip free text.
const classText = (line) =>
	(line.match(/"[^"]*"|'[^']*'|`[^`]*`|@apply .*/g) ?? []).join(" ");

const violations = globSync("src/**/*.{astro,ts,css}").flatMap((file) =>
	readFileSync(file, "utf8")
		.split("\n")
		.flatMap((line, index) =>
			/^\s*(?:\/\/|\/\*|\*)/.test(line)
				? []
				: rules
						.filter(
							({ ignore, only }) =>
								![ignore].flat().includes(file) &&
								(!only || file.startsWith(only)),
						)
						.flatMap(({ pattern, use, doc, classOnly }) =>
							[...(classOnly ? classText(line) : line).matchAll(pattern)].map(
								([match]) =>
									`${file}:${index + 1}  ${match} → use ${use}  (${doc})`,
							),
						),
		),
);

// A live region that is revealed when its text is set is not announced reliably;
// it must already be rendered, empty, so only its text changes. Tags span lines,
// so this reads whole files.
for (const file of globSync("src/**/*.astro")) {
	const source = readFileSync(file, "utf8");
	for (const { 0: tag, index } of source.matchAll(/<[\w-]+\s[^<>]*>/g)) {
		if (
			/\srole=["']?(?:alert|status)\b/.test(tag) &&
			/(?<![\w-])hidden(?![\w-])/.test(tag)
		) {
			violations.push(
				`${file}:${source.slice(0, index).split("\n").length}  hidden live region → render it empty and set only its text, with not-empty: spacing  (DESIGN.md#action-feedback)`,
			);
		}
	}
}

// DESIGN.md frontmatter is what design:lint reads, so it must keep up with tokens.css.
const frontmatter = readFileSync("DESIGN.md", "utf8").split("---\n")[1] ?? "";
if (!/^colors:\n {2}\S/m.test(frontmatter)) {
	violations.push(
		"DESIGN.md  frontmatter is not nested YAML → restore its indentation",
	);
}
// Each token is named in the frontmatter with its light value, and its dark value
// under `-dark`, so a changed value or a renamed token cannot hide behind a
// matching hex elsewhere.
const colors = new Map(
	[...frontmatter.matchAll(/^ {2}([\w-]+): "(#[\da-f]+)"$/gm)].map(
		([, name, hex]) => [name, hex],
	),
);
const tokenNames = new Set();
for (const [, name, light, dark] of readFileSync(
	"src/styles/tokens.css",
	"utf8",
).matchAll(/--([\w-]+): light-dark\((#[\da-f]+), (#[\da-f]+)\)/g)) {
	for (const [key, hex] of [
		[name, light],
		[`${name}-dark`, dark],
	]) {
		tokenNames.add(key);
		if (colors.get(key) !== hex) {
			violations.push(
				`DESIGN.md  colors.${key} → set it to "${hex}", the value of --${name} in src/styles/tokens.css`,
			);
		}
	}
}
for (const name of colors.keys()) {
	if (!tokenNames.has(name)) {
		violations.push(
			`DESIGN.md  colors.${name} → name a token from src/styles/tokens.css`,
		);
	}
}

if (violations.length > 0) {
	console.error(violations.join("\n"));
	process.exit(1);
}
