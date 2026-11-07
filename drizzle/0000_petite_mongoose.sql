CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`owner` text NOT NULL,
	`time` text NOT NULL,
	`message` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_ticket` ON `events` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`customer` text NOT NULL,
	`contact` text NOT NULL,
	`device` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'phone' NOT NULL,
	`due` text DEFAULT '' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tickets_owner` ON `tickets` (`owner`);