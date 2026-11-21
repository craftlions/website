import { globSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REGEX_PREV_KEYWORDS = new Set([
	"return",
	"case",
	"throw",
	"in",
	"of",
	"typeof",
	"void",
	"delete",
	"new",
	"else",
	"do",
	"yield",
	"await",
]);

const REGEX_PREV_CHARS = new Set([
	"(",
	"[",
	"{",
	",",
	";",
	":",
	"=",
	"!",
	"&",
	"|",
	"?",
	"+",
	"-",
	"*",
	"%",
	"^",
	"~",
	"<",
	">",
]);

const ALLOWED_PATTERNS = [
	/^(?:\/\/|\{\/\*|\/\*)\s*(?:enhancement|fallback|constant|physical):/,
	/^(?:\/\/|\{\/\*|\/\*)\s*biome-ignore\b/,
	/SPDX-License-Identifier:/,
	/\bCopyright\s+(?:\(c\)|©|\d{4})/i,
];

export const isAllowedComment = (text) =>
	ALLOWED_PATTERNS.some((pattern) => pattern.test(text.trim()));

const countNewlines = (text) => {
	let count = 0;
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) === 10) count++;
	}
	return count;
};

const canStartRegex = (source, start, index) => {
	let cursor = index - 1;
	while (cursor >= start && /\s/.test(source[cursor])) cursor--;
	if (cursor < start) return true;
	const ch = source[cursor];
	if (ch === "+" && source[cursor - 1] === "+") return false;
	if (ch === "-" && source[cursor - 1] === "-") return false;
	if (REGEX_PREV_CHARS.has(ch)) return true;
	if (/[\w$]/.test(ch)) {
		let wordStart = cursor;
		while (wordStart > start && /[\w$]/.test(source[wordStart - 1])) {
			wordStart--;
		}
		return REGEX_PREV_KEYWORDS.has(source.slice(wordStart, cursor + 1));
	}
	return false;
};

const scanJsRange = (source, start, end, startLine, out, options = {}) => {
	const {
		stopOnClosingBrace = false,
		allowRegex = true,
		allowJsx = false,
	} = options;
	let i = start;
	let line = startLine;
	let braceDepth = 0;
	const templateBraceStack = [];

	while (i < end) {
		const c = source[i];
		const next = source[i + 1];

		if (c === "\n") {
			line++;
			i++;
			continue;
		}

		if (c === '"' || c === "'") {
			const quote = c;
			i++;
			while (i < end && source[i] !== quote) {
				if (source[i] === "\\") {
					if (source[i + 1] === "\n") line++;
					i += 2;
					continue;
				}
				if (source[i] === "\n") line++;
				i++;
			}
			i++;
			continue;
		}

		if (c === "`") {
			i++;
			while (i < end) {
				if (source[i] === "\\") {
					if (source[i + 1] === "\n") line++;
					i += 2;
					continue;
				}
				if (source[i] === "$" && source[i + 1] === "{") {
					templateBraceStack.push(braceDepth);
					braceDepth++;
					i += 2;
					break;
				}
				if (source[i] === "`") {
					i++;
					break;
				}
				if (source[i] === "\n") line++;
				i++;
			}
			continue;
		}

		if (c === "{") {
			braceDepth++;
			i++;
			continue;
		}

		if (c === "}") {
			if (stopOnClosingBrace && braceDepth === 0) {
				return { index: i + 1, line };
			}
			braceDepth = Math.max(0, braceDepth - 1);
			if (
				templateBraceStack.length > 0 &&
				templateBraceStack.at(-1) === braceDepth
			) {
				templateBraceStack.pop();
				i++;
				while (i < end) {
					if (source[i] === "\\") {
						if (source[i + 1] === "\n") line++;
						i += 2;
						continue;
					}
					if (source[i] === "$" && source[i + 1] === "{") {
						templateBraceStack.push(braceDepth);
						braceDepth++;
						i += 2;
						break;
					}
					if (source[i] === "`") {
						i++;
						break;
					}
					if (source[i] === "\n") line++;
					i++;
				}
				continue;
			}
			i++;
			continue;
		}

		if (c === "/" && next === "/") {
			const commentStart = i;
			let commentEnd = source.indexOf("\n", i + 2);
			if (commentEnd === -1 || commentEnd > end) commentEnd = end;
			out.push({
				start: commentStart,
				end: commentEnd,
				line,
				endLine: line,
				kind: "line",
				text: source.slice(commentStart, commentEnd),
			});
			i = commentEnd;
			continue;
		}

		if (c === "/" && next === "*") {
			const commentStart = i;
			const commentStartLine = line;
			let commentEnd = source.indexOf("*/", i + 2);
			if (commentEnd === -1 || commentEnd > end) commentEnd = end;
			else commentEnd += 2;
			const text = source.slice(commentStart, commentEnd);
			const endLine = commentStartLine + countNewlines(text);
			out.push({
				start: commentStart,
				end: commentEnd,
				line: commentStartLine,
				endLine,
				kind: "block",
				text,
			});
			line = endLine;
			i = commentEnd;
			continue;
		}

		if (
			allowJsx &&
			c === "<" &&
			(next === ">" || /[a-zA-Z]/.test(next ?? "")) &&
			canStartRegex(source, start, i)
		) {
			const result = scanAstroElement(source, i, end, line, out);
			i = result.index;
			line = result.line;
			continue;
		}

		if (
			allowRegex &&
			c === "/" &&
			next !== "/" &&
			next !== "*" &&
			canStartRegex(source, start, i)
		) {
			i++;
			let inClass = false;
			while (i < end && source[i] !== "\n") {
				if (source[i] === "\\") {
					i += 2;
					continue;
				}
				if (source[i] === "[") inClass = true;
				else if (source[i] === "]") inClass = false;
				else if (source[i] === "/" && !inClass) {
					i++;
					while (i < end && /[a-z]/i.test(source[i])) i++;
					break;
				}
				i++;
			}
			continue;
		}

		i++;
	}

	return { index: end, line };
};

