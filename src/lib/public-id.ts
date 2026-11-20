import { customAlphabet } from "nanoid";

// Public ids are what URLs and people see: a type prefix and random
// characters, six unless a table needs more, from a lowercase alphabet without look-alike characters
// (nanoid-dictionary's `nolookalikesSafe`, lowercase). They are not secrets;
// access is decided by the query that loads the row.
export const publicIdAlphabet = "346789abcdefghjkmnpqrtwxy";

export type PublicIdPrefix = "evt" | "file" | "inv" | "phs" | "proj";

const randomPart = customAlphabet(publicIdAlphabet);

export const publicId = (prefix: PublicIdPrefix, length = 6) =>
	`${prefix}_${randomPart(length)}`;
