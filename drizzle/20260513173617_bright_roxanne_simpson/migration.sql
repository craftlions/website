DROP TABLE "project_revisions";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "state" "project_state";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "actor_type" "actor_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "actor_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
DROP TYPE "project_event_type";