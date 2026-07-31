ALTER TABLE "events" ADD COLUMN "aggregate_version" integer;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "events_aggregate_type_id_version_uidx" ON "events" ("aggregate_type","aggregate_id","aggregate_version");