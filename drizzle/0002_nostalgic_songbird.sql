CREATE TABLE `youtube_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel_id` varchar(100) NOT NULL,
	`channel_handle` varchar(255),
	`channel_name` varchar(255) NOT NULL,
	`influencer_name` varchar(100) NOT NULL,
	`thumbnail_url` text,
	`subscriber_count` bigint DEFAULT 0,
	`video_count` int DEFAULT 0,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`last_checked_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `youtube_channels_channel_id_unique` UNIQUE(`channel_id`)
);
--> statement-breakpoint
ALTER TABLE `videos` ADD `channel_id` varchar(100);