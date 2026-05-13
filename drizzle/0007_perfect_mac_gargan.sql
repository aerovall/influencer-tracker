CREATE TABLE `video_comment_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_id` varchar(150) NOT NULL,
	`video_id` varchar(100) NOT NULL,
	`date` varchar(10) NOT NULL,
	`like_count` bigint,
	`comment_count` varchar(30),
	`comment_count_num` bigint,
	`top_comment_id` varchar(100),
	`top_comment_author` varchar(255),
	`top_comment_text` text,
	`top_comment_likes` varchar(30),
	`top_comment_likes_num` bigint,
	`top_comment_reply_count` int DEFAULT 0,
	`scrape_error` text,
	`scraped_at` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_comment_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_comment_snapshots_snapshot_id_unique` UNIQUE(`snapshot_id`)
);
--> statement-breakpoint
ALTER TABLE `view_counts` MODIFY COLUMN `manual_likes` bigint;--> statement-breakpoint
ALTER TABLE `view_counts` MODIFY COLUMN `manual_comments` bigint;