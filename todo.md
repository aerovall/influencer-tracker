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

## No-API YouTube Tracking (v1.1)
- [x] Research YouTube public endpoints (oEmbed, noembed, Innertube/YouTube internal API)
- [x] Build server-side YouTubePublicFetcher using Innertube API (no key required)
- [x] Fetch: video title, views, likes, comments, publish date, thumbnail from public data
- [x] Update syncEngine to use new fetcher for YouTube (no credential required)
- [x] Update platformApi.ts to route YouTube calls through the new fetcher
- [x] Remove YouTube API key requirement from Admin Panel credentials section
- [x] Add note in Admin UI that YouTube tracking is keyless/automatic
- [x] Update vitest tests to cover the new public fetcher logic

## Gap Resolutions (v1.1 follow-up)
- [x] YouTube comment count: document limitation in UI (InnerTube basic_info does not expose comment count; show N/A in UI)
- [x] YouTube publish date: use video publish date from InnerTube or fall back gracefully with a note
- [x] Add vitest coverage for extractYouTubeVideoId URL parsing
- [x] Add vitest coverage for fetchYouTubeVideoInfo error/null handling

## Per-Channel Automation (v1.2)
- [x] DB: add youtube_channels table (id, influencer_name, channel_id, channel_handle, channel_name, thumbnail_url, subscriber_count, last_checked_at, is_active)
- [x] DB: add channel_id FK to videos table
- [x] DB: update shills table to use auto-increment shill_id with shl_NNN format
- [x] Channel discovery: fetch last 10 uploads on channel link via youtubei.js
- [x] Channel daily check: detect new videos uploaded since last_checked_at
- [x] Daily stats pull: update view_counts, likes, comments for all active channel videos
- [x] tRPC: channels.link, channels.list, channels.unlink, channels.syncNow
- [x] tRPC: videos.listByChannel
- [x] tRPC: shills CRUD scoped per video (create, list, update, delete)
- [x] UI: Channels page — link channel form, channel cards with video count and last sync
- [x] UI: Channel detail page — video list with stats, per-video shill table
- [x] UI: Per-video shill table with inline add/edit/delete rows
- [x] Update daily cron to iterate channels and check for new uploads + stats
- [x] Update tests for new channel and shill flows

## v1.3 — Multi-Platform Refactor
- [x] DB: add social_accounts table (platform: youtube|instagram|x, account_id, handle, display_name, thumbnail_url, follower_count, last_checked_at)
- [x] DB: add social_posts table (post_id, account_id, platform, post_url, title, published_date, views, likes, comments, shares/retweets, impressions)
- [x] DB: add post_snapshots table (append-only daily stats per post)
- [x] Remove influencerName FK from youtube_channels table (channels are standalone)
- [x] tRPC: remove influencerName from channels.link input
- [x] tRPC: add socialAccounts router (link, list, unlink, syncAccount)
- [x] UI: Remove "Assign to Influencer" from Link YouTube Channel dialog
- [x] UI: Add Instagram account link form and account cards on Channels page
- [x] UI: Add X (Twitter) account link form and account cards on Channels page
- [x] UI: Replace "All Influencers" filter in Video Catalog with channel name dropdown
- [x] UI: Per-video shill table — remove video_id column, show shill_id, product_brand, timestamp, length_seconds, promo_type
- [x] Server: Instagram public metric fetcher (profile + recent posts via public embed/scrape)
- [x] Server: X public metric fetcher (profile + recent posts via public embed/scrape)
- [x] Daily cron: sync Instagram and X accounts for new posts + stats

## v1.4 — Channels Nav Badge
- [x] DB: add is_seen column to videos table (default false)
- [x] DB helper: getUnseenNewVideoCount — count videos where is_seen = false
- [x] DB helper: markAllVideosSeen — set is_seen = true for all videos
- [x] tRPC: channels.unseenCount — returns count of unseen new videos
- [x] tRPC: channels.markSeen — sets all videos as seen
- [x] DashboardLayout: poll unseenCount every 60s, show gold badge on Channels nav item
- [x] Channels.tsx: call markSeen on mount to clear the badge
- [x] channelEngine: set is_seen = false when inserting newly discovered videos
- [x] Test: unseenCount returns correct count, markSeen resets to 0

