ALTER TABLE "apikey" ADD CONSTRAINT "apikey_key_unique" UNIQUE("key");--> statement-breakpoint
CREATE INDEX "apikey_reference_id_index" ON "apikey" ("reference_id");