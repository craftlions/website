import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
	isAllowedComment,
	lintComments,
	scanComments,
} from "../../scripts/comment-lint.js";

describe("scanComments", () => {
	it("finds line and block comments in TypeScript while ignoring strings, templates, regexes, and division", () => {
		const source = [
			'const url = "https://craftlions.com//path";',
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
		assert.equal(comments[1]?.text, "// banned line 1\n// banned line 2");
		assert.equal(comments[2]?.text, "// trailing");
	});

	it("scans CSS block comments and ignores quoted URLs", () => {
		const source = [
			'background: url("https://example.com/a.svg");',
			"/* banned */",
			"padding-inline: 1rem; /* constant: fixed inset */",
		].join("\n");

		const comments = scanComments("src/styles/example.css", source);
		assert.equal(comments.length, 2);
		assert.equal(comments[0]?.text, "/* banned */");
		assert.equal(isAllowedComment(comments[0]?.text ?? ""), false);
		assert.equal(isAllowedComment(comments[1]?.text ?? ""), true);
	});

	it("scans Astro frontmatter, nested JSX with apostrophes, tags, scripts, and styles", () => {
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
			"      <p>Client's dashboard isn't empty</p>",
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
			"/* banned style comment */",
		]);

		const banned = comments.filter((c) => !isAllowedComment(c.text));
		assert.equal(banned.length, 5);
	});
});

describe("isAllowedComment", () => {
	it("allows design-lint markers, biome-ignore directives, and license headers", () => {
		assert.equal(isAllowedComment("/* enhancement: polish */"), true);
		assert.equal(isAllowedComment("{/* fallback: script handles it */}"), true);
		assert.equal(isAllowedComment("// fallback: browsers without it"), true);
		assert.equal(isAllowedComment("/* constant: room for bullet */"), true);
		assert.equal(isAllowedComment("/* physical: square icon */"), true);
		assert.equal(
			isAllowedComment(
				"{/* biome-ignore lint/a11y/useHeadingContent: slot */}",
			),
			true,
		);
		assert.equal(isAllowedComment("// SPDX-License-Identifier: MIT"), true);
		assert.equal(isAllowedComment("/* Copyright 2026 craftlions */"), true);
		assert.equal(isAllowedComment("// regular explanation"), false);
	});
});

describe("lintComments ratchet", () => {
	it("enforces baseline ceilings and flags stale baselines for ratcheting down", () => {
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
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
