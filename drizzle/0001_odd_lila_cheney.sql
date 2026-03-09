CREATE TABLE `skill_invocation_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`skill_name` text NOT NULL,
	`tool_name` text NOT NULL,
	`args` text,
	`result` text,
	`rejected` integer DEFAULT false NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_invocation_skill_tool` ON `skill_invocation_log` (`skill_name`,`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_skill_invocation_created` ON `skill_invocation_log` (`created_at`);