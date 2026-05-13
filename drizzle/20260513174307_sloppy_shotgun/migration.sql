DROP TABLE "milestone_revisions";--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "cost" numeric(19,4) NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "currency" char(3) NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "state" "milestone_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "actor_type" "actor_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "actor_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
DROP TYPE "milestone_event_type";