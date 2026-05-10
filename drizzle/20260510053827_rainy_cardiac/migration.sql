DROP VIEW "project";--> statement-breakpoint
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
					'state'
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
				max(l.value) filter (where l.field = 'state') as "state",
				c.created_at as "created_at",
				u.updated_at as "updated_at"
			from created c
			inner join updated u
				on u.aggregate_id = c.aggregate_id
			left join latest_change l
				on l.aggregate_id = c.aggregate_id
			group by c.aggregate_id, c.created_at, u.updated_at
		);