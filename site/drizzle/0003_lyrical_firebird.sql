CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`goal_id` text NOT NULL,
	`status` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_runs_user_date_idx` ON `agent_runs` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `agent_runs_date_idx` ON `agent_runs` (`date`);--> statement-breakpoint
CREATE INDEX `agent_runs_created_idx` ON `agent_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`helpful` text NOT NULL,
	`step` text NOT NULL,
	`message` text NOT NULL,
	`version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_user_date_idx` ON `feedback` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `feedback_created_idx` ON `feedback` (`created_at`);