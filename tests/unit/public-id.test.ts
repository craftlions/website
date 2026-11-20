// publicId makes the prefixed ids that URLs show: the prefix, an underscore
// and six random characters from the look-alike-free alphabet.
import assert from "node:assert/strict";
import { test } from "node:test";
import { publicId, publicIdAlphabet } from "../../src/lib/public-id.ts";

test("puts the prefix before six characters", () => {
	assert.match(publicId("proj"), /^proj_[346789abcdefghjkmnpqrtwxy]{6}$/);
});

test("uses only the alphabet and reaches all of it", () => {
	const seen = new Set(
		Array.from({ length: 2000 }, () => publicId("inv").slice(4)).join(""),
	);

	assert.deepEqual([...seen].sort(), publicIdAlphabet.split("").sort());
});
