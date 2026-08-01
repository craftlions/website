CREATE TYPE "notification_intent_state" AS ENUM('pending', 'dispatching', 'dispatched');--> statement-breakpoint
ALTER TABLE "notification_intent" ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notification_intent" ALTER COLUMN "state" SET DATA TYPE "notification_intent_state" USING "state"::"notification_intent_state";--> statement-breakpoint
ALTER TABLE "notification_intent" ALTER COLUMN "state" SET DEFAULT 'pending'::"notification_intent_state";--> statement-breakpoint
CREATE UNIQUE INDEX "notification_intent_kind_aggregate_uidx" ON "notification_intent" ("kind","aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_stage_result_intent_stage_uidx" ON "notification_stage_result" ("intent_id","stage");