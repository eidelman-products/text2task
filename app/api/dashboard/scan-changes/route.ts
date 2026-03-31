import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ScanSnapshotRow = {
  id: string;
  user_id: string;
  scan_job_id: string | null;
  scan_type: "sample" | "full";
  emails_analyzed: number;
  promotions_count: number;
  sender_groups_count: number;
  inbox_health_score: number;
  ready_for_cleanup_count: number;
  top_sender_count: number;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("scan_snapshots")
      .select(
        `
          id,
          user_id,
          scan_job_id,
          scan_type,
          emails_analyzed,
          promotions_count,
          sender_groups_count,
          inbox_health_score,
          ready_for_cleanup_count,
          top_sender_count,
          created_at
        `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2);

    if (error) {
      console.error("Failed to load scan snapshots:", error);
      return NextResponse.json(
        { error: "Failed to load scan snapshots" },
        { status: 500 }
      );
    }

    const snapshots = (data ?? []) as ScanSnapshotRow[];
    const latest = snapshots[0] ?? null;
    const previous = snapshots[1] ?? null;

    return NextResponse.json({
      latest,
      previous,
      hasComparison: Boolean(latest && previous),
    });
  } catch (error) {
    console.error("Dashboard scan changes route failed:", error);
    return NextResponse.json(
      { error: "Failed to load scan changes" },
      { status: 500 }
    );
  }
}