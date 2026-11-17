// Fails on styling that bypasses the role tokens and the vocabulary in
// DESIGN.md, and on markup that bypasses the shared components.
import { globSync, readFileSync } from "node:fs";
import {
	contrastChecks,
	parseContrast,
	parseTokens,
} from "../src/lib/contrast.ts";
import { tokens as fluidTokens } from "./fluid-scale.js";

// Markup that has a component. Colours, sizes, weights and the other looks a
// class could carry are covered by the vocabulary rule below, which fails on
// any class no stylesheet defines, and by the declaration rules on the
// stylesheets.
const rules = [
	{
		id: "raw-button",
		pattern: /<button\b/g,
		use: '<Button>, with variant="quiet" or variant="hint" for smaller actions',
		doc: "DESIGN.md#buttons",
		ignore: "src/components/Button.astro",
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
];

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
						.flatMap(({ pattern, use, doc }) =>
							[...line.matchAll(pattern)].map(
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
				`${file}:${source.slice(0, index).split("\n").length}  hidden live region → render it empty and set only its text, spaced with :not(:empty)  (DESIGN.md#action-feedback)`,
			);
		}
	}
}

// A title tooltip reaches only a mouse user who hovers and waits: not touch,
// not the keyboard, and screen readers read it inconsistently. The state goes
// in visible text, a name in aria-label or sr-only text. An <iframe> needs its
// title as its name, an <svg> names itself with a <title> child (no attribute),
// and a control with a pattern states the format in its title, which the
// browser puts in the constraint message Field shows. Component props named
// title are not attributes, except where Field or Input forward them.
for (const file of globSync("src/**/*.astro")) {
	const source = readFileSync(file, "utf8");
	for (const { 0: tag, 1: name, index } of source.matchAll(
		/<([\w-]+)\s(?:[^<>{}]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*>/g,
	)) {
		if (
			/\stitle=/.test(tag) &&
			(/^[a-z]/.test(name) || /^(?:Field|Input)$/.test(name)) &&
			name !== "iframe" &&
			!/\spattern=/.test(tag)
		) {
			violations.push(
				`${file}:${source.slice(0, index).split("\n").length}  title on <${name}> → no tooltips: state it in visible text, name it with aria-label or sr-only text; title stays only on an <iframe>, as an <svg>'s <title> child, or beside a pattern  (DESIGN.md#dont)`,
			);
		}
	}
}

// Native CSS: the stylesheets in src/styles and every <style> block, split into
// blocks and declarations that know their line, the selectors and at-rules
// around them, and the comments that start or end on each line, which can
// carry an exception: /* constant: why */, /* physical: why */, or for a newer
// feature /* enhancement: what is lost without it */ or /* fallback: … */.
const parseCss = (source, firstLine) => {
	const blocks = [];
	const declarations = [];
	const statements = [];
	const comments = new Map();
	const ends = new Map();
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
			ends.set(line, `${ends.get(line) ?? ""}${text}`);
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
	return { blocks, declarations, statements, comments, ends };
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
// Features that are not Baseline Widely available (web-features, November
// 2026). A browser without one drops the declaration, or the whole rule, so
// each use carries a marker on its line, on the line above, or above its
// rule: /* enhancement: what is lost without it */ when only polish is lost,
// /* fallback: … */ when the Widely available way stays beside it. A rule in
// wholeRuleGate is dropped whole and can hold layout, so it takes only a
// fallback. Move a feature out of the list once it is Widely available.
const baselineGate = new RegExp(
	[
		"@scope",
		"@starting-style",
		"@property",
		"@function",
		"@view-transition",
		"(?<![\\w-])(?:if|anchor|anchor-size|round|mod|calc-size|contrast-color|sibling-index|sibling-count)\\(",
		"attr\\([^)]*type\\(",
		"\\(\\s*from\\s",
		"(?<![\\w-])(?:anchor-name|position-anchor|position-area|position-try(?:-[\\w-]+)?|field-sizing|font-size-adjust|transition-behavior|interpolate-size|reading-flow|animation-timeline|view-timeline(?:-[\\w-]+)?|scroll-timeline(?:-[\\w-]+)?|text-box(?:-[\\w-]+)?)(?![\\w-])",
		"(?<![\\w-])allow-discrete(?![\\w-])",
		"text-wrap(?:-style)?: pretty",
		":open(?![\\w-])",
		":popover-open",
		":interest",
		"ui-sans-serif",
	].join("|"),
);
const wholeRuleGate = /^@(?:scope|function)/;

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
	ends,
} of stylesheets) {
	const tokensFile = file === "src/styles/tokens.css";
	const resetFile = file === "src/styles/reset.css";
	const local = new Set(
		declarations
			.map(({ property }) => property)
			.filter((property) => property.startsWith("--")),
	);
	// The marker on a line, on the line above it, or above its rule.
	const marker = ({ line, parents }) =>
		[
			comments.get(line),
			ends.get(line),
			ends.get(line - 1),
			ends.get(parents.at(-1)?.line - 1),
		]
			.join("")
			.match(/\/\* (enhancement|fallback):/)?.[1];
	const gate = (node, text) => {
		if (!baselineGate.test(text)) return;
		const whole = wholeRuleGate.test(text);
		const found = marker(node);
		if (whole ? found !== "fallback" : !found) {
			violations.push(
				`${file}:${node.line}  ${text} → a Baseline Widely available feature; or keep it where a browser without it still works, marked on its line or above its rule with ${whole ? "/* fallback: … */ and the Widely available way beside it, because this rule is dropped whole" : "/* enhancement: what is lost without it */, or /* fallback: … */ with the Widely available way beside it"}  (AGENTS.md#browser-support)`,
			);
		}
	};

	for (const node of [...blocks, ...statements]) {
		const { prelude, text = prelude, line } = node;
		const where = `${file}:${line}  ${text}`;
		gate(node, text);
		if (text.includes("prefers-color-scheme")) {
			violations.push(
				`${where} → a token with light-dark() in src/styles/tokens.css, which follows the scheme by itself  (DESIGN.md#role-tokens)`,
			);
		}
		// No container queries: a primitive or the lines pattern switches by
		// its own width without one.
		if (text.startsWith("@container")) {
			violations.push(
				`${where} → no container queries; use a primitive  (${layoutDoc})`,
			);
		}
		// The window's width says nothing about the room a component has; @media
		// stays for what only the device knows (hover, forced-colors,
		// prefers-reduced-motion).
		if (/^@media\b.*width/.test(text)) {
			violations.push(
				`${where} → a primitive that switches by its own width (with-sidebar, switcher, auto-grid, cluster) or the lines pattern; no window-width media queries  (${layoutDoc})`,
			);
		}
	}

	for (const declaration of declarations) {
		const { property, value, important, line } = declaration;
		const where = `${file}:${line}  ${property}: ${value}`;
		const comment = comments.get(line) ?? "";
		const fail = (use, doc) => violations.push(`${where} → ${use}  (${doc})`);
		gate(declaration, `${property}: ${value}`);
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
			// A relative colour's channel keywords (r g b, l c h) are not names.
			for (const word of value
				.replace(/[\w-]+\(\s*from\s(?:[^()]|\([^()]*\))*\)/g, "")
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
		if (
			!tokensFile &&
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
				// anchor() places a box against another, so it is no space step.
				new RegExp(
					`(?<![\\w-])anchor(?:-size)?\\([^()]*\\)|${functions}|${numbers}|(?<![\\w-])(?:auto|normal)(?![\\w-])`,
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
				`${file}  → wrap the whole file in one @layer <name> { … }, named in the statement in src/styles/global.css  (DESIGN.md#vocabulary)`,
			);
		}
		if (!imported.has(file.slice("src/styles/".length))) {
			violations.push(
				`${file}  → @import it in src/styles/global.css, or it renders nothing  (DESIGN.md#vocabulary)`,
			);
		}
	}
	if (
		attributes?.includes("is:inline") &&
		statements.some(({ text }) => text.startsWith("@layer")) &&
		String(layerOrder(statements[0].text)) !== String(order)
	) {
		violations.push(
			`${file}  layer statement → copy it from src/styles/global.css, so both name the same order  (DESIGN.md#vocabulary)`,
		);
	}
}

// Every stylesheet loads on every page, so a class two files define styles both
// files' markup. A rule defines the first class (or custom element) of its
// selector's first compound once nesting is resolved; everything after it only
// configures elements in that scope, as `.footer .switcher` or
// `.shell > .center` do. Each name is defined by one stylesheet in src/styles,
// and a page's scoped <style> defines only names no stylesheet defines, because
// the global rule reaches the page's elements as well.
const splitList = (selector) =>
	selector.split(/,(?![^(]*\))/).map((part) => part.trim());
const definedName = (compound) =>
	compound
		.replace(/:(?:not|has)\((?:[^()]|\([^()]*\))*\)/g, "")
		.match(/(\.-?[_a-zA-Z][\w-]*)|^([a-z][\w]*-[\w-]*)/)
		?.slice(1)
		.find(Boolean);
const definedBy = ({ prelude, parents }) => {
	let names = [];
	for (const selectors of [...parents, { prelude }]
		.map(({ prelude }) => prelude)
		.filter((prelude) => !prelude.startsWith("@"))) {
		names = splitList(selectors).flatMap((selector) =>
			names.length > 0 && (selector.startsWith("&") || !selector.includes("&"))
				? names
				: [definedName(selector.split(/\s*[>+~ ](?![^(]*\))\s*/)[0])].filter(
						Boolean,
					),
		);
	}
	return names;
};
const definitions = new Map();
for (const { file, blocks } of stylesheets) {
	for (const block of blocks) {
		if (
			block.prelude.startsWith("@") ||
			block.parents.some(({ prelude }) => prelude.startsWith("@keyframes"))
		) {
			continue;
		}
		for (const name of new Set(definedBy(block))) {
			const files = definitions.get(name) ?? new Map();
			if (!files.has(file)) files.set(file, block.line);
			definitions.set(name, files);
		}
	}
}
for (const [name, files] of definitions) {
	const shared = [...files].filter(([file]) => file.startsWith("src/styles/"));
	const pages = [...files].filter(([file]) => !file.startsWith("src/styles/"));
	const clash =
		shared.length > 1 ? shared.slice(1) : shared.length === 1 ? pages : [];
	for (const [file, line] of clash) {
		violations.push(
			`${file}:${line}  ${name} is also defined in ${shared[0][0]}:${shared[0][1]} → rename this one after its own component, or style the element under your own class (\`.your-area ${name}\`); every stylesheet loads on every page, so both rules reach both pages  (DESIGN.md#vocabulary)`,
		);
	}
}

// No container: a container query has nothing to query, and containment
// collapses a box sized by its content.
for (const { file, declarations } of stylesheets) {
	for (const { property, value, line } of declarations) {
		if (/^container(?:-type|-name)?$/.test(property)) {
			violations.push(
				`${file}:${line}  ${property}: ${value} → no container queries; use a primitive  (${layoutDoc})`,
			);
		}
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
// (`&[data-space="xs"]`, `&[data-padding="xs"]`): a step must name a value one
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

// A page's scoped <style> holds one-off layout only (page-style); a rule that
// redoes a primitive uses it instead (layout-one-off); every class markup or a
// script uses is defined, and every defined one used (vocabulary).
//
// Deliberate exceptions, each with its reason:
// - the specimen's page artwork, sized and drawn by the page itself: the
//   probe the design tests measure, the token swatches and the divider
//   between demos;
const pageArtwork = new Map([
	["src/pages/brand/specimen.astro", [".probe", ".swatch", ".divided"]],
]);
// - control outlines, which look like a box but are not planes: their
//   padding and line are the control's own size and boundary (a Button, an
//   Input, the nav's stand-in drawn like a Button, the cost split's % boxes
//   drawn like an Input);
// - the line of the lines pattern, which wraps like a cluster but sizes its
//   first part to take the room the figure and the actions leave.
const oneOffExceptions = new Map([
	["src/styles/components/button.css", /^\.button:is\(/],
	["src/styles/components/input.css", /^\.input$/],
	["src/styles/components/nav.css", /^& \.nav-placeholder$/],
	["src/styles/components/phase-amount-calculator.css", /^\.split-share,/],
	["src/styles/components/lines.css", /^:is\(\s*\.lines > li,/],
]);
const native = new Set(
	stylesheets
		.filter(({ file }) => file.startsWith("src/styles/"))
		.flatMap(({ blocks }) =>
			blocks
				.filter(({ prelude }) => !prelude.startsWith("@"))
				.flatMap(({ prelude }) => classesIn(prelude)),
		),
);
const pageProperty =
	/^(?:display|grid(?:-[\w-]+)?|(?:row-|column-)?gap|(?:place|align|justify)-[\w-]+|order|(?:min-|max-)?(?:inline|block)-size|(?:margin|padding)(?:-(?:block|inline)(?:-start|-end)?)?|flex(?:-[\w-]+)?|--[\w-]+)$/;
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
			violations.push(
				`${file}:${line}  ${text} → ${use}  (DESIGN.md#page-styles)`,
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
					"no @media in a page; a primitive that switches by its own width",
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
		for (const { property, value, important, line, parents } of declarations) {
			if (
				pageArtwork
					.get(file)
					?.includes(
						parents.findLast(({ prelude }) => !prelude.startsWith("@"))
							?.prelude,
					)
			) {
				continue;
			}
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
	// A component keeps its own rules in one scoped <style>: Astro adds its
	// data-astro-cid-* attribute to every compound, so a rule reaches only the
	// elements the component renders. Each top-level selector starts with a
	// class or custom element of the component; an element a child component
	// or a script renders is reached after it with :global(), never alone.
	if (file.startsWith("src/components/")) {
		const report = (line, text, use) =>
			violations.push(
				`${file}:${line}  ${text} → ${use}  (DESIGN.md#component-styles)`,
			);
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
		if (top.length !== 1 || top[0].prelude !== "@layer components") {
			report(
				top[0]?.line,
				"<style>",
				"one @layer components { … } holding the whole block",
			);
		}
		// The outermost selectors, inside the layer and any at-rule.
		for (const { prelude, line } of blocks.filter(
			({ prelude, parents }) =>
				!prelude.startsWith("@") &&
				parents.every((parent) => parent.prelude.startsWith("@")),
		)) {
			for (const selector of splitList(prelude)) {
				if (!/^(?:\.-?[_a-zA-Z]|[a-z][\w]*-[\w-]*(?![\w(]))/.test(selector)) {
					report(
						line,
						selector,
						"start with a class or custom element this component renders, so the rule stays scoped; reach a child component's or a script's element after it with :global()",
					);
				}
			}
		}
		const markup = readFileSync(file, "utf8").replace(
			/<style\b[\s\S]*?<\/style>/g,
			"",
		);
		for (const { prelude, line } of blocks) {
			for (const name of classesIn(
				prelude.replace(/:global\((?:[^()]|\([^()]*\))*\)/g, ""),
			)) {
				if (!new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(markup)) {
					report(
						line,
						`.${name}`,
						"use it in this component's markup or remove its rule; a scoped rule reaches no other file",
					);
				}
			}
		}
	}
	if (file === layoutDoc) {
		for (const name of primitives.keys()) {
			if (!vocabulary.includes(name)) {
				violations.push(
					`${file}  .${name} → compose the primitives (${vocabulary.join(", ")}) instead of adding a tenth  (${layoutDoc})`,
				);
			}
		}
		continue;
	}
	// The element defaults in base.css repeat a primitive on purpose, so plain
	// markup needs no class.
	if (file === "src/styles/base.css") continue;
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
		if (primitive && !oneOffExceptions.get(file)?.test(prelude)) {
			violations.push(
				`${file}:${line}  ${prelude} → use .${primitive} with its custom properties instead of repeating it  (DESIGN.md#vocabulary)`,
			);
		}
	}
}

// Classes in markup: class and *Class attributes, class:list, className and
// classList calls.
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
		// A script's className and classList take class names only.
		const script = !match.endsWith("{");
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
		// A name assembled with ${} is invisible to this check and to a search
		// for the class; spell out each whole name and choose between them.
		for (const [literal] of source.slice(index, end).matchAll(/`[^`]*`/g)) {
			if (/[\w-]\$\{|\}[\w-]/.test(literal)) {
				violations.push(
					`${file}:${source.slice(0, index).split("\n").length}  ${literal} → whole class names, chosen with a ternary or class:list, never assembled with \${}; a data-* attribute for a variant  (DESIGN.md#vocabulary)`,
				);
			}
		}
		for (const [, ...quoted] of source
			.slice(index, end)
			.matchAll(/"([^"]*)"|'([^']*)'|`([^`$]*)`/g)) {
			strings.push([quoted.find((part) => part !== undefined), index, script]);
		}
	}
	// Strings inside a class expression are only counted as used: they can be
	// values such as a variant name compared in it.
	for (const [text, index, attribute] of strings) {
		for (const name of text
			.split(/\s+/)
			.filter(
				(name) =>
					/[a-z]/i.test(name) && /^[\w@:[\]().%/#,&=>*+!-]+$/.test(name),
			)) {
			if (attribute && !native.has(name) && !local.has(name)) {
				violations.push(
					`${file}:${source.slice(0, index).split("\n").length}  ${name} → a class from DESIGN.md#vocabulary, a shared stylesheet in src/styles/components/, or this component's or page's own <style>; this one renders nothing  (DESIGN.md#vocabulary)`,
				);
			}
		}
	}
}
// A class counts as used wherever its name stands as a word, such as in a list
// of series classes.
const markup = globSync("src/**/*.{astro,ts}")
	.map((file) => readFileSync(file, "utf8"))
	.join("\n");
for (const name of native) {
	if (!new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(markup)) {
		violations.push(
			`src/styles  .${name} is used nowhere → use it or remove its rule  (DESIGN.md#vocabulary)`,
		);
	}
}

// Newer features in markup and scripts, under the same rule as in CSS: each
// use carries /* enhancement: … */ or /* fallback: … */ (as {/* … */},
// <!-- … --> or // …) on its line or just above its tag, or the file holds a
// marked comment that names the feature, as a script's fallback does.
const markupGate = [
	{
		feature: "invoker commands",
		use: /\scommand(?:for)?=/g,
		names: /invoker command/i,
	},
	{ feature: "closedby", use: /\sclosedby=/g, names: /closedby/ },
	{
		feature: 'hidden="until-found"',
		use: /["']until-found["']/g,
		names: /until-found|beforematch/,
	},
	{ feature: 'rel="expect"', use: /\srel="expect"/g, names: /rel="expect"/ },
];
for (const file of globSync("src/**/*.astro")) {
	const source = readFileSync(file, "utf8");
	const lineAt = (index) => source.slice(0, index).split("\n").length;
	const marks = [
		...source.matchAll(
			/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*(?:\n[ \t]*\/\/[^\n]*)*/g,
		),
	]
		.filter(([text]) =>
			/^(?:\/\*|<!--|\/\/)\s*(?:enhancement|fallback):/.test(text),
		)
		.map(({ 0: text, index }) => ({ text, end: lineAt(index + text.length) }));
	const tags = [...source.matchAll(/<[\w-]+\s[^<>]*>/g)];
	for (const { feature, use, names } of markupGate) {
		if (marks.some(({ text }) => names.test(text))) continue;
		for (const { index } of source.matchAll(use)) {
			const tag = tags.find(
				(match) => match.index < index && index < match.index + match[0].length,
			);
			const line = lineAt(index);
			const start = tag ? lineAt(tag.index) : line;
			const marked = marks.some(({ end }) => end >= start - 1 && end <= line);
			if (!marked) {
				violations.push(
					`${file}:${line}  ${feature} → mark it on its line or above its tag: {/* enhancement: what is lost without it */}, or {/* fallback: … */} naming where the Widely available way runs  (AGENTS.md#browser-support)`,
				);
			}
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

// Each frontmatter type role states what its utility renders: the size, line
// height and weight of its rule in utilities.css, with a --step-* size and a
// --leading-* line height read from tokens.css. Body has no utility; it is
// --step-0 at the reset's line height.
const leading = new Map(
	[
		...readFileSync("src/styles/tokens.css", "utf8").matchAll(
			/--(leading-[\w-]+): ([^;]+);/g,
		),
	].map(([, name, value]) => [name, value]),
);
const roleRule = (key) =>
	new Map(
		sheet("src/styles/utilities.css")
			.blocks.find(({ prelude }) => prelude === `.text-${key}`)
			?.declarations.map(({ property, value }) => [
				property,
				value.replace(
					/^var\(--(leading-[\w-]+)\)$/,
					(match, name) => leading.get(name) ?? match,
				),
			]) ?? [],
	);
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
	const rule = key ? roleRule(key) : new Map();
	const size = key ? rule.get("font-size") : "var(--step-0)";
	const expected = {
		fontSize: scale.get(size?.match(/^var\(--(step-[\w-]+)\)$/)?.[1]) ?? size,
		fontWeight: rule.get("font-weight") ?? "400",
		lineHeight: ratio(
			(key
				? rule.get("line-height")
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

if (violations.length > 0) {
	console.error(violations.join("\n"));
	process.exit(1);
}
