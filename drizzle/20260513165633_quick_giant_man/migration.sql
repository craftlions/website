CREATE TYPE "project_event_type" AS ENUM('created', 'updated', 'deleted');--> statement-breakpoint
CREATE TYPE "project_state" AS ENUM('draft', 'active', 'completed', 'archived');--> statement-breakpoint
ALTER TABLE "project_revisions" ADD COLUMN "event_type" "project_event_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD COLUMN "state" "project_state";--> statement-breakpoint
ALTER TABLE "project_revisions" ADD CONSTRAINT "project_revisions_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;