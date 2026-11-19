CREATE TABLE `app_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`number` integer NOT NULL,
	`instruction` text NOT NULL,
	`html` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_versions_number` ON `app_versions` (`app_id`,`number`);--> statement-breakpoint
CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`remixed_from_id` text,
	`remixed_from_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `apps_owner` ON `apps` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `apps_visibility` ON `apps` (`visibility`,`updated_at`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`model` text NOT NULL,
	`compare_model` text,
	`system_instruction` text DEFAULT '' NOT NULL,
	`temperature` real DEFAULT 1 NOT NULL,
	`top_p` real DEFAULT 0.95 NOT NULL,
	`max_output_tokens` integer DEFAULT 2048 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompts_owner_updated` ON `prompts` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text NOT NULL,
	`position` integer NOT NULL,
	`slot` integer DEFAULT 0 NOT NULL,
	`role` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`model` text,
	`rating` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `turns_prompt` ON `turns` (`prompt_id`,`position`,`slot`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
