import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
	collectFiles,
	isAllowedComment,
	lintComments,
	scanComments,
} from "../../scripts/comment-lint.js";

describe("scanComments", () => {
	it("parses TypeScript comments via oxc-parser while ignoring strings, templates, regexes, division, and multibyte characters", () => {
		const source = [
			'const url = "https://craftlions.com//path · 24×24 🔥";',
			"const regex = /https?:\\/\\//g;",
			"const charClass = /[/\\\\]/;",
			"const quotient = a / b / c;",
			"const tpl = `prefix $" + "{/* inside */ 1 + 2} https://example.com`;",
			"// banned line 1",
			"// banned line 2",
			"const x = 1; // trailing",
		].join("\n");

		const comments = scanComments("src/example.ts", source);
		assert.equal(comments.length, 3);
		assert.equal(comments[0]?.text, "/* inside */");
		assert.equal(comments[0]?.line, 5);
		assert.equal(comments[1]?.text, "// banned line 1\n// banned line 2");
		assert.equal(comments[1]?.line, 6);
		assert.equal(comments[2]?.text, "// trailing");
		assert.equal(comments[2]?.line, 8);
	});

	it("parses CSS comments via PostCSS and ignores quoted URLs", () => {
		const source = [
			'a { background: url("https://example.com/a.svg"); }',
			"/* banned */",
			".badge { padding-inline: 1rem; /* constant: fixed inset */ }",
		].join("\n");

		const comments = scanComments("src/styles/example.css", source);
		assert.equal(comments.length, 2);
		assert.equal(comments[0]?.text, "/* banned */");
		assert.equal(comments[0]?.line, 2);
		assert.equal(isAllowedComment(comments[0]?.text ?? "", "css"), false);
		assert.equal(comments[1]?.text, "/* constant: fixed inset */");
		assert.equal(comments[1]?.line, 3);
		assert.equal(isAllowedComment(comments[1]?.text ?? "", "css"), true);
	});

	it("parses Astro frontmatter, nested JSX with apostrophes, tags, HTML comments, scripts, and styles", () => {
		const source = [
			"---",
			"// frontmatter comment",
			"const items = [1];",
			"---",
			"<div",
			"  // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable",
			'  tabindex="0"',
			">",
			"  {items.map((item) => (",
			"    <section>",
			"      <p>Client's dashboard isn't empty — 24×24</p>",
			"      {/* fallback: opens dialog */}",
			"      {/* banned jsx comment */}",
			"    </section>",
			"  ))}",
			"  <!-- banned html comment -->",
			"</div>",
			"<script>",
			"  // banned script comment",
			"</script>",
			"<style>",
			"  /* enhancement: polish only */",
			"  .box { padding-inline: 1rem; /* constant: fixed */ }",
			"  /* banned style comment */",
			"</style>",
		].join("\n");

		const comments = scanComments("src/components/Example.astro", source);
		const texts = comments.map((c) => c.text);
		assert.deepEqual(texts, [
			"// frontmatter comment",
			"// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable",
			"{/* fallback: opens dialog */}",
			"{/* banned jsx comment */}",
			"<!-- banned html comment -->",
			"// banned script comment",
			"/* enhancement: polish only */",
			"/* constant: fixed */",
			"/* banned style comment */",
		]);

		const banned = comments.filter((c) => !isAllowedComment(c.text, c.kind));
		assert.equal(banned.length, 5);
	});

	it("scans Pkl comments while ignoring strings and multiline strings", () => {
		const source = [
			'amends "package://example.com/Config.pkl"',
			'text = """',
			"// not a comment inside triple quotes",
			'"""',
			"// real pkl comment",
		].join("\n");

		const comments = scanComments("hk.pkl", source);
		assert.equal(comments.length, 1);
		assert.equal(comments[0]?.text, "// real pkl comment");
		assert.equal(comments[0]?.line, 5);
	});

	it("fails loudly on syntax errors instead of silently passing", () => {
		assert.throws(
			() => scanComments("src/broken.ts", "const = ;"),
			SyntaxError,
		);
		assert.throws(
			() => scanComments("src/styles/broken.css", ".a { color: "),
			/Unclosed block/,
		);
	});
});