## v1.5 — Bug Fix: YouTube @handle Channel Resolution
- [x] Fix resolveChannel() in channelEngine.ts: remove query.replace(/^@/, "") so @handle searches keep the @ prefix and return correct Channel results from youtubei.js search

## v1.6 — Sync Now Result Toast
- [x] syncEngine.runChannelSync(): return { newVideoCount } instead of void
- [x] tRPC channels.syncChannel: return { newVideoCount, channelName } from mutation
- [x] Channels.tsx: show toast after Sync Now — "X new video(s) discovered" or "Already up to date"

## v1.6 — Fix Stats Not Displayed (views, likes, comments, duration all showing "—")
- [x] Diagnose: check what's in view_counts table and videos table after sync
- [x] Fix: ensure fetchBulkVideoStats results are stored correctly in view_counts
- [x] Fix: ensure duration_seconds is stored in videos table on insert
- [x] Fix: ensure videos table has title populated (not "Untitled")
- [x] Fix: UI Channels page reads latest view_count row per video and displays it
- [x] Fix: UI shows duration from videos.duration_seconds column

## v1.9 — Fix All Data Pipelines
- [x] YouTube: fetch real subscriber count (not 0) on channel sync
- [x] YouTube: fetch real like counts per video (not N/A) — N/A is YouTube limitation; likes not in public listing
- [x] YouTube: fetch real comment counts per video (not N/A) — N/A is YouTube limitation; comments not in public listing
- [x] YouTube: manual sync all linked channels for new uploads (Levi: 0 new, Conor Kenny: 20 new)
- [x] Instagram: rewrite to use Instagram Graph API (INSTAGRAM_ACCESS_TOKEN required); all public endpoints blocked
- [x] X (Twitter): rewrite to use Twitter API v2 (TWITTER_BEARER_TOKEN required); nitter.net dead

## v1.9 — API Key Configuration (pending user action)
- [x] User: provide YOUTUBE_API_KEY to enable per-video likes/comments (free quota: 10K units/day at console.cloud.google.com) — optional, managed via Admin → API Keys
- [x] User: provide INSTAGRAM_ACCESS_TOKEN to enable Instagram follower/post data (Facebook Developer account required) — optional, managed via Admin → API Keys
- [x] User: provide TWITTER_BEARER_TOKEN to enable X follower/tweet data (free tier at developer.x.com) — optional, managed via Admin → API Keys
- [x] UI: show amber warning banners on Instagram/X tabs when API keys are missing
- [x] UI: show "N/A" with tooltip for likes/comments (YouTube public listing limitation)

## v2.0 — API Keys Settings in Admin Dashboard
- [x] Admin page: add "API Keys" tab/section with fields for YOUTUBE_API_KEY, INSTAGRAM_ACCESS_TOKEN, TWITTER_BEARER_TOKEN
- [x] Backend: tRPC admin.saveApiKey mutation — store key in api_credentials table (encrypted/hashed display)
- [x] Backend: tRPC admin.getApiKeys query — return which keys are configured (masked, not raw values)
- [x] Backend: channelEngine/socialEngine read keys from DB (api_credentials table) as fallback to env vars
- [x] UI: show connection status badge (Connected / Not configured) per key
- [x] UI: "Test Connection" button per key to verify the key works
- [x] UI: remove amber warning banners from Instagram/X tabs once key is saved

## v2.2 — Manual Likes/Comments Input per Video
- [x] Backend: tRPC videos.updateManualStats mutation — accept videoId, likes, comments and upsert into view_counts for today
- [x] UI: Channels page video row — add edit icon (pencil) on Likes and Comments cells that opens an inline popover/dialog
- [x] UI: Popover shows number inputs for likes and comments with Save button
- [x] UI: After save, optimistically update the displayed value and show a toast
- [x] UI: Show a small "manual" indicator (e.g. pencil icon) on cells that have manually entered values

