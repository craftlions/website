DROP VIEW "invoice";--> statement-breakpoint
DROP VIEW "milestone";--> statement-breakpoint
CREATE VIEW "invoice" AS (
		select
			"event"."aggregate_id" as "id",
			(array_agg("event"."payload"#>>'{changes,project_id,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,project_id}', 'to')))[1]::uuid as "project_id",
			(array_agg("event"."payload"#>>'{changes,invoice_number,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,invoice_number}', 'to')))[1] as "invoice_number",
			(array_agg("event"."payload"#>>'{changes,stripe_id,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,stripe_id}', 'to')))[1] as "stripe_id",
			(array_agg("event"."payload"#>>'{changes,stripe_payment_page,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,stripe_payment_page}', 'to')))[1] as "stripe_payment_page",
			(array_agg("event"."recorded_at" order by "event"."version" asc))[1] as "created_at",
			((array_agg("event"."payload"#>>'{changes,total,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,total}', 'to')))[1])::numeric as "total"
		from "event"
		where "event"."aggregate_type" = 'invoice'
		group by "event"."aggregate_id"
	);--> statement-breakpoint
CREATE VIEW "milestone" AS (
		select
			"event"."aggregate_id" as "id",
			(array_agg("event"."payload"#>>'{changes,project_id,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,project_id}', 'to')))[1]::uuid as "project_id",
			(array_agg("event"."payload"#>>'{changes,title,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,title}', 'to')))[1] as "title",
			((array_agg("event"."payload"#>>'{changes,cost,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,cost}', 'to')))[1])::numeric as "cost",
			(array_agg("event"."payload"#>>'{changes,currency,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,currency}', 'to')))[1] as "currency",
			(array_agg("event"."payload"#>>'{changes,state,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,state}', 'to')))[1] as "state",
			((array_agg("event"."payload"#>>'{changes,due_at,to}' order by "event"."version" desc) filter (where jsonb_exists("event"."payload"#>'{changes,due_at}', 'to')))[1])::timestamp with time zone as "due_at",
			(array_agg("event"."recorded_at" order by "event"."version" asc))[1] as "created_at"
		from "event"
		where "event"."aggregate_type" = 'milestone'
		group by "event"."aggregate_id"
	);