const scanCssRange = (source, start, end, startLine, out) => {
	let i = start;
	let line = startLine;

	while (i < end) {
		const c = source[i];
		const next = source[i + 1];

		if (c === "\n") {
			line++;
			i++;
			continue;
		}

		if (c === '"' || c === "'") {
			const quote = c;
			i++;
			while (i < end && source[i] !== quote) {
				if (source[i] === "\\") {
					if (source[i + 1] === "\n") line++;
					i += 2;
					continue;
				}
				if (source[i] === "\n") line++;
				i++;
			}
			i++;
			continue;
		}

		if (c === "/" && next === "*") {
			const commentStart = i;
			const commentStartLine = line;
			let commentEnd = source.indexOf("*/", i + 2);
			if (commentEnd === -1 || commentEnd > end) commentEnd = end;
			else commentEnd += 2;
			const text = source.slice(commentStart, commentEnd);
			const endLine = commentStartLine + countNewlines(text);
			out.push({
				start: commentStart,
				end: commentEnd,
				line: commentStartLine,
				endLine,
				kind: "css",
				text,
			});
			line = endLine;
			i = commentEnd;
			continue;
		}

		i++;
	}
};

const scanAstroTag = (source, start, end, startLine, out) => {
	let i = start;
	let line = startLine;

	while (i < end) {
		const c = source[i];
		const next = source[i + 1];

		if (c === "\n") {
			line++;
			i++;
			continue;
		}

		if (c === '"' || c === "'") {
			const quote = c;
			i++;
			while (i < end && source[i] !== quote) {
				if (source[i] === "\n") line++;
				i++;
			}
			i++;
			continue;
		}

		if (c === "{") {
			const result = scanJsRange(source, i + 1, end, line, out, {
				stopOnClosingBrace: true,
			});
			i = result.index;
			line = result.line;
			continue;
		}

		if (c === "/" && next === "/") {
			const commentStart = i;
			let commentEnd = source.indexOf("\n", i + 2);
			if (commentEnd === -1 || commentEnd > end) commentEnd = end;
			out.push({
				start: commentStart,
				end: commentEnd,
				line,
				endLine: line,
				kind: "line",
				text: source.slice(commentStart, commentEnd),
			});
			i = commentEnd;
			continue;
		}

		if (c === "/" && next === "*") {
			const commentStart = i;
			const commentStartLine = line;
			let commentEnd = source.indexOf("*/", i + 2);
			if (commentEnd === -1 || commentEnd > end) commentEnd = end;
			else commentEnd += 2;
			const text = source.slice(commentStart, commentEnd);
			const endLine = commentStartLine + countNewlines(text);
			out.push({
				start: commentStart,
				end: commentEnd,
				line: commentStartLine,
				endLine,
				kind: "block",
				text,
			});
			line = endLine;
			i = commentEnd;
			continue;
		}

		if (c === ">") {
			return { index: i + 1, line };
		}

		i++;
	}

	return { index: end, line };
};

const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

