// Fails on styling that bypasses the role tokens in DESIGN.md. Locking the palette
// makes raw color classes render nothing, silently; this makes them fail loudly.
import { globSync, readFileSync } from "node:fs";
import {
	contrastChecks,
	parseContrast,
	parseTokens,
} from "../src/lib/contrast.ts";
import { tokens as fluidTokens } from "./fluid-scale.js";

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
		ignore: "src/styles/components/link.css",
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

// Shadow and rounded are also ordinary words, so those rules skip free text.
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

// Native CSS: the stylesheets in src/styles and every <style> block, split into
// blocks and declarations that know their line, the selectors and at-rules
// around them, and the comment on their line, which can carry an exception:
// /* constant: why */, /* physical: why */ or /* fallback: why */.
const parseCss = (source, firstLine) => {
	const blocks = [];
	const declarations = [];
	const statements = [];
	const comments = new Map();
	const stack = [];
	let buffer = "";
	let start;
	let line = firstLine;
	let parens = 0;
	let quote;
	for (let index = 0; index < source.length; index++) {
		const char = source[index];
		if (char === "/" && source[index + 1] === "*" && !quote) {
			const end = source.indexOf("*/", index + 2) + 2;
			const text = source.slice(index, end);
			comments.set(line, `${comments.get(line) ?? ""}${text}`);
			line += text.split("\n").length - 1;
			index = end - 1;
			continue;
		}
		if (char === "\n") line++;
		if (quote) {
			if (char === quote) quote = undefined;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === "(") {
			parens++;
		} else if (char === ")") {
			parens--;
		} else if (parens === 0 && "{;}".includes(char)) {
			const text = buffer.trim();
			const parents = [...stack];
			if (char === "{") {
				const block = { prelude: text, line: start, parents, declarations: [] };
				blocks.push(block);
				stack.push(block);
			} else if (text.startsWith("@")) {
				statements.push({ text, line: start, parents });
			} else if (text) {
				const colon = text.indexOf(":");
				const declaration = {
					property: text.slice(0, colon).trim(),
					value: text
						.slice(colon + 1)
						.replace(/\s*!important$/, "")
						.trim(),
					important: text.endsWith("!important"),
					line: start,
					parents,
				};
				declarations.push(declaration);
				stack.at(-1)?.declarations.push(declaration);
			}
			if (char === "}") stack.pop();
			buffer = "";
			start = undefined;
			continue;
		}
		if (start === undefined && !/\s/.test(char)) start = line;
		buffer += char;
	}
	return { blocks, declarations, statements, comments };
};

const stylesheets = [
	...globSync("src/styles/**/*.css").map((file) => ({
		file,
		...parseCss(readFileSync(file, "utf8"), 1),
	})),
	...globSync("src/**/*.astro").flatMap((file) => {
		const source = readFileSync(file, "utf8");
		return [...source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)].map(
			({ 1: attributes, 2: css, index }) => ({
				file,
				attributes,
				...parseCss(css, source.slice(0, index).split("\n").length),
			}),
		);
	}),
];
const sheet = (file) => stylesheets.find((entry) => entry.file === file);
const selectorsOf = ({ parents }) =>
	parents
		.map(({ prelude }) => prelude)
		.filter((prelude) => !prelude.startsWith("@"));
const forced = ({ parents }) =>
	parents.some(({ prelude }) =>
		/^@media \(forced-colors: active\)/.test(prelude),
	);
