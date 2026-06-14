import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  clients, campaigns, campaignDeliverables, affiliateLinks, affiliateSnapshots,
  invoices, invoiceLineItems, emailTemplates, emailLogs, talentResults,
  youtubeChannels, videos, viewCounts,
} from "../../drizzle/schema";
import { eq, desc, sql, inArray, and, gte, sum, count, countDistinct } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

async function nextInvoiceNumber(): Promise<string> {
  const db = await getDb();
  if (!db) return `INV-${new Date().getFullYear()}-001`;
  const year = new Date().getFullYear();
  const rows = await db
    .select({ num: invoices.invoiceNumber })
    .from(invoices)
    .where(sql`invoice_number LIKE ${`INV-${year}-%`}`)
    .orderBy(desc(invoices.id))
    .limit(1);
  if (rows.length === 0) return `INV-${year}-001`;
  const last = rows[0]!.num;
  const seq = parseInt(last.split("-")[2] ?? "0", 10) + 1;
  return `INV-${year}-${String(seq).padStart(3, "0")}`;
}

// ─── Clients Router ───────────────────────────────────────────────────────────

export const clientsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
    if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
    return rows[0];
  }),

  create: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional().or(z.literal("")),
      billingAddress: z.string().optional(),
      currency: z.string().default("USD"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(clients).values({
        companyName: input.companyName,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail || null,
        billingAddress: input.billingAddress ?? null,
        currency: input.currency,
        notes: input.notes ?? null,
      });
      return { id: (result as any).insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      companyName: z.string().min(1).optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional().or(z.literal("")),
      billingAddress: z.string().optional(),
      currency: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(clients).set({
        ...(rest.companyName !== undefined && { companyName: rest.companyName }),
        ...(rest.contactName !== undefined && { contactName: rest.contactName }),
        ...(rest.contactEmail !== undefined && { contactEmail: rest.contactEmail || null }),
        ...(rest.billingAddress !== undefined && { billingAddress: rest.billingAddress }),
        ...(rest.currency !== undefined && { currency: rest.currency }),
        ...(rest.notes !== undefined && { notes: rest.notes }),
        ...(rest.isActive !== undefined && { isActive: rest.isActive }),
      }).where(eq(clients.id, id));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(clients).where(eq(clients.id, input.id));
      return { ok: true };
    }),
});

// ─── Campaigns Router ─────────────────────────────────────────────────────────

export const campaignsRouter = router({
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          campaign: campaigns,
          client: { companyName: clients.companyName, contactEmail: clients.contactEmail },
        })
        .from(campaigns)
        .leftJoin(clients, eq(campaigns.clientId, clients.id))
        .where(input?.clientId ? eq(campaigns.clientId, input.clientId) : undefined)
        .orderBy(desc(campaigns.createdAt));
      return rows;
    }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db
      .select({
        campaign: campaigns,
        client: { id: clients.id, companyName: clients.companyName, contactEmail: clients.contactEmail, currency: clients.currency },
      })
      .from(campaigns)
      .leftJoin(clients, eq(campaigns.clientId, clients.id))
      .where(eq(campaigns.id, input.id))
      .limit(1);
    if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
    return rows[0];
  }),

  create: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      name: z.string().min(1),
      objective: z.string().optional(),
      budget: z.string().default("0"),
      currency: z.string().default("USD"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(["draft", "active", "paused", "completed", "cancelled"]).default("draft"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(campaigns).values({
        clientId: input.clientId,
        name: input.name,
        objective: input.objective ?? null,
        budget: input.budget,
        currency: input.currency,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        status: input.status,
        notes: input.notes ?? null,
      });
      return { id: (result as any).insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      objective: z.string().optional(),
      budget: z.string().optional(),
      currency: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(["draft", "active", "paused", "completed", "cancelled"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(campaigns).set({
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.objective !== undefined && { objective: rest.objective }),
        ...(rest.budget !== undefined && { budget: rest.budget }),
        ...(rest.currency !== undefined && { currency: rest.currency }),
        ...(rest.startDate !== undefined && { startDate: rest.startDate }),
        ...(rest.endDate !== undefined && { endDate: rest.endDate }),
        ...(rest.status !== undefined && { status: rest.status }),
        ...(rest.notes !== undefined && { notes: rest.notes }),
      }).where(eq(campaigns.id, id));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(campaigns).where(eq(campaigns.id, input.id));
      return { ok: true };
    }),
});

