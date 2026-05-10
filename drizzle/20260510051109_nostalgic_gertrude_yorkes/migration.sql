ALTER TABLE "apikey" DROP CONSTRAINT "apikey_id_key";--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_key_unique" UNIQUE("key");--> statement-breakpoint
CREATE INDEX "apikey_reference_id_index" ON "apikey" ("reference_id");