const classesIn = (selector) =>
	[...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(([, name]) => name);

// The layout vocabulary, and the custom properties each primitive declares
// with its default on itself; nothing else may tune a primitive.
const layoutDoc = "src/styles/layout.css";
const vocabulary = [
	"stack",
	"box",
	"center",
	"cluster",
	"with-sidebar",
	"switcher",
	"cover",
	"auto-grid",
	"rows",
];
const primitives = new Map(
	sheet(layoutDoc)
		.blocks.filter(
			({ prelude, parents }) =>
				parents.length === 1 && /^\.[\w-]+$/.test(prelude),
		)
		.map(({ prelude, declarations }) => [
			prelude.slice(1),
			declarations
				.map(({ property }) => property)
				.filter((property) => property.startsWith("--")),
		]),
);

const colorProperty =
	/^(?:color|background-color|border(?:-(?:top|right|bottom|left|block|inline)(?:-start|-end)?)?(?:-color)?|outline(?:-color)?|text-decoration(?:-color)?|caret-color|accent-color|fill|stroke|column-rule-color)$/;
const colorKeywords = new Set(
	"transparent currentcolor inherit initial unset revert revert-layer none auto solid dashed dotted double groove ridge inset outset hidden thin medium thick in oklab oklch srgb underline overline line-through wavy".split(
		" ",
	),
);
const systemColor =
	/^(?:canvas|canvastext|linktext|visitedtext|activetext|buttonface|buttontext|buttonborder|field|fieldtext|highlight|highlighttext|selecteditem|selecteditemtext|mark|marktext|graytext|accentcolor|accentcolortext)$/i;
const logical = {
	width: "inline-size",
	height: "block-size",
	"min-width": "min-inline-size",
	"max-width": "max-inline-size",
	"min-height": "min-block-size",
	"max-height": "max-block-size",
	top: "inset-block-start",
	bottom: "inset-block-end",
	left: "inset-inline-start",
	right: "inset-inline-end",
};
const sides = {
	top: "block-start",
	bottom: "block-end",
	left: "inline-start",
	right: "inline-end",
};
const logicalOf = (property) =>
	logical[property] ??
	property.replace(
		/^(margin|padding|scroll-margin|scroll-padding|border)-(top|bottom|left|right)(?=$|-width$|-style$|-color$)/,
		(_, prefix, side) => `${prefix}-${sides[side]}`,
	);
// What is left of a value once the allowed names and the given words, numbers
// and functions are taken out.
const rest = (value, names, words) =>
	value
		.replace(/var\((--[\w-]+)\)/g, (match, name) => (names(name) ? "" : match))
		.replace(words, "")
		.replace(/\s-(?=\s)|[\s(),*/+]/g, "");
const numbers = String.raw`(?<![\w.])-?\d*\.?\d+(?![\w.%])`;
const functions = String.raw`(?<![\w-])(?:calc|min|max|clamp|minmax|repeat)(?=\()`;
const baselineGate =
	/@scope|@starting-style|@property|@function|(?<![\w-])if\(|(?<![\w-])anchor\(|anchor-name|position-anchor|field-sizing|from var\(|:open(?![\w-])|@container style\(|(?<![\w-])round\(|(?<![\w-])mod\(|sibling-index\(|font-size-adjust|ui-sans-serif/;

const layerOrder = (text = "") =>
	text.match(/^@layer ([\w\s,-]+)$/)?.[1].split(/\s*,\s*/) ?? [];
const order = layerOrder(
	sheet("src/styles/global.css").statements.find(({ text }) =>
		text.startsWith("@layer"),
	)?.text,
);
const imported = new Set(
	sheet("src/styles/global.css").statements.flatMap(
		({ text }) => text.match(/^@import "\.\/(.+)"$/)?.slice(1) ?? [],
	),
);

for (const {
	file,
	attributes,
	blocks,
	declarations,
	statements,
	comments,
} of stylesheets) {
	const tokensFile = file === "src/styles/tokens.css";
	const resetFile = file === "src/styles/reset.css";
	const local = new Set(
		declarations
			.map(({ property }) => property)
			.filter((property) => property.startsWith("--")),
	);
	const fallback = (line) => /\/\* fallback:/.test(comments.get(line));

	for (const { prelude, text = prelude, line } of [...blocks, ...statements]) {
		const where = `${file}:${line}  ${text}`;
		if (baselineGate.test(text) && !fallback(line)) {
			violations.push(
				`${where} → a Baseline Widely available feature, or a fallback that keeps the page working, marked /* fallback: … */ on the line  (AGENTS.md#browser-support)`,
			);
		}
		if (text.includes("prefers-color-scheme")) {
			violations.push(
				`${where} → a token with light-dark() in src/styles/tokens.css, which follows the scheme by itself  (DESIGN.md#role-tokens)`,
			);
		}
		// A page's scoped style may switch its own one-off layout at any rem
		// width of a container it declares; shared stylesheets keep the rows
		// thresholds.
		if (
			text.startsWith("@container") &&
			!/^@container \(inline-size >= (?:36|44|60)rem\)$/.test(text) &&
			!(
				file.startsWith("src/pages/") &&
				/^@container \(inline-size >= \d+(?:\.\d+)?rem\)$/.test(text)
			)
		) {
			violations.push(
				`${where} → (inline-size >= 36rem), 44rem or 60rem, the only thresholds outside a page's own <style>; or with-sidebar or switcher, which switch without one  (${layoutDoc})`,
			);
		}
		if (
			/^@media\b.*width/.test(text) &&
			!/^@media \(width >= (?:40|48|64)rem\)$/.test(text)
		) {
			violations.push(
				`${where} → (width >= 40rem), 48rem or 64rem, today's sm, md and lg, until the primitives replace them  (${layoutDoc})`,
			);
		}
	}

	for (const { prelude, line, declarations: own } of blocks) {
		const values = new Map(own.map(({ property, value }) => [property, value]));
		if (
			values.has("container-type") &&
			/max-content|fit-content/.test(values.get("inline-size"))
		) {
			violations.push(
				`${file}:${line}  ${prelude} → container-type only on a box whose width comes from outside; on one sized by its content, containment collapses it  (${layoutDoc})`,
			);
		}
	}

	for (const declaration of declarations) {
		const { property, value, important, line } = declaration;
		const where = `${file}:${line}  ${property}: ${value}`;
		const comment = comments.get(line) ?? "";
		const fail = (use, doc) => violations.push(`${where} → ${use}  (${doc})`);
		if (baselineGate.test(`${property}: ${value}`) && !fallback(line)) {
			fail(
				"a Baseline Widely available feature, or a fallback that keeps the page working, marked /* fallback: … */ on the line",
				"AGENTS.md#browser-support",
			);
		}
		if (
			!tokensFile &&
			/#[\da-f]{3,8}(?![\w-])|(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|light-dark)\(/i.test(
				value,
			)
		) {
			fail(
				"var(--token); colors and light-dark() pairs live only in src/styles/tokens.css",
				"DESIGN.md#role-tokens",
			);
		}
		if (property.startsWith("--")) continue;
		if (colorProperty.test(property)) {
			for (const word of value
				.replace(/var\([^()]*\)|#[\da-f]+/gi, "")
				.match(/(?<![\w-])[a-z][\w-]*(?![\w(-])/gi) ?? []) {
				if (systemColor.test(word) && !forced(declaration)) {
					fail(
						"system colors only inside @media (forced-colors: active), as forced-ink and forced-line in src/styles/utilities.css",
						"DESIGN.md#forced-colors",
					);
				} else if (
					!systemColor.test(word) &&
					!colorKeywords.has(word.toLowerCase()) &&
					!tokensFile
				) {
					fail(
						`var(--token) instead of the named color ${word}`,
						"DESIGN.md#role-tokens",
					);
				}
			}
		}
		if (property === "forced-color-adjust" && !forced(declaration)) {
			fail(
				"only inside @media (forced-colors: active)",
				"DESIGN.md#forced-colors",
			);
		}
		if (
			important &&
			!forced(declaration) &&
			!(
				resetFile &&
				selectorsOf(declaration).some((selector) =>
					selector.startsWith("[hidden]"),
				)
			)
		) {
			fail(
				"a later layer or a more specific selector; !important is only for [hidden] in the reset and for forced colors",
				"src/styles/global.css",
			);
		}
		// The phase amount calculator adopts the motion tokens in its own change.
		if (
			!tokensFile &&
			file !== "src/styles/components/phase-amount-calculator.css" &&
			((/^(?:transition|animation)-duration$/.test(property) &&
				value !== "var(--duration)") ||
				(/^(?:transition|animation)-timing-function$/.test(property) &&
					value !== "var(--ease)") ||
				(/^(?:transition|animation)$/.test(property) &&
					/(?<![\w.-])\d*\.?\d+m?s(?![\w-])|(?<![\w-])(?:cubic-bezier|steps|linear)\(|(?<![\w-])(?:ease(?:-in|-out|-in-out)?|linear|step-start|step-end)(?![\w-])/.test(
						value,
					)))
		) {
			fail(
				"var(--duration) and var(--ease), the motion tokens in src/styles/tokens.css",
				"DESIGN.md#1-overview",
			);
		}
		if (/^border(?:-[\w-]+)?-radius$/.test(property) && value !== "0") {
			fail("square corners: leave the radius out", "DESIGN.md#5-components");
		}
		if (
			(property === "box-shadow" && value !== "none") ||
			/drop-shadow\(/.test(value)
		) {
			fail(
				"a dashed border, border: var(--rule) var(--line), because surfaces are flat",
				"DESIGN.md#4-elevation",
			);
		}
		if (/^outline(?:-style)?$/.test(property) && /^(?:none|0)$/.test(value)) {
			fail(
				"the global :focus-visible outline; change only outline-offset",
				"DESIGN.md#role-tokens",
			);
		}
		if (
			property === "font-weight" &&
			!/^(?:400|600|inherit|bolder)$/.test(value)
		) {
			fail(
				"400, or 600 from a role class such as text-label",
				"DESIGN.md#3-typography",
			);
		}
		if (
			(property === "font-size" &&
				!/^var\(--step-[\w-]+\)$/.test(value) &&
				!(resetFile && /^(?:inherit|80%)$/.test(value))) ||
			(property === "font" && value !== "inherit")
		) {
			fail(
				"a role class, or font-size: var(--step-*) from src/styles/tokens.css",
				"DESIGN.md#3-typography",
			);
		}
		if (
			/^text-decoration(?:-line)?$/.test(property) &&
			value.includes("underline") &&
			file !== "src/styles/components/link.css" &&
			!resetFile
		) {
			fail(
				"the link class in src/styles/components/link.css, so an underline always means a link",
				"DESIGN.md#links",
			);
		}
		if (
			/^(?:(?:padding|margin|scroll-margin|scroll-padding|inset)(?:-[\w-]+)?|(?:row-|column-)?gap)$/.test(
				property,
			) &&
			rest(
				value,
				(name) => /^--space-|^--hairline$/.test(name) || local.has(name),
				new RegExp(
					`${functions}|${numbers}|(?<![\\w-])(?:auto|normal)(?![\\w-])`,
					"g",
				),
			) &&
			!comment.includes("/* constant:")
		) {
			fail(
				"0, auto, normal or a var(--space-*) step, or a primitive's own space property; a fixed control size takes /* constant: why */ on its line",
				"DESIGN.md#1-overview",
			);
		}
		if (logicalOf(property) !== property && !comment.includes("/* physical:")) {
			fail(
				`${logicalOf(property)}, the logical property; a square icon may keep it with /* physical: why */ on its line`,
				"DESIGN.md#1-overview",
			);
		}
		if (property === "text-align" && /^(?:left|right)$/.test(value)) {
			fail(
				`text-align: ${value === "left" ? "start" : "end"}, the logical value`,
				"DESIGN.md#1-overview",
			);
		}
		if (
			/^margin(?:-block(?:-start|-end)?|-top|-bottom)?$/.test(property) &&
			/\.stack(?![\w-]).*>/.test(selectorsOf(declaration).join(" "))
		) {
			fail(
				"a nested .stack with its own data-space; a child never adds to its stack's gap",
				layoutDoc,
			);
		}
	}

	// One layer per stylesheet, named in the order statement and imported, so
	// the order comes from global.css alone; Shell repeats that statement.
	if (file.startsWith("src/styles/") && file !== "src/styles/global.css") {
		const top = [...blocks, ...statements, ...declarations].filter(
			({ parents }) => parents.length === 0,
		);
		if (
			top.length !== 1 ||
			!order.includes(top[0].prelude?.match(/^@layer ([\w-]+)$/)?.[1])
		) {
			violations.push(
				`${file}  → wrap the whole file in one @layer <name> { … }, named in the statement in src/styles/global.css  (AGENTS.md#hard-requirements)`,
			);
		}
		if (!imported.has(file.slice("src/styles/".length))) {
			violations.push(
				`${file}  → @import it in src/styles/global.css, or it renders nothing  (AGENTS.md#hard-requirements)`,
			);
		}
	}
	if (
		attributes?.includes("is:inline") &&
		statements.some(({ text }) => text.startsWith("@layer")) &&
		String(layerOrder(statements[0].text)) !== String(order)
	) {
		violations.push(
			`${file}  layer statement → copy it from src/styles/global.css, so both name the same order  (AGENTS.md#hard-requirements)`,
		);
	}
}

// A primitive is tuned only through its own custom properties, on the element
// that carries it, with a step, a width token, a percentage or a small length;
// a switcher child may take a larger share with a numeric flex-grow.
const primitiveValue = (value) =>
	!rest(
		value,
		(name) => /^--(?:space-|column|measure|dialog)/.test(name),
		/(?<![\w.])(?:\d*\.?\d+)(?:%|fr)|(?<![\w.])(?:[0-3]?\d(?:\.\d+)?|40)(?:rem|ch)(?![\w])|(?<![\w-])(?:0|auto|minmax|max-content|min-content)(?![\w-])/g,
	);
for (const file of globSync("src/**/*.astro")) {
	const source = readFileSync(file, "utf8");
	for (const { 0: tag, index } of source.matchAll(/<[\w-]+\s[^<>]*>/g)) {
		const style = tag.match(/\sstyle="([^"]*)"/)?.[1];
		if (!style) continue;
		const classes = tag.match(/\sclass="([^"]*)"/)?.[1].split(/\s+/) ?? [];
		const own = classes.flatMap((name) => primitives.get(name) ?? []);
		for (const [property, value = ""] of style
			.split(";")
			.filter((part) => part.trim())
			.map((part) => part.split(":").map((text) => text.trim()))) {
			const where = `${file}:${source.slice(0, index).split("\n").length}  ${property}: ${value}`;
			const owner = [...primitives].find(([, names]) =>
				names.includes(property),
			)?.[0];
			if (property === "flex-grow" && /^\d*\.?\d+$/.test(value)) continue;
			if (own.includes(property)) {
				if (!primitiveValue(value)) {
					violations.push(
						`${where} → a var(--space-*) step, a var(--column*) or var(--measure) width, a percentage, or a rem or ch length up to 40  (${layoutDoc})`,
					);
				}
			} else if (owner) {
				violations.push(
					`${where} → set it on the element with the ${owner} class, which declares it  (${layoutDoc})`,
				);
			} else if (own.length > 0) {
				violations.push(
					`${where} → only the primitive's own custom properties (${own.join(", ")}); anything else belongs in a class  (${layoutDoc})`,
				);
			}
		}
	}
}

// Each primitive's data-* steps, read from the selectors that tune it
// (`&[data-space="xs"]`, `.rows[data-at="36"]`): a step must name a value one
// of the element's own primitives declares, so data-space on a box, whose step
// is data-padding, cannot silently do nothing.
const steps = new Map();
for (const block of sheet(layoutDoc).blocks) {
	const owner = [...block.parents, block]
		.map(({ prelude }) => prelude.match(/^\.([\w-]+)/)?.[1])
		.findLast((name) => primitives.has(name));
	if (!owner) continue;
	for (const part of block.prelude.split(/,(?![^(]*\))/)) {
		const compound = part.trim().split(/\s*[>+~ ](?![^(]*\))\s*/)[0];
		if (!/^(?:&|\.)/.test(compound)) continue;
		for (const [, name, value] of compound.matchAll(
			/\[data-([\w-]+)="([^"]*)"\]/g,
		)) {
			const own = steps.get(owner) ?? new Map();
			own.set(name, (own.get(name) ?? new Set()).add(value));
			steps.set(owner, own);
		}
	}
}
const stepNames = new Set(
	[...steps.values()].flatMap((own) => [...own.keys()]),
);
for (const file of globSync("src/**/*.astro")) {
	const source = readFileSync(file, "utf8");
	for (const { 0: tag, index } of source.matchAll(/<[\w-]+\s[^<>]*>/g)) {
		const own = (tag.match(/\sclass="([^"]*)"/)?.[1].split(/\s+/) ?? []).filter(
			(name) => primitives.has(name),
		);
		if (own.length === 0) continue;
		for (const [, name, value] of tag.matchAll(/\sdata-([\w-]+)="([^"]*)"/g)) {
			if (!stepNames.has(name)) continue;
			const where = `${file}:${source.slice(0, index).split("\n").length}  data-${name}="${value}"`;
			const declared = own.flatMap((primitive) => [
				...(steps.get(primitive)?.get(name) ?? []),
			]);
			if (declared.length === 0) {
				const readers = [...steps]
					.filter(([, names]) => names.has(name))
					.map(([primitive]) => primitive);
				violations.push(
					`${where} → only ${readers.join(", ")} read data-${name}; ${own.join(", ")} take${own.length === 1 ? "s" : ""} ${own.flatMap((primitive) => [...(steps.get(primitive)?.keys() ?? [])].map((step) => `data-${step}`)).join(", ") || "no step"}  (${layoutDoc})`,
				);
			} else if (!declared.includes(value)) {
				violations.push(
					`${where} → one of ${declared.join(", ")}, or leave it out for the default  (${layoutDoc})`,
				);
			}
		}
	}
}

// Report-only until the markup is converted (`--report` lists them): a page's
// scoped <style> holds one-off layout only; a rule that redoes a primitive
// should use it; every class markup uses is defined, and every defined one used.
const reports = [];
const native = new Set(
	stylesheets
		.filter(({ file }) => file.startsWith("src/styles/"))
		.flatMap(({ blocks }) =>
			blocks
				.filter(
					({ prelude, parents }) =>
						!prelude.startsWith("@") &&
						parents.every((parent) => !parent.prelude.startsWith("@theme")),
				)
				.flatMap(({ prelude }) => classesIn(prelude)),
		),
);
const pageProperty =
	/^(?:display|grid(?:-[\w-]+)?|(?:row-|column-)?gap|(?:place|align|justify)-[\w-]+|order|(?:min-|max-)?(?:inline|block)-size|(?:margin|padding)(?:-(?:block|inline)(?:-start|-end)?)?|container(?:-type|-name)?|flex(?:-[\w-]+)?|--[\w-]+)$/;
const pageWords = new RegExp(
	`min\\(100%,\\s*\\d*\\.?\\d+rem\\)|${functions}|${numbers}|(?<![\\w.])\\d*\\.?\\d+(?:%|fr)|(?<![\\w-])(?:auto|auto-fit|auto-fill|min-content|max-content|fit-content|span|subgrid|none|grid|inline-grid|flex|inline-flex|contents|block|start|end|center|stretch|baseline|space-between|wrap|row|column|inline-size|normal)(?![\\w-])`,
	"g",
);
for (const {
	file,
	attributes,
	blocks,
	declarations,
	statements,
} of stylesheets) {
	if (file.startsWith("src/pages/")) {
		const report = (line, text, use) =>
			reports.push(
				`${file}:${line}  ${text} → ${use}  (AGENTS.md#hard-requirements)`,
			);
		const local = new Set(blocks.flatMap(({ prelude }) => classesIn(prelude)));
		const top = [...blocks, ...statements, ...declarations].filter(
			({ parents }) => parents.length === 0,
		);
		if (/is:global|is:inline/.test(attributes)) {
			report(
				top[0]?.line,
				attributes.trim(),
				"a scoped <style>, without is:global or is:inline",
			);
		}
		if (top.length !== 1 || top[0].prelude !== "@layer page") {
			report(
				top[0]?.line,
				"<style>",
				"one @layer page { … } holding the whole block",
			);
		}
		for (const { prelude, line, parents } of blocks.filter(
			({ parents }) => parents.length > 0,
		)) {
			if (prelude.startsWith("@media")) {
				report(
					line,
					prelude,
					"no @media in a page; a primitive or a container threshold",
				);
			} else if (!prelude.startsWith("@")) {
				for (const selector of prelude.split(",")) {
					if (parents.length === 1 && !/^\.[\w-]/.test(selector.trim())) {
						report(
							line,
							selector.trim(),
							"start with a class defined in this block",
						);
					}
					if (
						/#|:global\(/.test(selector) ||
						classesIn(selector).some((name) => native.has(name))
					) {
						report(
							line,
							selector.trim(),
							"page classes only; tune a primitive through its custom properties in style",
						);
					}
				}
			}
		}
		for (const { property, value, important, line } of declarations) {
			if (!pageProperty.test(property)) {
				report(
					line,
					property,
					"layout properties only; color, type and lines come from role utilities and components",
				);
			} else if (
				important ||
				rest(
					value,
					(name) =>
						/^--(?:space-|column|measure|dialog)/.test(name) || local.has(name),
					pageWords,
				)
			) {
				report(
					line,
					`${property}: ${value}`,
					"0, auto, %, fr, a space or width token, or a min(100%, Nrem) floor, without !important",
				);
			}
		}
	}
	if (file === layoutDoc) {
		for (const name of primitives.keys()) {
			if (!vocabulary.includes(name)) {
				reports.push(
					`${file}  .${name} → compose the nine primitives (${vocabulary.join(", ")}) instead of adding a tenth  (${layoutDoc})`,
				);
			}
		}
		continue;
	}
	for (const { prelude, line, declarations: own } of blocks) {
		const values = new Map(own.map(({ property, value }) => [property, value]));
		const keys = [...values.keys()].filter(
			(property) => !property.startsWith("--"),
		);
		const primitive =
			(/grid/.test(values.get("display")) &&
				values.has("gap") &&
				keys.every((property) =>
					["display", "gap", "align-content"].includes(property),
				) &&
				"stack") ||
			(/repeat\(auto-(?:fit|fill),\s*minmax\(min\(100%/.test(
				values.get("grid-template-columns"),
			) &&
				"auto-grid") ||
			(/999/.test(values.get("flex-basis")) && "switcher") ||
			(values.get("flex-direction") === "column" &&
				values.has("min-block-size") &&
				"cover") ||
			(/flex/.test(values.get("display")) &&
				values.get("flex-wrap") === "wrap" &&
				"cluster or .with-sidebar") ||
			(values.has("max-inline-size") &&
				values.get("margin-inline") === "auto" &&
				"center") ||
			(/var\(--rule\)/.test(values.get("border")) &&
				values.has("padding") &&
				"box");
		if (primitive) {
			reports.push(
				`${file}:${line}  ${prelude} → use .${primitive} with its custom properties instead of repeating it  (${layoutDoc})`,
			);
		}
	}
}

// Classes in markup: class and *Class attributes, class:list, className and
// classList calls. Tailwind defines the rest while both systems coexist.
let tailwind = () => false;
try {
	const { __unstable__loadDesignSystem } = await import("tailwindcss");
	const system = await __unstable__loadDesignSystem(
		readFileSync("src/styles/global.css", "utf8"),
		{
			base: "src/styles",
			loadStylesheet: async (id, base) => {
				const path = id.startsWith("tailwindcss/")
					? `node_modules/${id}`
					: `${base}/${id}`;
				return {
					path,
					base: path.slice(0, path.lastIndexOf("/")),
					content: readFileSync(path, "utf8"),
				};
			},
		},
	);
	tailwind = (name) =>
		/^(?:group|peer)(?:\/[\w-]+)?$/.test(name) ||
		system.candidatesToCss([name])[0] !== null;
} catch {}
for (const file of globSync("src/**/*.astro")) {
	const source = readFileSync(file, "utf8");
	const local = new Set(
		stylesheets
			.filter((entry) => entry.file === file)
			.flatMap(({ blocks }) =>
				blocks.flatMap(({ prelude }) => classesIn(prelude)),
			),
	);
	const strings = [];
	for (const { 0: match, 1: text, index } of source.matchAll(
		/(?<![\w-])(?:class|\w*Class)(?::list)?=(?:"([^"]*)"|\{)|className = |classList\.\w+\(/g,
	)) {
		if (text !== undefined) {
			strings.push([text, index, true]);
			continue;
		}
		let depth = match.endsWith("{") ? 1 : 0;
		let end = index + match.length;
		while (end < source.length && (depth > 0 || !/[;\n)]/.test(source[end]))) {
			if (source[end] === "{") depth++;
			if (source[end] === "}") depth--;
			end++;
			if (match.endsWith("{") && depth === 0) break;
		}
		for (const [, ...quoted] of source
			.slice(index, end)
			.matchAll(/"([^"]*)"|'([^']*)'|`([^`$]*)`/g)) {
			strings.push([quoted.find((part) => part !== undefined), index, false]);
		}
	}
	// Strings inside an expression are only counted as used: they can be
	// values such as a variant name.
	for (const [text, index, attribute] of strings) {
		for (const name of text
			.split(/\s+/)
			.filter(
				(name) =>
					/[a-z]/i.test(name) && /^[\w@:[\]().%/#,&=>*+!-]+$/.test(name),
			)) {
			if (
				attribute &&
				!native.has(name) &&
				!local.has(name) &&
				!tailwind(name)
			) {
				reports.push(
					`${file}:${source.slice(0, index).split("\n").length}  ${name} → a class defined in src/styles/ or in this page's <style>; this one renders nothing  (AGENTS.md#hard-requirements)`,
				);
			}
		}
	}
}
// Like Tailwind, a class counts as used wherever its name stands as a word,
// such as in a list of series classes.
const markup = globSync("src/**/*.{astro,ts}")
	.map((file) => readFileSync(file, "utf8"))
	.join("\n");
for (const name of native) {
	if (!new RegExp(`(?<![\\w-])${name}(?:/\\d+)?(?![\\w-])`).test(markup)) {
		reports.push(
			`src/styles  .${name} is used nowhere → use it or remove its rule  (AGENTS.md#hard-requirements)`,
		);
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

// Every token states its WCAG 2.2 requirement in the frontmatter `contrast:`
// map, and fails below its minimum on each surface it names, in both schemes.
// axe checks only text, so this is the gate for lines, fills and chart marks.
const tokens = parseTokens(readFileSync("src/styles/tokens.css", "utf8"));
const requirements = parseContrast(readFileSync("DESIGN.md", "utf8"));
for (const { name } of tokens) {
	if (!requirements.has(name)) {
		violations.push(
			`DESIGN.md  contrast.${name} → add it: { min: 4.5 or 3, on: [surfaces] }, surface, or exempt  (DESIGN.md#role-tokens)`,
		);
	}
}
for (const [name, requirement] of requirements) {
	for (const surface of typeof requirement === "object" ? requirement.on : []) {
		if (requirements.get(surface) !== "surface") {
			violations.push(
				`DESIGN.md  contrast.${name} → measure it on a surface token, not ${surface}`,
			);
		}
	}
	if (tokens.every((token) => token.name !== name)) {
		violations.push(
			`DESIGN.md  contrast.${name} → name a token from src/styles/tokens.css`,
		);
	}
}
for (const scheme of ["light", "dark"]) {
	for (const { name, minimum, checks } of contrastChecks(
		tokens,
		requirements,
		scheme,
	)) {
		for (const { surface, ratio } of checks) {
			if (minimum && ratio < minimum) {
				violations.push(
					`src/styles/tokens.css  --${name} (${scheme}) is ${ratio.toFixed(2)}:1 on ${surface} → reach ${minimum}:1  (DESIGN.md#role-tokens)`,
				);
			}
		}
	}
}

// The type and space steps are generated, so tokens.css holds exactly what
// scripts/fluid-scale.js prints, and the frontmatter `spacing:` names each space
// step with its token value.
const scale = new Map(
	[
		...readFileSync("src/styles/tokens.css", "utf8").matchAll(
			/--((?:step|space)-[\w-]+): ([^;]+);/g,
		),
	].map(([, name, value]) => [name, value]),
);
for (const { name, value } of fluidTokens) {
	if (scale.get(name) !== value) {
		violations.push(
			`src/styles/tokens.css  --${name} → set it to ${value}, the output of node scripts/fluid-scale.js  (DESIGN.md#3-typography)`,
		);
	}
}
for (const name of scale.keys()) {
	if (fluidTokens.every((token) => token.name !== name)) {
		violations.push(
			`src/styles/tokens.css  --${name} → add the step to scripts/fluid-scale.js, or remove it  (DESIGN.md#3-typography)`,
		);
	}
}
const spacing = new Map(
	[
		...(frontmatter.split(/^spacing:\n/m)[1]?.split(/^\S/m)[0] ?? "").matchAll(
			/^ {2}([\w-]+): "([^"]+)"$/gm,
		),
	].map(([, name, value]) => [`space-${name}`, value]),
);
for (const [name, value] of scale) {
	if (name.startsWith("space-") && spacing.get(name) !== value) {
		violations.push(
			`DESIGN.md  spacing.${name.slice(6)} → set it to "${value}", the value of --${name} in src/styles/tokens.css`,
		);
	}
}
for (const name of spacing.keys()) {
	if (!scale.has(name)) {
		violations.push(
			`DESIGN.md  spacing.${name.slice(6)} → name a --space-* token from src/styles/tokens.css`,
		);
	}
}

// Each frontmatter type role states what its utility renders: the value of the
// role's --step-* token, and the line height and weight in global.css. Body has
// no utility; it is --step-0 at the reset's line height.
const theme = readFileSync("src/styles/global.css", "utf8");
const themeValue = (key) =>
	theme.match(new RegExp(`--text-${key}: ([^;]+);`))?.[1];
// A unitless line height, written as a number or calc(a / b).
const ratio = (value) => {
	const [, a, b = "1"] =
		value.match(/^(?:calc\()?([\d.]+)(?: \/ ([\d.]+)\))?$/) ?? [];
	return Math.round((Number(a) / Number(b)) * 1000) / 1000;
};
const roles = [
	...(frontmatter.split(/^typography:\n/m)[1]?.split(/^\S/m)[0] ?? "").matchAll(
		/^ {2}([\w-]+):\n((?: {4}.+\n)+)/gm,
	),
].map(([, name, body]) => ({
	name,
	...Object.fromEntries(
		[...body.matchAll(/^ {4}(\w+): "?([^"\n]*)"?$/gm)].map(([, key, value]) => [
			key,
			value,
		]),
	),
}));
const utilities = {
	display: "display",
	headline: "headline",
	title: "title",
	"body-small": "sm",
	label: "label",
	caption: "caption",
};
for (const name of ["body", ...Object.keys(utilities)]) {
	if (roles.every((role) => role.name !== name)) {
		violations.push(
			`DESIGN.md  typography.${name} → add the role with its fontSize, fontWeight and lineHeight  (DESIGN.md#3-typography)`,
		);
	}
}
for (const { name, fontSize, fontWeight, lineHeight } of roles) {
	const key = utilities[name];
	if (!key && name !== "body") {
		violations.push(
			`DESIGN.md  typography.${name} → name a role with a text-* utility in src/styles/global.css`,
		);
		continue;
	}
	const size = key ? themeValue(key) : "var(--step-0)";
	const expected = {
		fontSize: scale.get(size?.match(/^var\(--(step-[\w-]+)\)$/)?.[1]) ?? size,
		fontWeight: key ? (themeValue(`${key}--font-weight`) ?? "400") : "400",
		lineHeight: ratio(
			(key
				? themeValue(`${key}--line-height`)
				: readFileSync("src/styles/reset.css", "utf8").match(
						/html \{[^}]*line-height: ([\d.]+)/,
					)?.[1]) ?? "",
		),
	};
	for (const [property, value] of Object.entries({
		fontSize,
		fontWeight,
		lineHeight: ratio(lineHeight ?? ""),
	})) {
		if (String(value) !== String(expected[property])) {
			violations.push(
				`DESIGN.md  typography.${name}.${property} → set it to ${expected[property]}, what ${key ? `text-${key}` : "body text"} renders  (DESIGN.md#3-typography)`,
			);
		}
	}
}

if (process.argv.includes("--report")) {
	console.log(reports.join("\n"));
} else if (reports.length > 0) {
	console.log(
		`design:lint  ${reports.length} report-only findings (page-style, layout-one-off, vocabulary) → node scripts/design-lint.js --report`,
	);
}
if (violations.length > 0) {
	console.error(violations.join("\n"));
	process.exit(1);
}
