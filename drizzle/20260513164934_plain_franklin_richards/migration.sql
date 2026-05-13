CREATE TYPE "milestone_event_type" AS ENUM('created', 'updated', 'deleted');--> statement-breakpoint
CREATE TYPE "milestone_state" AS ENUM('submitted', 'planned', 'approved', 'in_progress', 'invoiced', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "milestone_revisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"milestone_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"event_type" "milestone_event_type" NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"cost" numeric(19,4) NOT NULL,
	"currency" char(3) NOT NULL,
	"state" "milestone_state" NOT NULL,
	"due_at" timestamp with time zone,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "milestone_revisions_milestone_id_version_unique" UNIQUE("milestone_id","version")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_revisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "project_revisions_project_id_version_unique" UNIQUE("project_id","version")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"public_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
CREATE UNIQUE INDEX "milestones_public_id_index" ON "milestones" ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_public_id_index" ON "projects" ("public_id");--> statement-breakpoint
ALTER TABLE "milestone_revisions" ADD CONSTRAINT "milestone_revisions_milestone_id_milestones_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "milestone_revisions" ADD CONSTRAINT "milestone_revisions_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD CONSTRAINT "project_revisions_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;