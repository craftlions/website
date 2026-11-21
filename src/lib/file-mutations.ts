import type { Db } from "./database.ts";
import { and, eq, inArray, ne } from "drizzle-orm";
import { assertAdminUser, DomainError } from "./domain.ts";
import {
	cleanFilename,
	fileIdFromKey,
	fileKey,
	maxParts,
	partSize,
} from "./files.ts";
import { publicId } from "./public-id.ts";
import { files } from "./schema.ts";
import { uuidV7 } from "./uuid.ts";

const contentTypePattern = /^[\w.+-]+\/[\w.+-]+$/;

const cleanContentType = (contentType: string) => {
	const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

	return contentTypePattern.test(type) ? type : "application/octet-stream";
};

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
		size: number;
		body: ReadableStream;
	},
) => {
	await assertAdminUser(db, actorId);

	if (
		!Number.isInteger(input.partNumber) ||
		input.partNumber < 1 ||
		input.partNumber > maxParts
	) {
		throw new DomainError(
			"Validation",
			`Part numbers run from 1 to ${maxParts}.`,
		);
	}

	if (
		!Number.isInteger(input.size) ||
		input.size < 0 ||
		input.size > partSize
	) {
		throw new DomainError(
			"Validation",
			`Send each part with a Content-Length of at most ${partSize} bytes.`,
		);
	}

	return uploadOf(bucket, input).upload.uploadPart(
		input.partNumber,
		input.body,
	);
};

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

	try {
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
				return 0;
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
				await bucket.delete(sameName.map((row) => row.r2Key));
			}

			return sameName.length;
		});

		return { filename, replaced };
	} catch (error) {
		await bucket.delete(object.key).catch(() => {
			console.error("Deleting an unrecorded upload failed", object.key);
		});
		throw error;
	}
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

export const deleteFile = async (
	db: Db,
	bucket: R2Bucket,
	actorId: string,
	input: { organizationId: string; filePublicId: string },
) => {
	await assertAdminUser(db, actorId);

	return db.transaction(async (tx) => {
		const [file] = await tx
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
	});
};
