const UUID_V7_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getUuidV7Timestamp = (uuid: string) => {
	if (!UUID_V7_PATTERN.test(uuid)) {
		return null;
	}

	return Number.parseInt(`${uuid.slice(0, 8)}${uuid.slice(9, 13)}`, 16);
};

export const getUuidV7Date = (uuid: string) => {
	const timestamp = getUuidV7Timestamp(uuid);

	return timestamp === null ? null : new Date(timestamp);
};

export const uuidV7FromDate = (date: Date) => {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	let timestamp = date.getTime();

	for (let index = 5; index >= 0; index -= 1) {
		bytes[index] = timestamp % 256;
		timestamp = Math.floor(timestamp / 256);
	}

	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