// ─── Deliverables Router ──────────────────────────────────────────────────────

export const deliverablesRouter = router({
  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(campaignDeliverables)
        .where(eq(campaignDeliverables.campaignId, input.campaignId))
        .orderBy(campaignDeliverables.createdAt);
    }),

  create: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      channelId: z.string().optional(),
      talentName: z.string().min(1),
      contentType: z.enum(["dedicated_video", "integration", "short", "story", "post", "other"]).default("dedicated_video"),
      dueDate: z.string().optional(),
      status: z.enum(["brief_sent", "script_review", "filming", "editing", "review", "published", "cancelled"]).default("brief_sent"),
      agreedFee: z.string().default("0"),
      currency: z.string().default("USD"),
      videoId: z.string().optional(),
      briefNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(campaignDeliverables).values({
        campaignId: input.campaignId,
        channelId: input.channelId ?? null,
        talentName: input.talentName,
        contentType: input.contentType,
        dueDate: input.dueDate ?? null,
        status: input.status,
        agreedFee: input.agreedFee,
        currency: input.currency,
        videoId: input.videoId ?? null,
        briefNotes: input.briefNotes ?? null,
      });
      return { id: (result as any).insertId };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["brief_sent", "script_review", "filming", "editing", "review", "published", "cancelled"]),
      videoId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(campaignDeliverables).set({
        status: input.status,
        ...(input.videoId !== undefined && { videoId: input.videoId }),
      }).where(eq(campaignDeliverables.id, input.id));
      return { ok: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      talentName: z.string().optional(),
      contentType: z.enum(["dedicated_video", "integration", "short", "story", "post", "other"]).optional(),
      dueDate: z.string().optional(),
      status: z.enum(["brief_sent", "script_review", "filming", "editing", "review", "published", "cancelled"]).optional(),
      agreedFee: z.string().optional(),
      currency: z.string().optional(),
      videoId: z.string().optional(),
      briefNotes: z.string().optional(),
      channelId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(campaignDeliverables).set({
        ...(rest.talentName !== undefined && { talentName: rest.talentName }),
        ...(rest.contentType !== undefined && { contentType: rest.contentType }),
        ...(rest.dueDate !== undefined && { dueDate: rest.dueDate }),
        ...(rest.status !== undefined && { status: rest.status }),
        ...(rest.agreedFee !== undefined && { agreedFee: rest.agreedFee }),
        ...(rest.currency !== undefined && { currency: rest.currency }),
        ...(rest.videoId !== undefined && { videoId: rest.videoId }),
        ...(rest.briefNotes !== undefined && { briefNotes: rest.briefNotes }),
        ...(rest.channelId !== undefined && { channelId: rest.channelId }),
      }).where(eq(campaignDeliverables.id, id));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(campaignDeliverables).where(eq(campaignDeliverables.id, input.id));
      return { ok: true };
    }),
});

// ─── Affiliate Router ─────────────────────────────────────────────────────────

