// Public ids are what URLs and people see: a type prefix and a short random
// part from a lowercase alphabet without look-alike characters
// (nanoid-dictionary's `nolookalikesSafe`, lowercase). They are not secrets;
// access is decided by the query that loads the row.
export const publicIdAlphabet = "346789abcdefghjkmnpqrtwxy";

export type PublicIdPrefix = "evt" | "inv" | "phs" | "proj";

export const publicId = (prefix: PublicIdPrefix, length = 6) => {
	// 256 is not a multiple of the alphabet length, so bytes at or above the
	// largest multiple are dropped to keep every character equally likely.
	const limit = 256 - (256 % publicIdAlphabet.length);
	let id = "";

	while (id.length < length) {
		for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
			if (byte < limit && id.length < length) {
				id += publicIdAlphabet[byte % publicIdAlphabet.length];
			}
		}
	}

	return `${prefix}_${id}`;
};
