ALTER TABLE "project" RENAME TO "project_old";--> statement-breakpoint
CREATE VIEW "project" AS (
		select
			"event"."aggregate_id" as "id",
			(array_agg("event"."payload"#>>'{changes,organization_id,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,organization_id}', 'to')))[1] as "organization_id",
			(array_agg("event"."payload"#>>'{changes,name,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,name}', 'to')))[1] as "name",
			((array_agg("event"."payload"#>>'{changes,deadline,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,deadline}', 'to')))[1])::timestamp with time zone as "deadline",
			(array_agg("event"."payload"#>>'{changes,state_of_work,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,state_of_work}', 'to')))[1] as "state_of_work",
			(array_agg("event"."payload"#>>'{changes,state_of_payment,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,state_of_payment}', 'to')))[1] as "state_of_payment",
			((array_agg("event"."payload"#>>'{changes,budget,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,budget}', 'to')))[1])::numeric as "budget",
			(array_agg("event"."recorded_at" order by "event"."version" asc))[1] as "created_at",
			(array_agg("event"."recorded_at" order by "event"."version" desc))[1] as "updated_at"
		from "event"
		where "event"."aggregate_type" = 'project'
		group by "event"."aggregate_id"
	);