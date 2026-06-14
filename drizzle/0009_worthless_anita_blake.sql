CREATE TABLE `affiliate_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int,
	`channel_id` varchar(100),
	`talent_name` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`short_code` varchar(100),
	`commission_type` enum('flat','cpc','cpa','revenue_share') NOT NULL DEFAULT 'flat',
	`commission_rate` decimal(10,4) DEFAULT '0',
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`link_id` int NOT NULL,
	`snapshot_date` varchar(10) NOT NULL,
	`clicks` bigint DEFAULT 0,
	`conversions` bigint DEFAULT 0,
	`revenue_generated` decimal(12,2) DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_deliverables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`channel_id` varchar(100),
	`talent_name` varchar(255) NOT NULL,
	`content_type` enum('dedicated_video','integration','short','story','post','other') NOT NULL DEFAULT 'dedicated_video',
	`due_date` varchar(10),
	`status` enum('brief_sent','script_review','filming','editing','review','published','cancelled') NOT NULL DEFAULT 'brief_sent',
	`agreed_fee` decimal(12,2) DEFAULT '0',
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`video_id` varchar(100),
	`brief_notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_deliverables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`objective` text,
	`budget` decimal(12,2) DEFAULT '0',
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`start_date` varchar(10),
	`end_date` varchar(10),
	`status` enum('draft','active','paused','completed','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`contact_name` varchar(255),
	`contact_email` varchar(320),
	`billing_address` text,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int,
	`recipient_email` varchar(320) NOT NULL,
	`recipient_name` varchar(255),
	`recipient_type` enum('client','talent','internal') NOT NULL DEFAULT 'client',
	`subject` varchar(500) NOT NULL,
	`body_html` text,
	`status` enum('queued','sent','failed','bounced') NOT NULL DEFAULT 'queued',
	`error_message` text,
	`sent_at` timestamp,
	`related_type` varchar(50),
	`related_id` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('brief','invoice','follow_up','results','general') NOT NULL DEFAULT 'general',
	`subject` varchar(500) NOT NULL,
	`body_html` text NOT NULL,
	`variables_used` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_line_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`description` text NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unit_price` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`sort_order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_number` varchar(50) NOT NULL,
	`client_id` int NOT NULL,
	`campaign_id` int,
	`status` enum('draft','sent','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0',
	`tax_rate` decimal(6,4) DEFAULT '0',
	`tax_amount` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`issued_date` varchar(10),
	`due_date` varchar(10),
	`paid_date` varchar(10),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoice_number_unique` UNIQUE(`invoice_number`)
);
--> statement-breakpoint
CREATE TABLE `talent_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliverable_id` int NOT NULL,
	`reporting_window_days` int DEFAULT 30,
	`views` bigint DEFAULT 0,
	`likes` bigint DEFAULT 0,
	`comments` bigint DEFAULT 0,
	`shares` bigint DEFAULT 0,
	`reach` bigint DEFAULT 0,
	`impressions` bigint DEFAULT 0,
	`engagement_rate` decimal(8,4) DEFAULT '0',
	`link_clicks` bigint DEFAULT 0,
	`locked_at` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `talent_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `talent_results_deliverable_id_unique` UNIQUE(`deliverable_id`)
);
