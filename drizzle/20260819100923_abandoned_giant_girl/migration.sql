ALTER TABLE "phases" ADD COLUMN "upfront_amount" numeric(19,4);--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "delivery_amount" numeric(19,4);--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "acceptance_amount" numeric(19,4);--> statement-breakpoint
UPDATE "phases"
SET "acceptance_amount" = "cost"
WHERE "upfront_amount" IS NULL
	AND "delivery_amount" IS NULL
	AND "acceptance_amount" IS NULL;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_cost_components_consistency" CHECK ((
				("upfront_amount" IS NOT NULL
					OR "delivery_amount" IS NOT NULL
					OR "acceptance_amount" IS NOT NULL)
				AND coalesce("upfront_amount", 0)
					+ coalesce("delivery_amount", 0)
					+ coalesce("acceptance_amount", 0) = "cost"
			));
