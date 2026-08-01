const PORTAL_PREFIXES = ["/dash", "/settings"];
const FALLBACK = "/dash";

export function parseReturnTo(candidate: unknown): string {
	if (typeof candidate !== "string" || candidate.length === 0) {
		return FALLBACK;
	}

	let url: URL;
	try {
		url = new URL(candidate, "https://placeholder.invalid");
	} catch {
		return FALLBACK;
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return FALLBACK;
	}

	if (url.hostname !== "placeholder.invalid" && url.hostname !== "localhost") {
		return FALLBACK;
	}

	const hasPortalPrefix = PORTAL_PREFIXES.some(
		(prefix) =>
			url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
	);
	if (!hasPortalPrefix) {
		return FALLBACK;
	}

	const serialized = url.pathname + url.search + (url.hash ?? "");
	const normalized = serialized.length === 0 ? FALLBACK : serialized;

	return normalized;
}
