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
