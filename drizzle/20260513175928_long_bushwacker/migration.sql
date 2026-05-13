CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"public_id" text NOT NULL,
	"aggregate_type" "aggregate_type" NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL
);
