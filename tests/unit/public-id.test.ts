import assert from "node:assert/strict";
import { test } from "node:test";
import { publicId, publicIdAlphabet } from "../../src/lib/public-id.ts";

test("puts the prefix before six characters", () => {
	assert.match(publicId("proj"), /^proj_[346789abcdefghjkmnpqrtwxy]{6}$/);
});

test("makes the random part as long as asked", () => {
	assert.match(publicId("file", 12), /^file_[346789abcdefghjkmnpqrtwxy]{12}$/);
});

test("uses only the alphabet and reaches all of it", () => {
	const seen = new Set(
		Array.from({ length: 2000 }, () => publicId("inv").slice(4)).join(""),
	);

	assert.deepEqual([...seen].sort(), publicIdAlphabet.split("").sort());
});