export const affiliateRouter = router({
  listLinks: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(affiliateLinks)
        .where(input?.campaignId ? eq(affiliateLinks.campaignId, input.campaignId) : undefined)
        .orderBy(desc(affiliateLinks.createdAt));
    }),

  createLink: protectedProcedure
    .input(z.object({
      campaignId: z.number().optional(),
      channelId: z.string().optional(),
      talentName: z.string().min(1),
      url: z.string().url(),
      shortCode: z.string().optional(),
      commissionType: z.enum(["flat", "cpc", "cpa", "revenue_share"]).default("flat"),
      commissionRate: z.string().default("0"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(affiliateLinks).values({
        campaignId: input.campaignId ?? null,
        channelId: input.channelId ?? null,
        talentName: input.talentName,
        url: input.url,
        shortCode: input.shortCode ?? null,
        commissionType: input.commissionType,
        commissionRate: input.commissionRate,
        notes: input.notes ?? null,
      });
      return { id: (result as any).insertId };
    }),

  updateLink: protectedProcedure
    .input(z.object({
      id: z.number(),
      url: z.string().url().optional(),
      commissionType: z.enum(["flat", "cpc", "cpa", "revenue_share"]).optional(),
      commissionRate: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(affiliateLinks).set({
        ...(rest.url !== undefined && { url: rest.url }),
        ...(rest.commissionType !== undefined && { commissionType: rest.commissionType }),
        ...(rest.commissionRate !== undefined && { commissionRate: rest.commissionRate }),
        ...(rest.notes !== undefined && { notes: rest.notes }),
        ...(rest.isActive !== undefined && { isActive: rest.isActive }),
      }).where(eq(affiliateLinks.id, id));
      return { ok: true };
    }),

  addSnapshot: protectedProcedure
    .input(z.object({
      linkId: z.number(),
      snapshotDate: z.string().optional(),
      clicks: z.number().default(0),
      conversions: z.number().default(0),
      revenueGenerated: z.string().default("0"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(affiliateSnapshots).values({
        linkId: input.linkId,
        snapshotDate: input.snapshotDate ?? todayStr(),
        clicks: input.clicks,
        conversions: input.conversions,
        revenueGenerated: input.revenueGenerated,
        notes: input.notes ?? null,
      });
      return { ok: true };
    }),

  getSnapshots: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(affiliateSnapshots)
        .where(eq(affiliateSnapshots.linkId, input.linkId))
        .orderBy(desc(affiliateSnapshots.snapshotDate));
    }),

  // Full talent profile — channel info, view trend, top videos, campaign history, affiliate links, results
  talentProfile: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { channelId } = input;

      const [channel] = await db
        .select()
        .from(youtubeChannels)
        .where(eq(youtubeChannels.channelId, channelId))
        .limit(1);
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });

      // Step 1: get all videos for this channel using Drizzle ORM (avoids prepared statement issues)

      const channelVideos = await db
        .select({ videoId: videos.videoId })
        .from(videos)
        .where(eq(videos.channelId, channelId));
      const videoIds = channelVideos.map(v => v.videoId);

      // Step 2: get all view_count rows for those videos, sorted by date desc
      let allVideoStats: Array<any> = [];
      if (videoIds.length > 0) {
        const vcRows = await db
          .select({
            videoId: viewCounts.videoId,
            viewCount: viewCounts.viewCount,
            likes: viewCounts.likes,
            comments: viewCounts.comments,
            date: viewCounts.date,
          })
          .from(viewCounts)
          .where(inArray(viewCounts.videoId, videoIds))
          .orderBy(desc(viewCounts.date));

        // Join with video metadata
        const videoMeta = await db
          .select({
            videoId: videos.videoId,
            title: videos.title,
            publishedAt: videos.publishedDate,
            durationSeconds: videos.durationSeconds,
            thumbnailUrl: videos.thumbnailUrl,
          })
          .from(videos)
          .where(inArray(videos.videoId, videoIds));
        const metaMap = new Map(videoMeta.map(v => [v.videoId, v]));
        allVideoStats = vcRows.map(vc => ({ ...vc, ...metaMap.get(vc.videoId) }));
      }

      // Deduplicate: keep only the latest row per video_id
      const seenVideoIds = new Set<string>();
      const latestVideoStats: Array<any> = [];
      for (const row of allVideoStats) {
        const vid = row.videoId ?? row.video_id;
        if (!seenVideoIds.has(vid)) {
          seenVideoIds.add(vid);
          latestVideoStats.push(row);
        }
      }
      const totalViews = latestVideoStats.reduce((sum, r) => sum + Number(r.viewCount ?? r.view_count ?? 0), 0);
      const topVideos = [...latestVideoStats]
        .sort((a, b) => Number(b.viewCount ?? b.view_count ?? 0) - Number(a.viewCount ?? a.view_count ?? 0))
        .slice(0, 10);

      // View trend: last 30 days — group by date
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]!;
      const trendRows = videoIds.length > 0
        ? await db
            .select({ date: viewCounts.date, viewCount: viewCounts.viewCount, videoId: viewCounts.videoId })
            .from(viewCounts)
            .where(and(
              inArray(viewCounts.videoId, videoIds),
              gte(viewCounts.date, thirtyDaysAgoStr)
            ))
            .orderBy(viewCounts.date)
        : [];
      // Aggregate by date
      const trendMap = new Map<string, number>();
      for (const r of trendRows) {
        trendMap.set(r.date, (trendMap.get(r.date) ?? 0) + Number(r.viewCount ?? 0));
      }
      const viewTrend = Array.from(trendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total_views]) => ({ date, total_views }));

      // Deliverables: multi-step ORM queries to avoid TiDB prepared statement issues
      const cdRows = await db
        .select({
          id: campaignDeliverables.id,
          talentName: campaignDeliverables.talentName,
          contentType: campaignDeliverables.contentType,
          dueDate: campaignDeliverables.dueDate,
          status: campaignDeliverables.status,
          agreedFee: campaignDeliverables.agreedFee,
          briefNotes: campaignDeliverables.briefNotes,
          videoId: campaignDeliverables.videoId,
          campaignId: campaignDeliverables.campaignId,
          createdAt: campaignDeliverables.createdAt,
        })
        .from(campaignDeliverables)
        .where(eq(campaignDeliverables.channelId, channelId))
        .orderBy(desc(campaignDeliverables.createdAt));

      // Enrich with campaign + client names
      const campaignIds = Array.from(new Set(cdRows.map(r => r.campaignId).filter(Boolean))) as number[];
      const campaignRows = campaignIds.length > 0
        ? await db.select({ id: campaigns.id, name: campaigns.name, status: campaigns.status, clientId: campaigns.clientId }).from(campaigns).where(inArray(campaigns.id, campaignIds))
        : [];
      const clientIds = Array.from(new Set(campaignRows.map(r => r.clientId).filter(Boolean))) as number[];
      const clientRows = clientIds.length > 0
        ? await db.select({ id: clients.id, companyName: clients.companyName }).from(clients).where(inArray(clients.id, clientIds))
        : [];
      const campaignMap = new Map(campaignRows.map(c => [c.id, c]));
      const clientMap = new Map(clientRows.map(c => [c.id, c]));
      const deliverables = cdRows.map(cd => {
        const camp = campaignMap.get(cd.campaignId!);
        const cli = camp ? clientMap.get(camp.clientId!) : undefined;
        return { ...cd, campaign_id: cd.campaignId, campaign_name: camp?.name, campaign_status: camp?.status, client_name: cli?.companyName };
      });

      // Affiliate links: multi-step ORM queries
      const alRows = await db
        .select()
        .from(affiliateLinks)
        .where(eq(affiliateLinks.channelId, channelId))
        .orderBy(desc(affiliateLinks.createdAt));
      const alIds = alRows.map(al => al.id);
      const snapRows = alIds.length > 0
        ? await db.select({ linkId: affiliateSnapshots.linkId, clicks: affiliateSnapshots.clicks, conversions: affiliateSnapshots.conversions, revenue: affiliateSnapshots.revenueGenerated }).from(affiliateSnapshots).where(inArray(affiliateSnapshots.linkId, alIds))
        : [];
      const alCampaignIds = Array.from(new Set(alRows.map(al => al.campaignId).filter(Boolean))) as number[];
      const alCampaignRows = alCampaignIds.length > 0
        ? await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, alCampaignIds))
        : [];
      const alCampaignMap = new Map(alCampaignRows.map(c => [c.id, c]));
      const affLinks = alRows.map(al => {
        const snaps = snapRows.filter(s => s.linkId === al.id);
        const totalClicks = snaps.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
        const totalConversions = snaps.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
        const totalRevenue = snaps.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
        return { ...al, campaign_name: alCampaignMap.get(al.campaignId!)?.name, total_clicks: totalClicks, total_conversions: totalConversions, total_revenue: totalRevenue };
      });

      // Talent results: multi-step ORM queries
      const trRows = await db
        .select()
        .from(talentResults)
        .orderBy(desc(talentResults.createdAt));
      // Filter to only results whose deliverable belongs to this channel
      const deliverableIds = cdRows.map(d => d.id);
      const filteredResults = deliverableIds.length > 0
        ? trRows.filter(tr => deliverableIds.includes(tr.deliverableId!))
        : [];
      const results = filteredResults.map(tr => {
        const cd = cdRows.find(d => d.id === tr.deliverableId);
        const camp = cd ? campaignMap.get(cd.campaignId!) : undefined;
        return { ...tr, content_type: cd?.contentType, due_date: cd?.dueDate, campaign_name: camp?.name };
      });

      // totalViews already computed above from latestVideoStats

      // Total affiliate revenue already computed from affLinks above
      const totalAffiliateRevenue = affLinks.reduce((s, al) => s + Number(al.total_revenue ?? 0), 0);

      return {
        channel,
        totalViews,
        totalAffiliateRevenue,
        campaignCount: deliverables.length,
        viewTrend,
        topVideos,
        deliverables,
        affiliateLinks: affLinks,
        results,
      };
    }),

  // Talent stats aggregation — total views, campaigns, affiliate revenue per channel
  talentStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const channels = await db.select().from(youtubeChannels).where(eq(youtubeChannels.isActive, true));

    const stats = await Promise.all(channels.map(async (ch) => {
      // Total views: sum of latest view_count per video for this channel
      // Total views: fetch all view_counts for channel, deduplicate by latest date in app code
      // Total views: ORM-based two-step query
      const chVideos = await db.select({ videoId: videos.videoId }).from(videos).where(eq(videos.channelId, ch.channelId));
      const chVideoIds = chVideos.map(v => v.videoId);
      let totalViews = 0;
      if (chVideoIds.length > 0) {
        const vcAll = await db.select({ videoId: viewCounts.videoId, viewCount: viewCounts.viewCount, date: viewCounts.date }).from(viewCounts).where(inArray(viewCounts.videoId, chVideoIds)).orderBy(desc(viewCounts.date));
        const seenVids = new Set<string>();
        for (const r of vcAll) {
          if (!seenVids.has(r.videoId)) {
            seenVids.add(r.videoId);
            totalViews += Number(r.viewCount ?? 0);
          }
        }
      }

      // Campaign count: ORM-based
      const chDeliverables = await db.select({ campaignId: campaignDeliverables.campaignId }).from(campaignDeliverables).where(eq(campaignDeliverables.channelId, ch.channelId));
      const campaignCount = new Set(chDeliverables.map(d => d.campaignId)).size;

      // Affiliate revenue: ORM-based
      const chAffLinks = await db.select({ id: affiliateLinks.id }).from(affiliateLinks).where(eq(affiliateLinks.channelId, ch.channelId));
      const chAffIds = chAffLinks.map(al => al.id);
      let affiliateRevenue = 0;
      if (chAffIds.length > 0) {
        const revRows = await db.select({ rev: affiliateSnapshots.revenueGenerated }).from(affiliateSnapshots).where(inArray(affiliateSnapshots.linkId, chAffIds));
        affiliateRevenue = revRows.reduce((s, r) => s + Number(r.rev ?? 0), 0);
      }

      return {
        channelId: ch.channelId,
        channelName: ch.channelName,
        thumbnailUrl: ch.thumbnailUrl,
        subscriberCount: ch.subscriberCount,
        totalViews,
        campaignCount,
        affiliateRevenue,
      };
    }));

    return stats;
  }),
});