const scanAstroElement = (source, start, end, startLine, out) => {
	let i = start;
	let line = startLine;
	const stack = [];

	while (i < end) {
		const c = source[i];

		if (c === "\n") {
			line++;
			i++;
			continue;
		}

		if (source.startsWith("<!--", i)) {
			const commentStart = i;
			const commentStartLine = line;
			let commentEnd = source.indexOf("-->", i + 4);
			if (commentEnd === -1 || commentEnd > end) commentEnd = end;
			else commentEnd += 3;
			const text = source.slice(commentStart, commentEnd);
			const endLine = commentStartLine + countNewlines(text);
			out.push({
				start: commentStart,
				end: commentEnd,
				line: commentStartLine,
				endLine,
				kind: "html",
				text,
			});
			line = endLine;
			i = commentEnd;
			continue;
		}

		if (source.startsWith("{/*", i)) {
			const commentStart = i;
			const commentStartLine = line;
			let commentEnd = source.indexOf("*/}", i + 3);
			if (commentEnd === -1 || commentEnd > end) commentEnd = end;
			else commentEnd += 3;
			const text = source.slice(commentStart, commentEnd);
			const endLine = commentStartLine + countNewlines(text);
			out.push({
				start: commentStart,
				end: commentEnd,
				line: commentStartLine,
				endLine,
				kind: "jsx",
				text,
			});
			line = endLine;
			i = commentEnd;
			continue;
		}

		if (c === "{") {
			const result = scanJsRange(source, i + 1, end, line, out, {
				stopOnClosingBrace: true,
				allowJsx: true,
			});
			i = result.index;
			line = result.line;
			continue;
		}

		if (c === "<" && source[i + 1] === "/") {
			const closeEnd = source.indexOf(">", i + 2);
			const nextIndex = closeEnd === -1 || closeEnd >= end ? end : closeEnd + 1;
			line += countNewlines(source.slice(i, nextIndex));
			i = nextIndex;
			stack.pop();
			if (stack.length === 0) return { index: i, line };
			continue;
		}

		if (
			c === "<" &&
			(source[i + 1] === ">" || /[a-zA-Z]/.test(source[i + 1] ?? ""))
		) {
			if (source[i + 1] === ">") {
				stack.push("");
				i += 2;
				continue;
			}
			const tagNameMatch = source.slice(i + 1).match(/^([a-zA-Z][\w.:-]*)/);
			const tagName = tagNameMatch?.[1] ?? "";
			const lowerTag = tagName.toLowerCase();
			const tagResult = scanAstroTag(source, i + 1, end, line, out);
			const selfClosing = source[tagResult.index - 2] === "/";
			i = tagResult.index;
			line = tagResult.line;

			if (!selfClosing && (lowerTag === "script" || lowerTag === "style")) {
				const closeTag = `</${lowerTag}>`;
				const closePos = source.indexOf(closeTag, i);
				const bodyEnd = closePos === -1 ? end : closePos;
				if (lowerTag === "script") {
					scanJsRange(source, i, bodyEnd, line, out);
				} else {
					scanCssRange(source, i, bodyEnd, line, out);
				}
				const nextIndex = closePos === -1 ? end : closePos + closeTag.length;
				line += countNewlines(source.slice(i, nextIndex));
				i = nextIndex;
				if (stack.length === 0) return { index: i, line };
				continue;
			}

			if (!selfClosing && !VOID_ELEMENTS.has(lowerTag)) {
				stack.push(tagName);
			} else if (stack.length === 0) {
				return { index: i, line };
			}
			continue;
		}

		i++;
	}

	return { index: end, line };
};

