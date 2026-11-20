// The drive: every client's files in one private R2 bucket (`DRIVE`). The
// bucket has no public URL; the Worker is its only door. A request reaches an
// object only through a `files` row that the caller's query found, so which
// files someone sees is decided by that query, never by the key or a URL.
//
// - Keys are `org/<organization id>/<file id>`, made by the server, so a
//   filename never becomes a path and an organization's objects share a
//   prefix for housekeeping.
// - Uploads are multipart through the binding, in parts of `partSize`, so a
//   file of any size passes under the Worker's request body limit.
// - Downloads stream the object with its range and conditional headers. Only
//   types a browser shows without running code open inline; everything else
//   downloads, and a sandbox policy keeps a file from acting as a page.

import { formatDate } from "./format.ts";
import { getUuidV7Date } from "./uuid.ts";

// R2 needs every part but the last to be the same size, of at least 5 MiB.
export const partSize = 16 * 1024 * 1024;

const uuidPattern =
	"[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export const fileKey = (organizationId: string, fileId: string) =>
	`org/${organizationId}/${fileId}`;

// The file id a key names, when the key is this organization's.
export const fileIdFromKey = (organizationId: string, key: string) => {
	const prefix = `org/${organizationId}/`;
	const id = key.startsWith(prefix) ? key.slice(prefix.length) : "";

	return new RegExp(`^${uuidPattern}$`).test(id) ? id : null;
};

// Types a browser renders as media, with no script and no markup of their own.
// SVG and HTML are markup, so they download.
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

// The name as typed in the header, plus an ASCII copy for old clients:
// quotes, backslashes and anything outside printable ASCII become `_`.
export const contentDisposition = (filename: string, contentType: string) => {
	const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
	const encoded = encodeURIComponent(filename).replace(
		/['()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);

	return `${opensInline(contentType) ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

// A file's name as it may be stored: no path, no control characters, at most
// 255 characters. Null when nothing is left.
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

// What kind of file it is, in a few letters: the extension, else the subtype
// in words people use.
const subtypeKinds: Record<string, string> = {
	"octet-stream": "file",
	plain: "text",
};

export const fileKind = (filename: string, contentType: string) => {
	const extension = filename.includes(".")
		? filename.split(".").at(-1)
		: undefined;
	const subtype = contentType.split("/")[1]?.split(/[;+]/)[0]?.trim() ?? "file";

	return (
		extension && extension.length <= 5
			? extension
			: (subtypeKinds[subtype] ?? subtype)
	).toUpperCase();
};

// "2.4 MB · uploaded 10.11.2026": the facts a file card shows below the name.
export const fileFacts = (file: { id: string; size: number }) => {
	const uploaded = getUuidV7Date(file.id);

	return [
		formatBytes(file.size),
		uploaded ? `uploaded ${formatDate(uploaded)}` : undefined,
	]
		.filter(Boolean)
		.join(" · ");
};

// Streams a file the caller's query already found. Range requests answer 206
// so video seeks and large PDFs load in pieces; a matching If-None-Match
// answers 304.
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
	} catch {
		// R2 rejects a range outside the object.
		return new Response(null, { status: 416 });
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

	// Chromium's PDF viewer does not open in a sandboxed document or under
	// `object-src 'none'`, so a PDF keeps only who may frame it; a PDF runs no
	// script of the page's origin.
	headers.set(
		"Content-Security-Policy",
		file.contentType === "application/pdf"
			? "frame-ancestors 'self'"
			: "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",
	);

	if (!("body" in object)) {
		return new Response(null, { status: 304, headers });
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
