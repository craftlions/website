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
