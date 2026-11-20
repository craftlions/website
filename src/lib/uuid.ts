const UUID_V7_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getUuidV7Date = (uuid: string) => {
	if (!UUID_V7_PATTERN.test(uuid)) {
		return null;
	}

	return new Date(
		Number.parseInt(`${uuid.slice(0, 8)}${uuid.slice(9, 13)}`, 16),
	);
};

// A uuidv7 made here, for a row whose id something else holds before the row
// exists (a drive object's key). The time is the creation time, as the
// database's uuidv7() would set it.
export const uuidV7 = () => {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const time = Date.now();

	for (let index = 0; index < 6; index++) {
		bytes[index] = Math.floor(time / 2 ** (8 * (5 - index))) % 256;
	}

	bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
	bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);

	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