// ─── Invoices Router ──────────────────────────────────────────────────────────

export const invoicesRouter = router({
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          invoice: invoices,
          client: { companyName: clients.companyName },
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .where(input?.clientId ? eq(invoices.clientId, input.clientId) : undefined)
        .orderBy(desc(invoices.createdAt));
      return rows;
    }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db
      .select({
        invoice: invoices,
        client: { id: clients.id, companyName: clients.companyName, contactEmail: clients.contactEmail, billingAddress: clients.billingAddress },
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.id, input.id))
      .limit(1);
    if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });

    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, input.id))
      .orderBy(invoiceLineItems.sortOrder);

    return { ...rows[0], lineItems };
  }),

  create: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      campaignId: z.number().optional(),
      currency: z.string().default("USD"),
      issuedDate: z.string().optional(),
      dueDate: z.string().optional(),
      taxRate: z.string().default("0"),
      notes: z.string().optional(),
      lineItems: z.array(z.object({
        description: z.string().min(1),
        quantity: z.string().default("1"),
        unitPrice: z.string().default("0"),
      })).default([]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const invoiceNumber = await nextInvoiceNumber();
      const subtotal = input.lineItems.reduce(
        (sum: number, li: { description: string; quantity: string; unitPrice: string }) =>
          sum + parseFloat(li.quantity) * parseFloat(li.unitPrice),
        0
      );
      const taxAmount = subtotal * parseFloat(input.taxRate) / 100;
      const total = subtotal + taxAmount;

      const [result] = await db.insert(invoices).values({
        invoiceNumber,
        clientId: input.clientId,
        campaignId: input.campaignId ?? null,
        currency: input.currency,
        issuedDate: input.issuedDate ?? todayStr(),
        dueDate: input.dueDate ?? null,
        taxRate: input.taxRate,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        notes: input.notes ?? null,
      });
      const invoiceId = (result as any).insertId;

      if (input.lineItems.length > 0) {
        await db.insert(invoiceLineItems).values(
          input.lineItems.map((li: { description: string; quantity: string; unitPrice: string }, i: number) => ({
            invoiceId,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            total: (parseFloat(li.quantity) * parseFloat(li.unitPrice)).toFixed(2),
            sortOrder: i,
          }))
        );
      }

      return { id: invoiceId, invoiceNumber };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
      paidDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(invoices).set({
        status: input.status,
        ...(input.paidDate && { paidDate: input.paidDate }),
      }).where(eq(invoices.id, input.id));
      return { ok: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      notes: z.string().optional(),
      dueDate: z.string().optional(),
      issuedDate: z.string().optional(),
      taxRate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(invoices).set({
        ...(rest.notes !== undefined && { notes: rest.notes }),
        ...(rest.dueDate !== undefined && { dueDate: rest.dueDate }),
        ...(rest.issuedDate !== undefined && { issuedDate: rest.issuedDate }),
        ...(rest.taxRate !== undefined && { taxRate: rest.taxRate }),
      }).where(eq(invoices.id, id));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, input.id));
      await db.delete(invoices).where(eq(invoices.id, input.id));
      return { ok: true };
    }),

  generateFromCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number(), clientId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const deliverables = await db
        .select()
        .from(campaignDeliverables)
        .where(eq(campaignDeliverables.campaignId, input.campaignId));

      const lineItemsInput = deliverables.map((d) => ({
        description: `${d.contentType.replace(/_/g, " ")} — ${d.talentName}`,
        quantity: "1",
        unitPrice: d.agreedFee ?? "0",
      }));

      const invoiceNumber = await nextInvoiceNumber();
      const subtotal = lineItemsInput.reduce(
        (sum: number, li: { description: string; quantity: string; unitPrice: string }) =>
          sum + parseFloat(li.quantity) * parseFloat(li.unitPrice),
        0
      );

      const [result] = await db.insert(invoices).values({
        invoiceNumber,
        clientId: input.clientId,
        campaignId: input.campaignId,
        currency: "USD",
        issuedDate: todayStr(),
        subtotal: subtotal.toFixed(2),
        taxAmount: "0",
        total: subtotal.toFixed(2),
      });
      const invoiceId = (result as any).insertId;

      if (lineItemsInput.length > 0) {
        await db.insert(invoiceLineItems).values(
          lineItemsInput.map((li: { description: string; quantity: string; unitPrice: string }, i: number) => ({
            invoiceId,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            total: (parseFloat(li.quantity) * parseFloat(li.unitPrice)).toFixed(2),
            sortOrder: i,
          }))
        );
      }

      return { id: invoiceId, invoiceNumber };
    }),
});

