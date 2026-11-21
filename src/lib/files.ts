import { formatDate } from "./format.ts";
import { getUuidV7Date } from "./uuid.ts";

export const partSize = 16 * 1024 * 1024;
export const maxParts = 10_000;
export const maxFileSize = partSize * maxParts;

const uuidPattern =
	"[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export const fileKey = (organizationId: string, fileId: string) =>
	`org/${organizationId}/${fileId}`;

export const fileIdFromKey = (organizationId: string, key: string) => {
	const prefix = `org/${organizationId}/`;
	const id = key.startsWith(prefix) ? key.slice(prefix.length) : "";

	return new RegExp(`^${uuidPattern}$`).test(id) ? id : null;
};

const inlineTypes = new Set([
	"application/pdf",
	"audio/mpeg",
	"audio/ogg",
	"audio/wav",
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/webp",
	"text/plain",
	"video/mp4",
	"video/webm",
]);

export const opensInline = (contentType: string) =>
	inlineTypes.has(contentType.split(";")[0]?.trim().toLowerCase() ?? "");

export const contentDisposition = (filename: string, contentType: string) => {
	const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
	const encoded = encodeURIComponent(filename).replace(
		/['()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);

	return `${opensInline(contentType) ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

export const cleanFilename = (filename: string) => {
	const name = (filename.split(/[/\\]/).at(-1) ?? "")
		.replace(/\p{Cc}/gu, "")
		.trim()
		.slice(0, 255);

	return name && name !== "." && name !== ".." ? name : null;
};

const byteFormatter = new Intl.NumberFormat("en", {
	maximumFractionDigits: 1,
});

export const formatBytes = (bytes: number) => {
	const units = ["B", "KB", "MB", "GB", "TB"];
	const exponent = Math.min(
		Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1000)),
		units.length - 1,
	);

	return `${byteFormatter.format(bytes / 1000 ** exponent)} ${units[exponent]}`;
};

const subtypeKinds = new Map([
	["octet-stream", "file"],
	["plain", "text"],
]);

export const fileKind = (filename: string, contentType: string) => {
	const extension = filename.includes(".")
		? filename.split(".").at(-1)
		: undefined;
	const subtype = contentType.split("/")[1]?.split(/[;+]/)[0]?.trim() ?? "file";

	return (
		extension && extension.length <= 5
			? extension
			: (subtypeKinds.get(subtype) ?? subtype)
	).toUpperCase();
};

export const fileFacts = (file: { id: string; size: number }) => {
	const uploaded = getUuidV7Date(file.id);

	return [
		formatBytes(file.size),
		uploaded ? `uploaded ${formatDate(uploaded)}` : undefined,
	]
		.filter(Boolean)
		.join(" · ");
};

const preconditionFailed = (object: R2Object, headers: Headers) => {
	const ifMatch = headers.get("If-Match");

	if (ifMatch) {
		return (
			ifMatch.trim() !== "*" &&
			ifMatch.split(",").every((tag) => tag.trim() !== object.httpEtag)
		);
	}

	const ifUnmodifiedSince = Date.parse(
		headers.get("If-Unmodified-Since") ?? "",
	);

	return (
		!Number.isNaN(ifUnmodifiedSince) &&
		Math.floor(object.uploaded.getTime() / 1000) * 1000 > ifUnmodifiedSince
	);
};

export const serveFile = async (
	bucket: R2Bucket,
	file: { r2Key: string; filename: string; contentType: string },
	request: Request,
) => {
	let object: R2Object | R2ObjectBody | null;

	try {
		object = await bucket.get(file.r2Key, {
			range: request.headers,
			onlyIf: request.headers,
		});
	} catch (error) {
		if (error instanceof Error && error.message.endsWith("(10039)")) {
			return new Response(null, { status: 416 });
		}

		throw error;
	}

	if (!object) {
		return new Response("Not found", { status: 404 });
	}

	const headers = new Headers({
		"Accept-Ranges": "bytes",
		"Content-Disposition": contentDisposition(file.filename, file.contentType),
		"Content-Type": file.contentType,
		ETag: object.httpEtag,
		"X-Content-Type-Options": "nosniff",
	});

	headers.set(
		"Content-Security-Policy",
		file.contentType === "application/pdf"
			? "frame-ancestors 'self'"
			: "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",
	);

	if (!("body" in object)) {
		return preconditionFailed(object, request.headers)
			? new Response(null, { status: 412 })
			: new Response(null, { status: 304, headers });
	}

	const range = object.range;

	if (range && request.headers.has("Range")) {
		const offset =
			"suffix" in range ? object.size - range.suffix : (range.offset ?? 0);
		const length =
			"length" in range && range.length !== undefined
				? range.length
				: object.size - offset;

		headers.set(
			"Content-Range",
			`bytes ${offset}-${offset + length - 1}/${object.size}`,
		);
		headers.set("Content-Length", String(length));

		return new Response(object.body, { status: 206, headers });
	}

	headers.set("Content-Length", String(object.size));

	return new Response(object.body, { headers });
};
