CREATE TABLE `organization_metadata` (
	`id` text PRIMARY KEY,
	`organization_id` text NOT NULL,
	`yearly_budget` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_organization_metadata_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `project` ADD `budget` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_metadata_organization_id_idx` ON `organization_metadata` (`organization_id`);