// ─── Emails Router ────────────────────────────────────────────────────────────

export const emailsRouter = router({
  listTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
  }),

  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["brief", "invoice", "follow_up", "results", "general"]).default("general"),
      subject: z.string().min(1),
      bodyHtml: z.string().min(1),
      variablesUsed: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(emailTemplates).values({
        name: input.name,
        type: input.type,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        variablesUsed: input.variablesUsed ?? null,
      });
      return { id: (result as any).insertId };
    }),

  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      subject: z.string().optional(),
      bodyHtml: z.string().optional(),
      variablesUsed: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(emailTemplates).set({
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.subject !== undefined && { subject: rest.subject }),
        ...(rest.bodyHtml !== undefined && { bodyHtml: rest.bodyHtml }),
        ...(rest.variablesUsed !== undefined && { variablesUsed: rest.variablesUsed }),
        ...(rest.isActive !== undefined && { isActive: rest.isActive }),
      }).where(eq(emailTemplates.id, id));
      return { ok: true };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));
      return { ok: true };
    }),

  listLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(emailLogs)
        .orderBy(desc(emailLogs.createdAt))
        .limit(input?.limit ?? 50);
    }),

  sendEmail: protectedProcedure
    .input(z.object({
      templateId: z.number().optional(),
      recipientEmail: z.string().email(),
      recipientName: z.string().optional(),
      recipientType: z.enum(["client", "talent", "internal"]).default("client"),
      subject: z.string().min(1),
      bodyHtml: z.string().min(1),
      relatedType: z.string().optional(),
      relatedId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const resendKey = process.env.RESEND_API_KEY;
      let status: "sent" | "failed" | "queued" = "queued";
      let errorMessage: string | null = null;

      if (resendKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Agency <noreply@resend.dev>",
              to: [input.recipientEmail],
              subject: input.subject,
              html: input.bodyHtml,
            }),
          });
          status = res.ok ? "sent" : "failed";
          if (!res.ok) errorMessage = await res.text();
        } catch (e) {
          status = "failed";
          errorMessage = String(e);
        }
      }

      await db.insert(emailLogs).values({
        templateId: input.templateId ?? null,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        recipientType: input.recipientType,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        status,
        errorMessage,
        sentAt: status === "sent" ? new Date() : null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
      });

      return { ok: true, status };
    }),
});

