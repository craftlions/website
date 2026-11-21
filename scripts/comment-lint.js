import { spawnSync } from "node:child_process";
import { globSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseAstro } from "@astrojs/compiler-rs";
import { parseSync as parseJs } from "oxc-parser";
import postcss from "postcss";

const SHARED_ALLOWED_PATTERNS = [
	/^(?:\/\/|\{\/\*|\/\*)\s*(?:enhancement|fallback):/,
	/^(?:\/\/|\{\/\*|\/\*)\s*biome-ignore\b/,
	/SPDX-License-Identifier:/,
	/\bCopyright\s+(?:\(c\)|©|\d{4})/i,
];

const CSS_ALLOWED_PATTERNS = [/^\/\*\s*(?:constant|physical):/];

export const isAllowedComment = (text, kind) => {
	const trimmed = text.trim();
	if (SHARED_ALLOWED_PATTERNS.some((pattern) => pattern.test(trimmed))) {
		return true;
	}
	if (kind === undefined || kind === "css") {
		return CSS_ALLOWED_PATTERNS.some((pattern) => pattern.test(trimmed));
	}
	return false;
};

const buildLineIndex = (source) => {
	const lineStarts = [0];
	for (let i = 0; i < source.length; i++) {
		if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
	}
	return (offset) => {
		let lo = 0;
		let hi = lineStarts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (lineStarts[mid] <= offset) lo = mid;
			else hi = mid - 1;
		}
		return lo + 1;
	};
};

const scanCss = (file, source, baseOffset, lineOf, out) => {
	const root = postcss.parse(source, { from: file });
	root.walkComments((comment) => {
		const startOffset = comment.source?.start?.offset;
		const endOffset = comment.source?.end?.offset;
		if (startOffset === undefined || endOffset === undefined) return;
		const start = baseOffset + startOffset;
		const end = baseOffset + endOffset;
		const text = source.slice(startOffset, endOffset);
		out.push({
			start,
			end,
			line: lineOf(start),
			endLine: lineOf(Math.max(start, end - 1)),
			kind: "css",
			text,
		});
	});
};

const scanPkl = (source, lineOf, out) => {
	let i = 0;
	const end = source.length;

	while (i < end) {
		const c = source[i];
		const next = source[i + 1];

		if (c === '"') {
			if (source[i + 1] === '"' && source[i + 2] === '"') {
				const close = source.indexOf('"""', i + 3);
				i = close === -1 ? end : close + 3;
				continue;
			}
			i++;
			while (i < end && source[i] !== '"') {
				if (source[i] === "\\") i += 2;
				else i++;
			}
			i++;
			continue;
		}

		if (c === "/" && next === "/") {
			const start = i;
			let commentEnd = source.indexOf("\n", i + 2);
			if (commentEnd === -1) commentEnd = end;
			out.push({
				start,
				end: commentEnd,
				line: lineOf(start),
				endLine: lineOf(start),
				kind: "line",
				text: source.slice(start, commentEnd),
			});
			i = commentEnd;
			continue;
		}

		if (c === "/" && next === "*") {
			const start = i;
			let commentEnd = source.indexOf("*/", i + 2);
			if (commentEnd === -1) commentEnd = end;
			else commentEnd += 2;
			out.push({
				start,
				end: commentEnd,
				line: lineOf(start),
				endLine: lineOf(Math.max(start, commentEnd - 1)),
				kind: "block",
				text: source.slice(start, commentEnd),
			});
			i = commentEnd;
			continue;
		}

		i++;
	}
};

const scanJs = (file, source, lineOf, out) => {
	const result = parseJs(file, source);
	if (result.errors.length > 0) {
		const first = result.errors[0];
		throw new SyntaxError(
			`Failed to parse ${file}: ${first.message ?? String(first)}`,
		);
	}
	for (const comment of result.comments) {
		const start = comment.start;
		const end = comment.end;
		out.push({
			start,
			end,
			line: lineOf(start),
			endLine: lineOf(Math.max(start, end - 1)),
			kind: comment.type === "Line" ? "line" : "block",
			text: source.slice(start, end),
		});
	}
};

const walkAstroAst = (node, file, source, lineOf, out) => {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) walkAstroAst(item, file, source, lineOf, out);
		return;
	}

	if (node.type === "AstroComment") {
		out.push({
			start: node.start,
			end: node.end,
			line: lineOf(node.start),
			endLine: lineOf(Math.max(node.start, node.end - 1)),
			kind: "html",
			text: source.slice(node.start, node.end),
		});
		return;
	}

	if (
		node.type === "JSXElement" &&
		node.openingElement?.name?.name?.toLowerCase() === "style"
	) {
		for (const child of node.children ?? []) {
			if (child.type === "JSXText" && typeof child.start === "number") {
				const css = source.slice(child.start, child.end);
				scanCss(file, css, child.start, lineOf, out);
			}
		}
		return;
	}

	for (const [key, value] of Object.entries(node)) {
		if (key === "comments") continue;
		if (value && typeof value === "object") {
			walkAstroAst(value, file, source, lineOf, out);
		}
	}
};