const scanAstro = (source, out) => {
	let i = 0;
	let line = 1;
	const end = source.length;

	if (source.startsWith("---\n") || source.startsWith("---\r\n")) {
		const fenceOffset = source.indexOf("\n") + 1;
		const closeIndex = source.indexOf("\n---", fenceOffset - 1);
		if (closeIndex !== -1) {
			scanJsRange(source, fenceOffset, closeIndex, 2, out);
			const afterFence = closeIndex + 4;
			line = 1 + countNewlines(source.slice(0, afterFence));
			i = afterFence;
		}
	}

	while (i < end) {
		const c = source[i];

		if (c === "\n") {
			line++;
			i++;
			continue;
		}

		if (source.startsWith("<!--", i)) {
			const commentStart = i;
			const commentStartLine = line;
			let commentEnd = source.indexOf("-->", i + 4);
			if (commentEnd === -1) commentEnd = end;
			else commentEnd += 3;
			const text = source.slice(commentStart, commentEnd);
			const endLine = commentStartLine + countNewlines(text);
			out.push({
				start: commentStart,
				end: commentEnd,
				line: commentStartLine,
				endLine,
				kind: "html",
				text,
			});
			line = endLine;
			i = commentEnd;
			continue;
		}

		if (source.startsWith("{/*", i)) {
			const commentStart = i;
			const commentStartLine = line;
			let commentEnd = source.indexOf("*/}", i + 3);
			if (commentEnd === -1) commentEnd = end;
			else commentEnd += 3;
			const text = source.slice(commentStart, commentEnd);
			const endLine = commentStartLine + countNewlines(text);
			out.push({
				start: commentStart,
				end: commentEnd,
				line: commentStartLine,
				endLine,
				kind: "jsx",
				text,
			});
			line = endLine;
			i = commentEnd;
			continue;
		}

		if (c === "{") {
			const result = scanJsRange(source, i + 1, end, line, out, {
				stopOnClosingBrace: true,
				allowJsx: true,
			});
			i = result.index;
			line = result.line;
			continue;
		}

		if (c === "<" && /[a-zA-Z]/.test(source[i + 1] ?? "")) {
			const tagNameMatch = source.slice(i + 1).match(/^([a-zA-Z][\w:-]*)/);
			const tagName = tagNameMatch?.[1]?.toLowerCase() ?? "";
			const tagResult = scanAstroTag(source, i + 1, end, line, out);
			const selfClosing = source[tagResult.index - 2] === "/";
			i = tagResult.index;
			line = tagResult.line;

			if (!selfClosing && (tagName === "script" || tagName === "style")) {
				const closeTag = `</${tagName}>`;
				const closePos = source.indexOf(closeTag, i);
				const bodyEnd = closePos === -1 ? end : closePos;
				if (tagName === "script") {
					scanJsRange(source, i, bodyEnd, line, out);
				} else {
					scanCssRange(source, i, bodyEnd, line, out);
				}
				const nextIndex = closePos === -1 ? end : closePos + closeTag.length;
				line += countNewlines(source.slice(i, nextIndex));
				i = nextIndex;
			}
			continue;
		}

		i++;
	}
};

export const scanComments = (file, source) => {
	const raw = [];
	const ext = path.extname(file);

	if (ext === ".css") {
		scanCssRange(source, 0, source.length, 1, raw);
	} else if (ext === ".astro") {
		scanAstro(source, raw);
	} else if (ext === ".pkl") {
		scanJsRange(source, 0, source.length, 1, raw, { allowRegex: false });
	} else {
		scanJsRange(source, 0, source.length, 1, raw);
	}

	const grouped = [];
	for (const comment of raw) {
		const previous = grouped.at(-1);
		if (
			previous &&
			previous.kind === "line" &&
			comment.kind === "line" &&
			comment.line === previous.endLine + 1 &&
			!isAllowedComment(comment.text) &&
			(!isAllowedComment(previous.text) ||
				/^(?:\/\/)\s*(?:enhancement|fallback):/.test(previous.text.trim()))
		) {
			const between = source.slice(previous.end, comment.start);
			if (/^\r?\n[ \t]*$/.test(between)) {
				previous.end = comment.end;
				previous.endLine = comment.endLine;
				previous.text = `${previous.text}\n${comment.text}`;
				continue;
			}
		}
		grouped.push({ ...comment });
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

export const collectFiles = (rootDir) => {
	const seen = new Set();
	for (const pattern of DEFAULT_GLOBS) {
		for (const file of globSync(pattern, { cwd: rootDir })) {
			const normalized = file.replaceAll("\\", "/");
			if (
				IGNORED_FILES.has(normalized) ||
				IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
			) {
				continue;
			}
			seen.add(normalized);
		}
	}
	return [...seen].sort();
};

export const lintComments = (rootDir, baseline = {}) => {
	const files = collectFiles(rootDir);
	const counts = {};
	const violations = [];
	const staleBaseline = [];

	for (const file of files) {
		const source = readFileSync(path.join(rootDir, file), "utf8");
		const banned = scanComments(file, source).filter(
			(comment) => !isAllowedComment(comment.text),
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

	for (const [file, allowed] of Object.entries(baseline)) {
		if (!files.includes(file) && allowed > 0) {
			staleBaseline.push(
				`${file}: baseline entry no longer matches a file — run \`node scripts/comment-lint.js --update-baseline\``,
			);
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

	const updateBaseline = process.argv.includes("--update-baseline");
	const { counts, violations, staleBaseline } = lintComments(rootDir, baseline);

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
