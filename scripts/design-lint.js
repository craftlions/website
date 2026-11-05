// Fails on styling that bypasses the role tokens in DESIGN.md. Locking the palette
// makes raw color classes render nothing, silently; this makes them fail loudly.
import { spawnSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";

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
		use: "text-display, text-headline, text-title, text-label, label-caps, text-sm or text-xs",
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
						.filter(({ ignore }) => ignore !== file)
						.flatMap(({ pattern, use, doc, classOnly }) =>
							[...(classOnly ? classText(line) : line).matchAll(pattern)].map(
								([match]) =>
									`${file}:${index + 1}  ${match} → use ${use}  (${doc})`,
							),
						),
		),
);

// DESIGN.md frontmatter is what Impeccable reads, so it must keep up with tokens.css.
const frontmatter = readFileSync("DESIGN.md", "utf8").split("---\n")[1] ?? "";
if (!/^colors:\n {2}\S/m.test(frontmatter)) {
	violations.push(
		"DESIGN.md  frontmatter is not nested YAML → restore its indentation",
	);
}
for (const [hex] of readFileSync("src/styles/tokens.css", "utf8").matchAll(
	/#[\da-f]{6,8}/g,
)) {
	if (!frontmatter.includes(hex.slice(0, 7))) {
		violations.push(
			`src/styles/tokens.css  ${hex} → add it to the DESIGN.md frontmatter`,
		);
	}
}

// Impeccable sees patterns the rules above cannot, such as gradient text and inline
// styles off DESIGN.md. Its DESIGN.md findings are advisory and exit 0, so any finding fails here.
const detector = spawnSync(
	".claude/skills/impeccable/scripts/impeccable",
	["detect", "--json", "src/"],
	{ encoding: "utf8" },
);
if (detector.status === 0 || detector.status === 2) {
	for (const { antipattern, file, line, snippet } of JSON.parse(
		detector.stdout,
	)) {
		violations.push(
			`${relative(".", file)}:${line}  ${antipattern} → ${snippet}`,
		);
	}
} else {
	violations.push("impeccable detect could not scan src/");
}

if (violations.length > 0) {
	console.error(violations.join("\n"));
	process.exit(1);
}