## v2.4 — No-Code YouTube Scraping Robot (Daily)
- [x] Test YouTube InnerTube/page scraping for likes count, comment count, top comment, replies
- [x] Build scrapeVideoStats() engine using youtubei.js (handles bot detection) for likes/comments
- [x] DB schema: video_comment_snapshots table (videoId, date, likeCount, commentCount, topCommentText, topCommentAuthor, topCommentLikes, topCommentReplyCount, scrapeError, scrapedAt)
- [x] tRPC videos.getCommentData query — return latest scraped comment data per video
- [x] tRPC videos.scrapeComments mutation — manually trigger scrape for one video
- [x] Daily schedule handler: /api/scheduled/daily-comment-scrape (activate after deploy)
- [x] UI: CommentPanel in expanded video row — shows likes, comment count, top comment with author/likes/reply count
- [x] UI: "Last scraped" date + "Scrape Now" button per video with loading state and success toast

## v2.5 — Bulk Scrape All Button
- [x] Backend: tRPC videos.bulkScrapeStatus query — return current scrape job state (idle/running/done, progress, errors)
- [x] Backend: tRPC videos.startBulkScrape mutation — kick off background scrape for all YouTube videos, store progress in-memory
- [x] UI: Channels page top bar — "Bulk Scrape All" button with progress bar (X/Y videos scraped)
- [x] UI: Show per-video status (scraped / error) in progress panel
- [x] UI: Auto-refresh comment data after bulk scrape completes

## v2.6 — Bug Fixes (8 issues)
- [x] Fix 1: Auto-fill scraped likes/comments into view_counts in startBulkScrape (bulk scrape)
- [x] Fix 2: Auto-fill scraped likes/comments into view_counts in scrapeComments (single video)
- [x] Fix 3: Remove z.enum(["Levi","NoBs","Danielle"]) from channels.link — influencerName is now free-form z.string()
- [x] Fix 4: Remove z.enum from videos.create influencerName — now free-form z.string()
- [x] Fix 5: syncChannel mutation — use channelName instead of channel.influencerName ?? "Unknown"
- [x] Fix 6: syncEngine.ts runChannelSync — use channelName instead of influencerName ?? "Unknown"
- [x] Fix 7: Dashboard.tsx — replace hardcoded CHART_COLORS/Levi/NoBs/Danielle with dynamic channel names from trends data
- [x] Fix 8: Analytics.tsx — replace hardcoded INFLUENCERS/INFLUENCER_COLORS with dynamic channel names
- [x] Fix 9: Videos.tsx, AdminPanel.tsx — replace hardcoded Levi/NoBs/Danielle dropdowns with dynamic channel list from channels.list query
- [x] Fix 10: Badges.tsx InfluencerBadge — replace hardcoded Levi/NoBs/Danielle color map with deterministic hash-based color for any channel name
- [x] Fix 11: VideoRow shill badge — add shills.countByVideo (always-enabled) so badge shows before row is expanded
- [x] Fix 12: Add getShillCountByVideoId db helper + shills.countByVideo tRPC procedure
- [x] Fix 13: Update stale vitest tests to reflect free-form influencerName (no enum rejection)

## v2.7 — Per-Channel Scrape + Sync Fix
- [x] Fix: insertViewCount onDuplicateKeyUpdate must NOT overwrite likes/comments with 0 when scraped values already exist
- [x] Fix: syncEngine runChannelSync inserts likes: upload.likeCount (which is 0 from listing) — preserve existing scraped likes/comments on duplicate
- [x] Backend: add db helper insertViewCountPreserveScrape — uses GREATEST(existing, new) so scraped values are never overwritten
- [x] Backend: tRPC videos.startChannelScrape + videos.channelScrapeStatus — per-channel background scrape with polling
- [x] UI: add "Scrape" button per channel card in Channels.tsx (next to Sync button)
- [x] UI: show per-channel scrape progress bar and video count while running