describe("isAllowedComment", () => {
	it("allows design-lint markers in valid contexts, biome-ignore directives, and license headers", () => {
		assert.equal(isAllowedComment("/* enhancement: polish */", "css"), true);
		assert.equal(
			isAllowedComment("{/* fallback: script handles it */}", "jsx"),
			true,
		);
		assert.equal(
			isAllowedComment("// fallback: browsers without it", "line"),
			true,
		);
		assert.equal(
			isAllowedComment("/* constant: room for bullet */", "css"),
			true,
		);
		assert.equal(isAllowedComment("/* physical: square icon */", "css"), true);
		assert.equal(isAllowedComment("/* constant: sneak */", "block"), false);
		assert.equal(isAllowedComment("/* physical: sneak */", "block"), false);
		assert.equal(
			isAllowedComment(
				"{/* biome-ignore lint/a11y/useHeadingContent: slot */}",
				"jsx",
			),
			true,
		);
		assert.equal(
			isAllowedComment("// SPDX-License-Identifier: MIT", "line"),
			true,
		);
		assert.equal(
			isAllowedComment("/* Copyright 2026 craftlions */", "block"),
			true,
		);
		assert.equal(isAllowedComment("// regular explanation", "line"), false);
	});
});

describe("lintComments ratchet", () => {
	it("enforces baseline ceilings, flags stale baselines, and supports explicit file lists", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "comment-lint-"));
		try {
			mkdirSync(path.join(dir, "src"), { recursive: true });
			writeFileSync(path.join(dir, "src/clean.ts"), "export const a = 1;\n");
			writeFileSync(
				path.join(dir, "src/legacy.ts"),
				"// legacy 1\nexport const b = 2;\n",
			);

			const atBaseline = lintComments(dir, { "src/legacy.ts": 1 });
			assert.deepEqual(atBaseline.violations, []);
			assert.deepEqual(atBaseline.staleBaseline, []);

			const overBaseline = lintComments(dir, {});
			assert.equal(overBaseline.violations.length, 1);

			const underBaseline = lintComments(dir, { "src/legacy.ts": 2 });
			assert.deepEqual(underBaseline.violations, []);
			assert.equal(underBaseline.staleBaseline.length, 1);

			const scopedClean = lintComments(dir, { "src/legacy.ts": 1 }, [
				"src/clean.ts",
			]);
			assert.deepEqual(scopedClean.violations, []);
			assert.deepEqual(scopedClean.staleBaseline, []);

			mkdirSync(path.join(dir, ".cloudflare/types"), { recursive: true });
			writeFileSync(
				path.join(dir, ".cloudflare/types/index.d.ts"),
				"/** generated */\nexport {};\n",
			);
			const outsideGlobs = lintComments(dir, { "src/legacy.ts": 1 }, [
				".cloudflare/types/index.d.ts",
			]);
			assert.deepEqual(outsideGlobs.violations, []);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("skips files .gitattributes marks as generated", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "comment-lint-"));
		try {
			execFileSync("git", ["init", "--quiet"], { cwd: dir });
			mkdirSync(path.join(dir, "src"), { recursive: true });
			writeFileSync(
				path.join(dir, ".gitattributes"),
				"src/generated.ts linguist-generated=true\n",
			);
			writeFileSync(
				path.join(dir, "src/generated.ts"),
				"// generated\nexport const a = 1;\n",
			);
			writeFileSync(
				path.join(dir, "src/written.ts"),
				"// written\nexport const b = 2;\n",
			);

			assert.deepEqual(collectFiles(dir), ["src/written.ts"]);
			assert.deepEqual(
				lintComments(dir, {}, ["src/generated.ts"]).violations,
				[],
			);
			assert.equal(lintComments(dir, {}).violations.length, 1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
