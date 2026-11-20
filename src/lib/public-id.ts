import { customAlphabet } from "nanoid";

// Public ids are what URLs and people see: a type prefix and six random
// characters from a lowercase alphabet without look-alike characters
// (nanoid-dictionary's `nolookalikesSafe`, lowercase). They are not secrets;
// access is decided by the query that loads the row.
export const publicIdAlphabet = "346789abcdefghjkmnpqrtwxy";

export type PublicIdPrefix = "evt" | "inv" | "phs" | "proj";

const randomPart = customAlphabet(publicIdAlphabet, 6);

export const publicId = (prefix: PublicIdPrefix) => `${prefix}_${randomPart()}`;
