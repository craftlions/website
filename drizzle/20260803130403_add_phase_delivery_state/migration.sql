CREATE TYPE "phase_delivery_state" AS ENUM('url', 'none', 'not_recorded');--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "delivery_state" "phase_delivery_state" DEFAULT 'not_recorded'::"phase_delivery_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "delivery_url" text;