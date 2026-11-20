// The drive's pure helpers: which keys belong to an organization, which files
// open in the browser, the download header, stored names and the card facts.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	cleanFilename,
	contentDisposition,
	fileIdFromKey,
	fileKey,
	fileKind,
	formatBytes,
	opensInline,
} from "../../src/lib/files.ts";
import { getUuidV7Date, uuidV7 } from "../../src/lib/uuid.ts";

const fileId = "019a6b2c-1d00-7000-8000-000000000001";

test("a key names its organization and file", () => {
	assert.equal(fileKey("org1", fileId), `org/org1/${fileId}`);
	assert.equal(fileIdFromKey("org1", fileKey("org1", fileId)), fileId);
});

test("a key of another organization or shape names no file", () => {
	for (const key of [
		fileKey("org2", fileId),
		`org/org1/../org2/${fileId}`,
		`org/org1/${fileId}/x`,
		"org/org1/not-a-uuid",
		`org/org10/${fileId}`,
		fileId,
	]) {
		assert.equal(fileIdFromKey("org1", key), null, key);
	}
});

test("media opens inline, markup and the rest download", () => {
	for (const type of [
		"application/pdf",
		"image/png",
		"video/mp4",
		"text/plain; charset=utf-8",
	]) {
		assert.equal(opensInline(type), true, type);
	}

	for (const type of [
		"image/svg+xml",
		"text/html",
		"application/zip",
		"application/octet-stream",
		"",
	]) {
		assert.equal(opensInline(type), false, type);
	}
});

test("the header carries the name as typed and an ASCII copy", () => {
	assert.equal(
		contentDisposition('Größe "final".pdf', "application/pdf"),
		`inline; filename="Gr__e _final_.pdf"; filename*=UTF-8''Gr%C3%B6%C3%9Fe%20%22final%22.pdf`,
	);
	assert.match(contentDisposition("page.html", "text/html"), /^attachment; /);
});

test("a stored name has no path and no control characters", () => {
	assert.equal(cleanFilename("C:\\Users\\a\\report.pdf"), "report.pdf");
	assert.equal(cleanFilename("../../etc/passwd"), "passwd");
	assert.equal(cleanFilename(" a\u0000b.txt "), "ab.txt");
	assert.equal(cleanFilename("x".repeat(300))?.length, 255);

	for (const name of ["", "  ", "..", "folder/"]) {
		assert.equal(cleanFilename(name), null, name);
	}
});

test("sizes read in decimal units", () => {
	assert.equal(formatBytes(0), "0 B");
	assert.equal(formatBytes(1_071), "1.1 KB");
	assert.equal(formatBytes(48_300_000), "48.3 MB");
	assert.equal(formatBytes(1_830_000_000), "1.8 GB");
});

test("the kind is the extension, else the subtype", () => {
	assert.equal(fileKind("Statement.pdf", "application/pdf"), "PDF");
	assert.equal(fileKind("LICENSE", "text/plain"), "TEXT");
	assert.equal(fileKind("data", "application/octet-stream"), "FILE");
	assert.equal(fileKind("archive.backup-2026", "application/zip"), "ZIP");
});

test("a made uuidv7 carries the time it was made", () => {
	const before = Date.now();
	const id = uuidV7();

	assert.match(
		id,
		/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
	assert.ok(Math.abs((getUuidV7Date(id)?.getTime() ?? 0) - before) < 1000);
});
