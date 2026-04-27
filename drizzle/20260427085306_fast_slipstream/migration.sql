CREATE INDEX "member_organizationId_idx" ON "member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_metadata_organizationId_uidx" ON "organization_metadata" ("organization_id");--> statement-breakpoint
CREATE INDEX "project_organizationId_idx" ON "project" ("organization_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");