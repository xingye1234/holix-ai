CREATE TABLE `agent_execution_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`chat_uid` text NOT NULL,
	`agent_id` text NOT NULL,
	`hook` text NOT NULL,
	`status` text NOT NULL,
	`result_data` text,
	`error` text,
	`duration` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_execution_log_uid_unique` ON `agent_execution_log` (`uid`);--> statement-breakpoint
CREATE INDEX `idx_agent_execution_chat` ON `agent_execution_log` (`chat_uid`);--> statement-breakpoint
CREATE INDEX `idx_agent_execution_agent` ON `agent_execution_log` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_execution_created` ON `agent_execution_log` (`created_at`);