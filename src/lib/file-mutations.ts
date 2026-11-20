// What the admin does to the drive: upload a file in parts, delete a file.
// Clients only read; see serveFile in files.ts.
import type { Db } from "./database.ts";
import { and, eq, inArray, ne } from "drizzle-orm";
import { assertAdminUser, DomainError } from "./domain.ts";
import { cleanFilename, fileIdFromKey, fileKey, partSize } from "./files.ts";
import { publicId } from "./public-id.ts";
import { files } from "./schema.ts";
import { uuidV7 } from "./uuid.ts";

const contentTypePattern = /^[\w.+-]+\/[\w.+-]+$/;

const cleanContentType = (contentType: string) => {
	const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

	return contentTypePattern.test(type) ? type : "application/octet-stream";
};

// The key comes back from the browser between the steps of an upload, so each
// step checks it names a file of this organization.
const uploadOf = (
	bucket: R2Bucket,
	input: { organizationId: string; key: string; uploadId: string },
) => {
	const fileId = fileIdFromKey(input.organizationId, input.key);

	if (!fileId) {
		throw new DomainError("Validation", "This upload is not for this client.");
	}

	return {
		fileId,
		upload: bucket.resumeMultipartUpload(input.key, input.uploadId),
	};
};

export const startUpload = async (
	db: Db,
	bucket: R2Bucket,
	actorId: string,
	input: { organizationId: string; filename: string; contentType: string },
) => {
	const [, organization] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.organization.findFirst({
			columns: { id: true },
			where: { id: input.organizationId },
		}),
	]);

	if (!organization) {
		throw new DomainError("NotFound", "Organization not found.");
	}

	if (!cleanFilename(input.filename)) {
		throw new DomainError("Validation", "The file needs a name.");
	}

	const upload = await bucket.createMultipartUpload(
		fileKey(organization.id, uuidV7()),
		{ httpMetadata: { contentType: cleanContentType(input.contentType) } },
	);

	return { key: upload.key, uploadId: upload.uploadId, partSize };
};

export const uploadPart = async (
	db: Db,
	bucket: R2Bucket,
	actorId: string,
	input: {
		organizationId: string;
		key: string;
		uploadId: string;
		partNumber: number;
		body: ReadableStream;
	},
) => {
	await assertAdminUser(db, actorId);

	if (
		!Number.isInteger(input.partNumber) ||
		input.partNumber < 1 ||
		input.partNumber > 10000
	) {
		throw new DomainError("Validation", "Part numbers run from 1 to 10000.");
	}

	return uploadOf(bucket, input).upload.uploadPart(
		input.partNumber,
		input.body,
	);
};

// Completes the object, then records it. With `replace`, the files of this
// client with the same name go once the new one is recorded, so a failed
// upload never loses the file it was meant to replace.
export const completeUpload = async (
	db: Db,
	bucket: R2Bucket,
	actorId: string,
	input: {
		organizationId: string;
		key: string;
		uploadId: string;
		parts: R2UploadedPart[];
		filename: string;
		contentType: string;
		replace: boolean;
	},
) => {
	await assertAdminUser(db, actorId);

	const filename = cleanFilename(input.filename);

	if (!filename) {
		throw new DomainError("Validation", "The file needs a name.");
	}

	const { fileId, upload } = uploadOf(bucket, input);
	const object = await upload.complete(input.parts);

	const replaced = await db.transaction(async (tx) => {
		const [file] = await tx
			.insert(files)
			.values({
				id: fileId,
				publicId: publicId("file", 12),
				organizationId: input.organizationId,
				r2Key: object.key,
				filename,
				contentType: cleanContentType(input.contentType),
				size: object.size,
				uploadedBy: actorId,
			})
			.returning({ publicId: files.publicId });

		if (!file) {
			throw new DomainError("Validation", "The file could not be recorded.");
		}

		if (!input.replace) {
			return [];
		}

		const sameName = await tx
			.select({ id: files.id, r2Key: files.r2Key })
			.from(files)
			.where(
				and(
					eq(files.organizationId, input.organizationId),
					eq(files.filename, filename),
					ne(files.id, fileId),
				),
			);

		if (sameName.length > 0) {
			await tx.delete(files).where(
				inArray(
					files.id,
					sameName.map((row) => row.id),
				),
			);
		}

		return sameName.map((row) => row.r2Key);
	});

	if (replaced.length > 0) {
		await bucket.delete(replaced);
	}

	return { filename, replaced: replaced.length };
};

export const abortUpload = async (
	db: Db,
	bucket: R2Bucket,
	actorId: string,
	input: { organizationId: string; key: string; uploadId: string },
) => {
	await assertAdminUser(db, actorId);
	await uploadOf(bucket, input).upload.abort();
};

// The row goes first, so no client is ever shown a file whose object is gone.
export const deleteFile = async (
	db: Db,
	bucket: R2Bucket,
	actorId: string,
	input: { organizationId: string; filePublicId: string },
) => {
	await assertAdminUser(db, actorId);

	const [file] = await db
		.delete(files)
		.where(
			and(
				eq(files.organizationId, input.organizationId),
				eq(files.publicId, input.filePublicId),
			),
		)
		.returning({ filename: files.filename, r2Key: files.r2Key });

	if (!file) {
		throw new DomainError("NotFound", "File not found.");
	}

	await bucket.delete(file.r2Key);

	return { filename: file.filename };
};
