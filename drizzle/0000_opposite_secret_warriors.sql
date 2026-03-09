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
	`workspace` text
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
	`status` text DEFAULT 'done' NOT NULL,
	`model` text,
	`searchable` integer DEFAULT true NOT NULL,
	`search_index_version` integer,
	`parent_uid` text,
	`request_id` text,
	`stream_id` text,
	`tool_name` text,
	`tool_payload` text,
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
CREATE TABLE `ky` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