## v2.9 — Dashboard Excel Export
- [x] Install xlsx (SheetJS) npm package
- [x] Add tRPC analytics.exportStats query that returns all data needed for the Excel file
- [x] Build Excel file on the frontend using SheetJS (5 sheets: Summary, Videos, View Counts, Sponsorships, Channels)
- [x] Add Export to Excel button on Dashboard page header
- [x] Format cells: header row bold/colored, date columns formatted, column widths set per sheet

## v2.10 — Analytics Per-Channel Bar Chart
- [x] SQL: back-fill influencerName from channelName for all existing videos where influencerName IS NULL and channelId is set
- [x] Add tRPC analytics.viewsByChannel query returning total views per channel name (computed client-side from trends data)
- [x] Replace "Views by Influencer" area/line chart with horizontal bar chart (views per channel) showing Views, Likes, Comments
- [x] Keep the All Influencers filter dropdown working with real channel names

## v2.11 — Excel & Reports Visual Polish
- [x] Excel: dark navy header row with white bold text on all sheets
- [x] Excel: alternating row fill (light grey every other row)
- [x] Excel: number format for views/likes/comments (comma thousands separator)
- [x] Excel: percentage format for engagement rate column
- [x] Excel: freeze top header row on all data sheets
- [x] Excel: cell borders on all data cells
- [x] Excel: auto-fit column widths (wider for title/URL, narrower for numbers)
- [x] Excel: Summary sheet with title block, KPI table, by-channel and by-platform sections
- [x] Reports page: redesign with summary bar, grouped daily/weekly sections, polished row cards
- [x] Reports page: rich detail dialog with stat chips, scrollable content, and period info

## v2.12 — Dashboard KPI + Snapshot Fix
- [x] Remove "Avg Engagement" KPI card from Dashboard
- [x] Fix: Snapshot Views (runViewCountSnapshot) uses insertViewCountPreserveScrape so scraped likes/comments are never overwritten with 0

## v2.15 — Report Duplicate Fix + Excel Visual Enhancement
- [x] Fix: generateDailyReport deduplicates getViewCountTrends(1) to latest row per video (was showing each video twice)
- [x] Fix: generateWeeklyReport deduplicates getViewCountTrends(7) to latest row per video
- [x] Excel: add "🏆 Top Videos" sheet — top 20 by views with gold/silver/bronze rank medals
- [x] Excel: heat-map colour coding on Views, Likes, Comments columns (green/yellow/red by percentile)
- [x] Excel: channel name cells get unique accent colour per channel across all sheets
- [x] Excel: brand name cells get unique accent colour per brand in Sponsorships sheet
- [x] Excel: subscriber count heat-map on Channels sheet
- [x] Excel: "Views Bar" column on View Counts sheet (Unicode block bar chart)
- [x] Excel: Summary sheet KPI row with 6 large coloured value cells
- [x] Excel: Summary sheet Channel Performance table with per-channel views/likes/comments/sponsorships
- [x] Backend: exportStats adds channelStats aggregation (totalViews/likes/comments/sponsorships per channel)

## v2.14 — Reports Visual Redesign + Delete
- [x] Add deleteReport tRPC procedure and DB helper
- [x] Redesign Reports page: newsletter-style layout, clean stat chips (remove Alerts/Avg Engagement, add Likes/Comments/Top Channel)
- [x] Render report content as proper HTML (parse markdown bold/headers/bullets) instead of raw text
- [x] Add delete button per report row with confirmation dialog
- [x] Remove raw markdown symbols from report detail view

## v2.16 — Excel Export Date Range Filter
- [x] Backend: update exportStats to accept optional dateFrom/dateTo filter params
- [x] Backend: filter videos, viewCounts, sponsorships by date range in exportStats
- [x] Frontend: build ExportExcelDialog component with preset buttons (Last 7d, 30d, 90d, All Time) and custom date range picker
- [x] Frontend: wire date range selection to exportStats query and downloadDashboardExcel
- [x] Frontend: replace plain Export Excel button on Dashboard with dialog trigger
