import { customAlphabet } from "nanoid";

export const publicIdAlphabet = "346789abcdefghjkmnpqrtwxy";

export type PublicIdPrefix = "evt" | "file" | "inv" | "phs" | "proj";

const randomPart = customAlphabet(publicIdAlphabet);

export const publicId = (prefix: PublicIdPrefix, length = 6) =>
	`${prefix}_${randomPart(length)}`;
