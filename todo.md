# Influencer Tracker — Project TODO

## Database Schema
- [x] influencers table (id, name, bio, avatar_url, created_at)
- [x] platform_accounts table (id, influencer_id, platform, channel_id, channel_url, username, api_credentials_key, is_active)
- [x] videos table (video_id, influencer_name, platform, video_url, title, published_date, date_added)
- [x] view_counts table (count_id, video_id, date, view_count, likes, comments, shares, engagement_rate)
- [x] shills table (shill_id, video_id, product_brand, timestamp, length_seconds, promo_type)
- [x] api_credentials table (id, platform, credential_key, credential_value_encrypted, label, created_at)
- [x] alert_thresholds table (id, metric, operator, threshold_value, influencer_id, platform, is_active)
- [x] report_schedule table (id, frequency, last_run_at, next_run_at, is_active)
- [x] alert_events, reports, sync_log tables

## Backend / Server
- [x] DB query helpers for all tables
- [x] tRPC routers: influencers, videos, analytics, shills, admin, reports, alerts
- [x] YouTube Data API v3 integration (videos list, statistics)
- [x] Instagram Graph API integration (media, insights)
- [x] TikTok Research API integration (video list, stats)
- [x] Daily cron job: fetch new videos per influencer per platform
- [x] Daily cron job: append view count snapshots (never overwrite)
- [x] Alert evaluation engine: check thresholds after each daily pull
- [x] Daily summary report generator with owner notification
- [x] Weekly summary report generator
- [x] Owner notification dispatch (viral / underperforming / reports)
- [x] Excel export via xlsx package (Videos, View Counts, Shills sheets)
- [x] Scheduled handlers: /api/scheduled/daily-sync, /api/scheduled/daily-report
- [x] Scheduled handlers mounted in server/_core/index.ts before Vite fallthrough

## Frontend — Layout & Global
- [x] Dark elegant theme with premium color palette (deep navy/charcoal + gold accents)
- [x] DashboardLayout with sidebar navigation
- [x] Sidebar: Dashboard, Videos, Analytics, Sponsorships, Reports, Admin
- [x] Responsive design (mobile-first)
- [x] Smooth page transitions and micro-interactions

## Frontend — Dashboard Page
- [x] KPI cards: total videos, total views, avg engagement rate, unread alerts
- [x] View trend chart (last 14 days)
- [x] Videos by platform pie chart
- [x] Recent alerts panel
- [x] Recent videos panel

## Frontend — Video Catalog Page
- [x] Filterable table: by influencer, by platform, by date range
- [x] Per-row: video link, metrics summary
- [x] Add video manually (form)
- [x] View daily view count history per video (modal)
- [x] Delete video

## Frontend — Analytics Page
- [x] Per-influencer selector tabs
- [x] Per-platform selector tabs
- [x] Line chart: view count over time per video
- [x] Bar chart: engagement rate comparison across videos
- [x] Top/bottom performers summary

## Frontend — Shills / Sponsorship Log Page
- [x] Table: all shill events linked to videos
- [x] Filter by brand, influencer, platform
- [x] Add shill form (video_id, product_brand, timestamp, length_seconds, promo_type)
- [x] Edit / delete shill entries
- [x] Brand summary: total shills per brand, avg shill length

## Frontend — Reports Page
- [x] List of generated daily/weekly reports
- [x] Report detail view (summary stats, full content)
- [x] Manual trigger: generate daily/weekly report now

## Frontend — Admin Panel
- [x] Influencer management: add/edit/remove (Levi, NoBs, Danielle)
- [x] Platform account management: link/unlink per influencer per platform
- [x] API credentials manager: YouTube API key, Instagram token, TikTok token
- [x] Alert threshold configurator: metric, operator, value, influencer/platform scope
- [x] Report schedule settings: daily time, weekly day/time
- [x] Manual sync trigger: run daily data pull now
- [x] Sync logs viewer

## Excel Export
- [x] Export button on Admin panel
- [x] Export generates .xlsx with 3 sheets: Videos, View Counts, Shills
- [x] Schema matches exactly: field names as specified

## Tests
- [x] Vitest: auth.me (authenticated and unauthenticated)
- [x] Vitest: influencers.list (all three names)
- [x] Vitest: videos.list
- [x] Vitest: videos.create (valid and invalid influencer/platform names)
- [x] Vitest: shills.create (valid and invalid timestamp)
- [x] Vitest: analytics.kpis
- [x] Vitest: admin.syncNow
- [x] Vitest: reports.getById
- [x] Vitest: admin.createThreshold
- [x] Vitest: auth.logout