const scanAstro = (file, source, lineOf, out) => {
	const result = parseAstro(source);
	const firstError = result.diagnostics.find(
		(diagnostic) => diagnostic.severity === "error",
	);
	if (firstError) {
		throw new SyntaxError(`Failed to parse ${file}: ${firstError.text}`);
	}

	for (const comment of result.ast.comments ?? []) {
		const isJsxWrapped =
			comment.type === "Block" &&
			source[comment.start - 1] === "{" &&
			source[comment.end] === "}";
		const start = isJsxWrapped ? comment.start - 1 : comment.start;
		const end = isJsxWrapped ? comment.end + 1 : comment.end;
		out.push({
			start,
			end,
			line: lineOf(start),
			endLine: lineOf(Math.max(start, end - 1)),
			kind: isJsxWrapped ? "jsx" : comment.type === "Line" ? "line" : "block",
			text: source.slice(start, end),
		});
	}

	walkAstroAst(result.ast, file, source, lineOf, out);
};

export const scanComments = (file, source) => {
	const raw = [];
	const lineOf = buildLineIndex(source);
	const ext = path.extname(file);

	if (ext === ".css") {
		scanCss(file, source, 0, lineOf, raw);
	} else if (ext === ".astro") {
		scanAstro(file, source, lineOf, raw);
	} else if (ext === ".pkl") {
		scanPkl(source, lineOf, raw);
	} else {
		scanJs(file, source, lineOf, raw);
	}

	raw.sort((a, b) => a.start - b.start);

	const grouped = [];
	for (const comment of raw) {
		const previous = grouped.at(-1);
		if (
			previous &&
			previous.kind === "line" &&
			comment.kind === "line" &&
			comment.line === previous.endLine + 1 &&
			!isAllowedComment(comment.text, comment.kind) &&
			(!isAllowedComment(previous.text, previous.kind) ||
				/^\/\/\s*(?:enhancement|fallback):/.test(previous.text.trim()))
		) {
			const between = source.slice(previous.end, comment.start);
			if (/^\r?\n[ \t]*$/.test(between)) {
				previous.end = comment.end;
				previous.endLine = comment.endLine;
				previous.text = `${previous.text}\n${comment.text}`;
				continue;
			}
		}
		grouped.push(comment);
	}

	return grouped;
};

const DEFAULT_GLOBS = [
	"src/**/*.{ts,tsx,js,jsx,mjs,cjs,astro,css}",
	"tests/**/*.{ts,tsx,js,jsx,mjs,cjs}",
	"scripts/**/*.{ts,js,mjs,cjs}",
	"*.{ts,js,mjs,cjs,pkl}",
];

const IGNORED_FILES = new Set(["scripts/design-lint.js"]);
const IGNORED_PREFIXES = ["tests/design-lint/"];

