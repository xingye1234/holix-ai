CREATE TABLE `agent_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_metadata_name_unique` ON `agent_metadata` (`name`);--> statement-breakpoint
CREATE INDEX `idx_agent_metadata_name` ON `agent_metadata` (`name`);--> statement-breakpoint
CREATE INDEX `idx_agent_metadata_favorite` ON `agent_metadata` (`favorite`);--> statement-breakpoint
CREATE INDEX `idx_agent_metadata_last_used` ON `agent_metadata` (`last_used_at`);--> statement-breakpoint
CREATE TABLE `chat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`title` text NOT NULL,
	`last_message_preview` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`expires_at` integer,
	`last_seq` integer DEFAULT 0 NOT NULL,
	`pending_messages` text,
	`prompts` text DEFAULT '[]' NOT NULL,
	`workspace` text,
	`context_settings` text DEFAULT '{"maxMessages":10,"timeWindowHours":24,"autoScrollToBottomOnSend":true}' NOT NULL,
	`llm_settings` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_uid_unique` ON `chat` (`uid`);--> statement-breakpoint
CREATE INDEX `idx_chat_uid` ON `chat` (`uid`);--> statement-breakpoint
CREATE INDEX `idx_chat_updated` ON `chat` (`updated_at`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`seq` integer NOT NULL,
	`chat_uid` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`content` text,
	`draft_content` text,
	`tool_calls` text,
	`status` text DEFAULT 'done' NOT NULL,
	`tool_status` text,
	`model` text,
	`searchable` integer DEFAULT true NOT NULL,
	`search_index_version` integer,
	`parent_uid` text,
	`request_id` text,
	`stream_id` text,
	`tool_name` text,
	`tool_payload` text,
	`telemetry` text,
	`error` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`chat_uid`) REFERENCES `chat`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_uid_unique` ON `message` (`uid`);--> statement-breakpoint
CREATE INDEX `idx_messages_chat` ON `message` (`chat_uid`);--> statement-breakpoint
CREATE INDEX `idx_messages_chat_seq` ON `message` (`chat_uid`,`seq`);--> statement-breakpoint
CREATE INDEX `idx_messages_time` ON `message` (`created_at`);--> statement-breakpoint
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
CREATE INDEX `idx_skill_invocation_created` ON `skill_invocation_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `ky` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
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