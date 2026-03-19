import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: result, error } = await supabase
      .from("scan_results")
      .select("*")
      .eq("job_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load scan results" },
        { status: 500 }
      );
    }

    if (!result) {
      return NextResponse.json({
        exists: false,
        result: null,
      });
    }

    const raw = result.raw_summary_json ?? {};
    const inboxHealth = result.inbox_health_summary ?? {};
    const promotionsSummary = result.promotions_summary ?? {};
    const smartViewsSummary = result.smart_views_summary ?? {};

    return NextResponse.json({
      exists: true,
      result: {
        mode: raw.mode ?? inboxHealth.mode ?? "full",
        scanned: raw.scanned ?? inboxHealth.scanned ?? 0,
        totalInboxCount: raw.totalInboxCount ?? inboxHealth.totalInboxCount ?? null,
        topSenders: result.top_senders ?? [],
        promotionsSenders:
          raw.promotionsSenders ??
          promotionsSummary.senders ??
          [],
        promotionsFound:
          raw.promotionsFound ??
          promotionsSummary.promotionsFound ??
          0,
        promotionsFoundInSampleScan:
          raw.promotionsFoundInSampleScan ??
          promotionsSummary.promotionsFoundInSampleScan ??
          0,
        fullInboxPromotionsCount:
          raw.fullInboxPromotionsCount ??
          promotionsSummary.fullInboxPromotionsCount ??
          null,
        senderGroups:
          raw.senderGroups ??
          inboxHealth.senderGroups ??
          0,
        largestSenderCount:
          raw.largestSenderCount ??
          inboxHealth.largestSenderCount ??
          0,
        healthScore:
          raw.healthScore ??
          inboxHealth.healthScore ??
          0,
        smartViews:
          raw.smartViews ??
          smartViewsSummary.counts ?? {
            unread: 0,
            social: 0,
            jobSearch: 0,
            shopping: 0,
          },
        smartViewIds:
          raw.smartViewIds ??
          smartViewsSummary.ids ?? {
            unread: [],
            social: [],
            jobSearch: [],
            shopping: [],
          },
        completed:
          raw.completed ??
          inboxHealth.completed ??
          false,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}