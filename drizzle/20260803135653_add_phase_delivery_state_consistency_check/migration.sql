ALTER TABLE "phases" ADD CONSTRAINT "phases_delivery_state_consistency" CHECK ((
				("delivery_state" = 'url' AND "delivery_url" IS NOT NULL)
				OR ("delivery_state" = 'none' AND "delivery_url" IS NULL)
				OR ("delivery_state" = 'not_recorded' AND "delivery_url" IS NULL)
			));