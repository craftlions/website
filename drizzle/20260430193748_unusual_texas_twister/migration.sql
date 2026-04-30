DROP VIEW "invoice";--> statement-breakpoint
DROP VIEW "milestone";--> statement-breakpoint
DROP VIEW "project";--> statement-breakpoint
DROP TABLE "project_old";--> statement-breakpoint
CREATE VIEW "invoice" AS (
			with invoice_events as (
				select
					"event"."aggregate_id" as aggregate_id,
					"event"."version" as version,
					"event"."recorded_at" as recorded_at,
					"event"."payload" as payload
				from "event"
				where "event"."aggregate_type" = 'invoice'
			),
			latest_change as (
				select distinct on (e.aggregate_id, c.key)
					e.aggregate_id,
					c.key as field,
					c.value ->> 'to' as value
				from invoice_events e
				cross join lateral jsonb_each(
					coalesce(e.payload -> 'changes', '{}'::jsonb)
				) as c(key, value)
				where c.key in (
					'project_id',
					'invoice_number',
					'stripe_id',
					'stripe_payment_page',
					'total'
				)
				and c.value ? 'to'
				order by e.aggregate_id, c.key, e.version desc
			),
			created as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as created_at
				from invoice_events
				order by aggregate_id, version asc
			)
			select
				c.aggregate_id as "id",
				(max(l.value) filter (where l.field = 'project_id'))::uuid as "project_id",
				max(l.value) filter (where l.field = 'invoice_number') as "invoice_number",
				max(l.value) filter (where l.field = 'stripe_id') as "stripe_id",
				max(l.value) filter (where l.field = 'stripe_payment_page') as "stripe_payment_page",
				c.created_at as "created_at",
				(max(l.value) filter (where l.field = 'total'))::numeric as "total"
			from created c
			left join latest_change l
				on l.aggregate_id = c.aggregate_id
			group by c.aggregate_id, c.created_at
		);--> statement-breakpoint
CREATE VIEW "milestone" AS (
			with milestone_events as (
				select
					"event"."aggregate_id" as aggregate_id,
					"event"."version" as version,
					"event"."recorded_at" as recorded_at,
					"event"."payload" as payload
				from "event"
				where "event"."aggregate_type" = 'milestone'
			),
			latest_change as (
				select distinct on (e.aggregate_id, c.key)
					e.aggregate_id,
					c.key as field,
					c.value ->> 'to' as value
				from milestone_events e
				cross join lateral jsonb_each(
					coalesce(e.payload -> 'changes', '{}'::jsonb)
				) as c(key, value)
				where c.key in (
					'project_id',
					'title',
					'cost',
					'currency',
					'state',
					'due_at'
				)
				and c.value ? 'to'
				order by e.aggregate_id, c.key, e.version desc
			),
			created as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as created_at
				from milestone_events
				order by aggregate_id, version asc
			)
			select
				c.aggregate_id as "id",
				(max(l.value) filter (where l.field = 'project_id'))::uuid as "project_id",
				max(l.value) filter (where l.field = 'title') as "title",
				(max(l.value) filter (where l.field = 'cost'))::numeric as "cost",
				max(l.value) filter (where l.field = 'currency') as "currency",
				max(l.value) filter (where l.field = 'state') as "state",
				(max(l.value) filter (where l.field = 'due_at'))::timestamp with time zone as "due_at",
				c.created_at as "created_at"
			from created c
			left join latest_change l
				on l.aggregate_id = c.aggregate_id
			group by c.aggregate_id, c.created_at
		);--> statement-breakpoint
CREATE VIEW "project" AS (
			with project_events as (
				select
					"event"."aggregate_id" as aggregate_id,
					"event"."version" as version,
					"event"."recorded_at" as recorded_at,
					"event"."payload" as payload
				from "event"
				where "event"."aggregate_type" = 'project'
			),
			latest_change as (
				select distinct on (e.aggregate_id, c.key)
					e.aggregate_id,
					c.key as field,
					c.value ->> 'to' as value
				from project_events e
				cross join lateral jsonb_each(
					coalesce(e.payload -> 'changes', '{}'::jsonb)
				) as c(key, value)
				where c.key in (
					'organization_id',
					'name',
					'deadline',
					'state_of_work',
					'state_of_payment'
				)
				and c.value ? 'to'
				order by e.aggregate_id, c.key, e.version desc
			),
			created as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as created_at
				from project_events
				order by aggregate_id, version asc
			),
			updated as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as updated_at
				from project_events
				order by aggregate_id, version desc
			)
			select
				c.aggregate_id as "id",
				max(l.value) filter (where l.field = 'organization_id') as "organization_id",
				max(l.value) filter (where l.field = 'name') as "name",
				(max(l.value) filter (where l.field = 'deadline'))::timestamp with time zone as "deadline",
				max(l.value) filter (where l.field = 'state_of_work') as "state_of_work",
				max(l.value) filter (where l.field = 'state_of_payment') as "state_of_payment",
				c.created_at as "created_at",
				u.updated_at as "updated_at"
			from created c
			inner join updated u
				on u.aggregate_id = c.aggregate_id
			left join latest_change l
				on l.aggregate_id = c.aggregate_id
			group by c.aggregate_id, c.created_at, u.updated_at
		);