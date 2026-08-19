ALTER TABLE "phases" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
UPDATE "phases" SET "state" = 'accepted' WHERE "state" IN ('invoiced', 'paid');--> statement-breakpoint
DROP TYPE "phase_state";--> statement-breakpoint
CREATE TYPE "phase_state" AS ENUM('submitted', 'planned', 'approved', 'in_progress', 'delivered', 'accepted', 'cancelled');--> statement-breakpoint
ALTER TABLE "phases" ALTER COLUMN "state" SET DATA TYPE "phase_state" USING "state"::"phase_state";