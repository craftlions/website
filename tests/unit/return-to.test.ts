import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReturnTo } from "../../src/lib/return-to.ts";

test("keeps a portal path with its query and fragment", () => {
	for (const path of [
		"/dash",
		"/dash/",
		"/dash/org/acme/invoices?x=1#invoices",
		"/settings",
		"/settings/security",
	]) {
		assert.equal(parseReturnTo(path), path);
	}
});

test("falls back to /dash for anything else", () => {
	for (const candidate of [
		undefined,
		null,
		42,
		"",
		"/",
		"/login",
		"/dashboard",
		"/settingsx",
		"/admin",
		"https://example.com/dash",
		"//example.com/dash",
		"/\\example.com/dash",
		"\\\\example.com/dash",
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"https://placeholder.invalid.example.com/dash",
	]) {
		assert.equal(parseReturnTo(candidate), "/dash", String(candidate));
	}
});

test("resolves dot segments before it checks the prefix", () => {
	assert.equal(parseReturnTo("/dash/../admin"), "/dash");
	assert.equal(parseReturnTo("/dash/%2e%2e/admin"), "/dash");
	assert.equal(parseReturnTo("/admin/../dash/org"), "/dash/org");
});
