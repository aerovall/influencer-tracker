CREATE TABLE `social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`platform` enum('Instagram','X') NOT NULL,
	`handle` varchar(255) NOT NULL,
	`display_name` varchar(255),
	`profile_url` text,
	`thumbnail_url` text,
	`follower_count` bigint DEFAULT 0,
	`post_count` int DEFAULT 0,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`last_checked_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_accounts_account_id_unique` UNIQUE(`account_id`)
);
--> statement-breakpoint
CREATE TABLE `social_post_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_id` varchar(150) NOT NULL,
	`post_id` varchar(255) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`platform` enum('Instagram','X') NOT NULL,
	`date` varchar(10) NOT NULL,
	`views` bigint DEFAULT 0,
	`impressions` bigint DEFAULT 0,
	`likes` bigint DEFAULT 0,
	`comments` bigint DEFAULT 0,
	`shares` bigint DEFAULT 0,
	`retweets` bigint DEFAULT 0,
	`engagement_rate` decimal(8,4) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_post_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_post_snapshots_snapshot_id_unique` UNIQUE(`snapshot_id`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` varchar(255) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`platform` enum('Instagram','X') NOT NULL,
	`post_url` text NOT NULL,
	`title` text,
	`published_date` varchar(10),
	`thumbnail_url` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_posts_post_id_unique` UNIQUE(`post_id`)
);
--> statement-breakpoint
ALTER TABLE `youtube_channels` MODIFY COLUMN `influencer_name` varchar(100);