import { z } from "astro/zod";
import { DomainError } from "./domain.ts";

/**
 * Phase-owned Delivery capture.
 *
 * Recording an invoice requires exactly one explicit Delivery choice:
 * - `url` — one canonical HTTPS delivery PR or MR link.
 * - `none` — the absence of a delivery PR or MR was explicitly confirmed.
 *
 * Legacy phases carry `not_recorded` (schema default) until a choice exists.
 * No provider API, reachability check, or metadata sync is performed.
 */

export const deliveryChoiceSchema = z.enum(["url", "none"]);

export const deliveryUrlSchema = z.preprocess(
	(value) => {
		if (value === null || value === undefined || value === "") {
			return undefined;
		}

		const trimmed = typeof value === "string" ? value.trim() : value;
		return trimmed === "" ? undefined : trimmed;
	},
	z
		.string()
		.max(2048, "The Delivery link must be at most 2048 characters.")
		.refine((value) => {
			let parsed: URL;

			try {
				parsed = new URL(value);
			} catch {
				return false;
			}

			return parsed.protocol === "https:";
		}, "The Delivery link must be an HTTPS URL.")
		.optional(),
);

export const deliveryPairingIssue = (
	value: { deliveryChoice: string; deliveryUrl?: string | undefined },
	ctx: z.RefinementCtx,
) => {
	if (value.deliveryChoice === "url" && !value.deliveryUrl) {
		ctx.addIssue({
			code: "custom",
			path: ["deliveryUrl"],
			message: "A Delivery link is required for this choice.",
		});
	}

	if (value.deliveryChoice === "none" && value.deliveryUrl) {
		ctx.addIssue({
			code: "custom",
			path: ["deliveryUrl"],
			message: "A Delivery link must be empty when no delivery is chosen.",
		});
	}
};

export type DeliveryColumns = {
	deliveryState: "url" | "none";
	deliveryUrl: string | null;
};

export const resolveDelivery = (
	choice: string | undefined,
	url: string | null | undefined,
): DeliveryColumns => {
	if (choice === "none") {
		if (url && url.trim() !== "") {
			throw new DomainError(
				"Validation",
				"A Delivery link cannot be combined with the no-delivery choice.",
			);
		}

		return { deliveryState: "none", deliveryUrl: null };
	}

	if (choice !== "url") {
		throw new DomainError(
			"Validation",
			"Choose a Delivery link or No delivery PR/MR.",
		);
	}

	const trimmed = url?.trim() ?? "";

	if (!trimmed) {
		throw new DomainError("Validation", "A Delivery link is required.");
	}

	let parsed: URL;

	try {
		parsed = new URL(trimmed);
	} catch {
		throw new DomainError(
			"Validation",
			"The Delivery link must be a valid URL.",
		);
	}

	if (parsed.protocol !== "https:") {
		throw new DomainError(
			"Validation",
			"The Delivery link must be an HTTPS URL.",
		);
	}

	return { deliveryState: "url", deliveryUrl: trimmed };
};
