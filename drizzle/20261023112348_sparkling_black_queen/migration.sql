ALTER TABLE "apikey" ALTER COLUMN "config_id" SET DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "enabled" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "rate_limit_enabled" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "rate_limit_time_window" SET DEFAULT 86400000;--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "rate_limit_max" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "request_count" SET DEFAULT 0;--> statement-breakpoint
CREATE INDEX "apikey_config_id_index" ON "apikey" ("config_id");