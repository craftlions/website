// scripts/design-lint.js on fixtures: each case under accepted/ and rejected/
// mirrors src/ and is laid over a copy of the repository's src/ and DESIGN.md,
// then the linter runs there. An accepted case passes; a rejected case fails
// with the expected message on the fixture's own file, so a rule that stops
// matching, or starts matching sound code, shows up here.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	cpSync,
	globSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const root = join(import.meta.dirname, "../..");
const linter = join(root, "scripts/design-lint.js");

// The message each rejected case must report on its fixture.
const rejected: Record<string, string> = {
	"raw-button": "<button → use <Button>",
	"native-disclosure": "<details → use <DisclosureButton>",
	"hidden-live-region": "hidden live region",
	"title-tooltip": "title on <span> → no tooltips",
	"undefined-class": "text-purple → a class from DESIGN.md#vocabulary",
	"assembled-class": "never assembled with",
	"unlayered-component-style":
		"one @layer components { … } holding the whole block",
	"global-component-style": "is:global → a scoped <style>",
	"unscoped-component-selector":
		":global(p) → start with a class or custom element",
	"unused-component-class":
		".lint-elsewhere → use it in this component's markup",
	"single-use-stylesheet":
		"only src/components/LintFixture.astro uses it: move its rules into that component's scoped <style>",
	"unmarked-markup-feature": 'hidden="until-found" → mark it',
	"container-query": "container-type: inline-size → no container queries",
	"window-media-query": "no window-width media queries",
	"unmarked-css-feature": "text-box: trim-both cap alphabetic → a Baseline",
	"scope-without-fallback": "because this rule is dropped whole",
	"raw-color": "color: #336699 → var(--token)",
};

const lint = async (fixture?: string) => {
	const dir = mkdtempSync(join(tmpdir(), "design-lint-"));
	try {
		cpSync(join(root, "src"), join(dir, "src"), { recursive: true });
		cpSync(join(root, "DESIGN.md"), join(dir, "DESIGN.md"));
		if (fixture) cpSync(fixture, dir, { recursive: true });
		// A fixture's stylesheet is imported like every other one.
		const files = fixture ? globSync("src/**/*", { cwd: fixture }) : [];
		const global = join(dir, "src/styles/global.css");
		const imports = files
			.filter((file) => /^src\/styles\/components\/.+\.css$/.test(file))
			.map((file) => `@import "./${file.slice("src/styles/".length)}";\n`);
		writeFileSync(
			global,
			readFileSync(global, "utf8").replace(
				'@import "./utilities.css";',
				`${imports.join("")}$&`,
			),
		);
		try {
			await promisify(execFile)(process.execPath, [linter], { cwd: dir });
			return { code: 0, output: "", files };
		} catch (error) {
			const { code, stderr } = error as { code: number; stderr: string };
			return { code, output: stderr, files };
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

test("the repository passes", async () => {
	const { code, output } = await lint();
	assert.equal(code, 0, output);
});

for (const name of globSync("*", {
	cwd: join(import.meta.dirname, "accepted"),
})) {
	test(`accepts ${name}`, async () => {
		const { code, output } = await lint(
			join(import.meta.dirname, "accepted", name),
		);
		assert.equal(code, 0, output);
	});
}

test("every rejected fixture names its message", () => {
	assert.deepEqual(
		globSync("*", { cwd: join(import.meta.dirname, "rejected") }).sort(),
		Object.keys(rejected).sort(),
	);
});

for (const [name, message] of Object.entries(rejected)) {
	test(`rejects ${name}`, async () => {
		const { code, output, files } = await lint(
			join(import.meta.dirname, "rejected", name),
		);
		assert.equal(code, 1, output);
		const lines = output.trim().split("\n");
		// Only the fixture's files fail, and one of them with the message; a
		// message about a whole file names it without a line.
		assert.deepEqual(
			lines.filter((line) =>
				files.every(
					(file) =>
						!line.startsWith(`${file}:`) && !line.startsWith(`${file}  `),
				),
			),
			[],
		);
		assert.ok(
			lines.some((line) => line.includes(message)),
			`expected "${message}" in:\n${output}`,
		);
	});
}
