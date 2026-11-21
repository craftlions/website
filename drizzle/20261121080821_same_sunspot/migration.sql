CREATE TABLE "files" (
	"id" uuid PRIMARY KEY,
	"public_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
DROP TABLE "apikey";--> statement-breakpoint
CREATE UNIQUE INDEX "files_public_id_index" ON "files" ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_r2_key_index" ON "files" ("r2_key");--> statement-breakpoint
CREATE INDEX "files_organization_id_filename_idx" ON "files" ("organization_id","filename");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;