const isIgnored = (file) =>
	IGNORED_FILES.has(file) ||
	IGNORED_PREFIXES.some((prefix) => file.startsWith(prefix));

const generatedFiles = (rootDir, files) => {
	const { status, stdout } = spawnSync(
		"git",
		["check-attr", "-z", "--stdin", "linguist-generated"],
		{ cwd: rootDir, input: files.join("\0"), encoding: "utf8" },
	);
	const fields = status === 0 ? stdout.split("\0") : [];
	const generated = new Set();
	for (let index = 0; index + 2 < fields.length; index += 3) {
		if (["set", "true"].includes(fields[index + 2])) {
			generated.add(fields[index]);
		}
	}
	return generated;
};

export const collectFiles = (rootDir) => {
	const seen = new Set();
	for (const pattern of DEFAULT_GLOBS) {
		for (const file of globSync(pattern, { cwd: rootDir })) {
			const normalized = file.replaceAll("\\", "/");
			if (!isIgnored(normalized)) seen.add(normalized);
		}
	}
	const generated = generatedFiles(rootDir, [...seen]);
	return [...seen].filter((file) => !generated.has(file)).sort();
};

export const lintComments = (rootDir, baseline = {}, explicitFiles) => {
	const linted = collectFiles(rootDir);
	const files = explicitFiles
		? explicitFiles
				.map((file) =>
					path
						.relative(rootDir, path.resolve(rootDir, file))
						.replaceAll("\\", "/"),
				)
				.filter((file) => linted.includes(file))
		: linted;

	const counts = {};
	const violations = [];
	const staleBaseline = [];

	for (const file of files) {
		const source = readFileSync(path.join(rootDir, file), "utf8");
		const banned = scanComments(file, source).filter(
			(comment) => !isAllowedComment(comment.text, comment.kind),
		);
		if (banned.length > 0) counts[file] = banned.length;

		const allowed = baseline[file] ?? 0;
		if (banned.length > allowed) {
			for (const comment of banned) {
				const preview = comment.text.split("\n")[0].trim().slice(0, 80);
				violations.push(
					`${file}:${comment.line}  banned comment (allowed ${allowed}, found ${banned.length}): ${preview}`,
				);
			}
		} else if (banned.length < allowed) {
			staleBaseline.push(
				`${file}: baseline allows ${allowed} comments but only ${banned.length} remain — run \`node scripts/comment-lint.js --update-baseline\` to ratchet down`,
			);
		}
	}

	if (!explicitFiles) {
		for (const [file, allowed] of Object.entries(baseline)) {
			if (!files.includes(file) && allowed > 0) {
				staleBaseline.push(
					`${file}: baseline entry no longer matches a file — run \`node scripts/comment-lint.js --update-baseline\``,
				);
			}
		}
	}

	return { counts, violations, staleBaseline };
};

const isMain =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
	const rootDir = process.cwd();
	const baselinePath = path.join(rootDir, "scripts/comment-lint-baseline.json");
	let baseline = {};
	try {
		baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}

	const args = process.argv.slice(2);
	const updateBaseline = args.includes("--update-baseline");
	const explicitFiles = args.filter((arg) => !arg.startsWith("--"));
	const { counts, violations, staleBaseline } = lintComments(
		rootDir,
		baseline,
		explicitFiles.length > 0 ? explicitFiles : undefined,
	);

	if (updateBaseline) {
		const increased = Object.entries(counts).filter(
			([file, count]) => count > (baseline[file] ?? 0),
		);
		if (increased.length > 0) {
			for (const [file, count] of increased) {
				console.error(
					`${file}: comment count increased (${baseline[file] ?? 0} -> ${count}); baseline can only ratchet down`,
				);
			}
			process.exit(1);
		}
		const nextBaseline = Object.fromEntries(
			Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
		);
		writeFileSync(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`);
		process.exit(0);
	}

	const allErrors = [...violations, ...staleBaseline];
	if (allErrors.length > 0) {
		for (const message of allErrors) console.error(message);
		process.exit(1);
	}
}
