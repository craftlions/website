ALTER TABLE "projects" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "updated_at" DROP NOT NULL;