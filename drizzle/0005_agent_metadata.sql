-- Create agent_metadata table
CREATE TABLE IF NOT EXISTS `agent_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`favorite` integer DEFAULT 0 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS `idx_agent_metadata_name` ON `agent_metadata` (`name`);
CREATE INDEX IF NOT EXISTS `idx_agent_metadata_favorite` ON `agent_metadata` (`favorite`);
CREATE INDEX IF NOT EXISTS `idx_agent_metadata_last_used` ON `agent_metadata` (`last_used_at`);
