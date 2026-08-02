ALTER TABLE "invoices" ADD COLUMN "invoiced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "invoices" SET "invoiced_at" = to_timestamp((('x' || substr(replace("id"::text, '-', ''), 1, 12)))::bit(48)::bigint / 1000.0);
