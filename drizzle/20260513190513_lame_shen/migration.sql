DROP VIEW "invoice";--> statement-breakpoint
DROP VIEW "milestone";--> statement-breakpoint
DROP VIEW "project";--> statement-breakpoint
DROP TABLE "event";--> statement-breakpoint
ALTER TABLE "organization" DROP CONSTRAINT "organization_slug_key";--> statement-breakpoint
DROP INDEX "organization_slug_uidx";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_slug_uidx" UNIQUE("slug");