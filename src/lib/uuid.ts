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