// ─── Talent Results Router ────────────────────────────────────────────────────

export const talentResultsRouter = router({
  getByDeliverable: protectedProcedure
    .input(z.object({ deliverableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(talentResults)
        .where(eq(talentResults.deliverableId, input.deliverableId))
        .limit(1);
      return rows[0] ?? null;
    }),

  upsert: protectedProcedure
    .input(z.object({
      deliverableId: z.number(),
      reportingWindowDays: z.number().default(30),
      views: z.number().default(0),
      likes: z.number().default(0),
      comments: z.number().default(0),
      shares: z.number().default(0),
      reach: z.number().default(0),
      impressions: z.number().default(0),
      engagementRate: z.string().default("0"),
      linkClicks: z.number().default(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db
        .select({ id: talentResults.id, lockedAt: talentResults.lockedAt })
        .from(talentResults)
        .where(eq(talentResults.deliverableId, input.deliverableId))
        .limit(1);

      if (existing[0]?.lockedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Results are locked and cannot be edited." });
      }

      if (existing[0]) {
        await db.update(talentResults).set({
          reportingWindowDays: input.reportingWindowDays,
          views: input.views,
          likes: input.likes,
          comments: input.comments,
          shares: input.shares,
          reach: input.reach,
          impressions: input.impressions,
          engagementRate: input.engagementRate,
          linkClicks: input.linkClicks,
          notes: input.notes ?? null,
        }).where(eq(talentResults.deliverableId, input.deliverableId));
      } else {
        await db.insert(talentResults).values({
          deliverableId: input.deliverableId,
          reportingWindowDays: input.reportingWindowDays,
          views: input.views,
          likes: input.likes,
          comments: input.comments,
          shares: input.shares,
          reach: input.reach,
          impressions: input.impressions,
          engagementRate: input.engagementRate,
          linkClicks: input.linkClicks,
          notes: input.notes ?? null,
        });
      }
      return { ok: true };
    }),

  lock: protectedProcedure
    .input(z.object({ deliverableId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(talentResults).set({ lockedAt: new Date() })
        .where(eq(talentResults.deliverableId, input.deliverableId));
      return { ok: true };
    }),

  listAll: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        result: talentResults,
        deliverable: {
          id: campaignDeliverables.id,
          talentName: campaignDeliverables.talentName,
          contentType: campaignDeliverables.contentType,
          campaignId: campaignDeliverables.campaignId,
        },
      })
      .from(talentResults)
      .leftJoin(campaignDeliverables, eq(talentResults.deliverableId, campaignDeliverables.id))
      .orderBy(desc(talentResults.createdAt));
  }),
});
