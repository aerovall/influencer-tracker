CREATE TABLE `alert_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thresholdId` int NOT NULL,
	`video_id` varchar(100) NOT NULL,
	`triggeredValue` decimal(15,4) NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`metric` enum('view_count','view_growth_rate','engagement_rate','likes','comments','shares') NOT NULL,
	`operator` enum('gt','lt','gte','lte') NOT NULL,
	`thresholdValue` decimal(15,4) NOT NULL,
	`influencerName` varchar(100),
	`platform` enum('YouTube','Instagram','TikTok'),
	`alertType` enum('viral','underperforming','custom') NOT NULL DEFAULT 'custom',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_thresholds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('YouTube','Instagram','TikTok') NOT NULL,
	`label` varchar(255) NOT NULL,
	`credentialKey` varchar(100) NOT NULL,
	`credentialValue` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTestedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_credentials_credentialKey_unique` UNIQUE(`credentialKey`)
);
--> statement-breakpoint
CREATE TABLE `influencers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`bio` text,
	`avatarUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `influencers_id` PRIMARY KEY(`id`),
	CONSTRAINT `influencers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `platform_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`influencerId` int NOT NULL,
	`platform` enum('YouTube','Instagram','TikTok') NOT NULL,
	`channelId` varchar(255),
	`channelUrl` text,
	`username` varchar(255),
	`credentialKey` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`frequency` enum('daily','weekly') NOT NULL,
	`dailyHourUtc` int NOT NULL DEFAULT 0,
	`weeklyDayOfWeek` int DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_schedule_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_schedule_frequency_unique` UNIQUE(`frequency`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('daily','weekly') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`periodStart` varchar(10) NOT NULL,
	`periodEnd` varchar(10) NOT NULL,
	`totalVideos` int DEFAULT 0,
	`totalViews` bigint DEFAULT 0,
	`avgEngagementRate` decimal(8,4) DEFAULT '0',
	`alertsTriggered` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shill_id` varchar(100) NOT NULL,
	`video_id` varchar(100) NOT NULL,
	`product_brand` varchar(255) NOT NULL,
	`timestamp` varchar(10) NOT NULL,
	`length_seconds` int NOT NULL,
	`promo_type` text NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shills_id` PRIMARY KEY(`id`),
	CONSTRAINT `shills_shill_id_unique` UNIQUE(`shill_id`)
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('video_discovery','view_count_snapshot','report_generation','alert_check') NOT NULL,
	`status` enum('running','success','failed') NOT NULL,
	`influencerName` varchar(100),
	`platform` enum('YouTube','Instagram','TikTok'),
	`recordsProcessed` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`video_id` varchar(100) NOT NULL,
	`influencer_name` varchar(100) NOT NULL,
	`platform` enum('YouTube','Instagram','TikTok') NOT NULL,
	`video_url` text NOT NULL,
	`title` text NOT NULL,
	`published_date` varchar(10) NOT NULL,
	`date_added` varchar(10) NOT NULL,
	`thumbnailUrl` text,
	`durationSeconds` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `videos_video_id_unique` UNIQUE(`video_id`)
);
--> statement-breakpoint
CREATE TABLE `view_counts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`count_id` varchar(100) NOT NULL,
	`video_id` varchar(100) NOT NULL,
	`date` varchar(10) NOT NULL,
	`view_count` bigint NOT NULL DEFAULT 0,
	`likes` bigint DEFAULT 0,
	`comments` bigint DEFAULT 0,
	`shares` bigint DEFAULT 0,
	`engagement_rate` decimal(8,4) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `view_counts_id` PRIMARY KEY(`id`),
	CONSTRAINT `view_counts_count_id_unique` UNIQUE(`count_id`)
);
