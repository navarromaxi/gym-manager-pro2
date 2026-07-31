import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const now = new Date();
  const archiveBefore = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const deleteBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const archiveDate = archiveBefore.toISOString();

  const [openedResult, neverOpenedResult, deletedResult] = await Promise.all([
    supabase.from("routines").update({ archived_at: now.toISOString() }).not("member_id", "is", null).is("archived_at", null).lt("last_opened_at", archiveDate).select("id"),
    supabase.from("routines").update({ archived_at: now.toISOString() }).not("member_id", "is", null).is("archived_at", null).is("last_opened_at", null).lt("created_date", archiveDate.slice(0, 10)).select("id"),
    supabase.from("routines").delete().not("member_id", "is", null).lt("archived_at", deleteBefore.toISOString()).select("id"),
  ]);

  const error = openedResult.error ?? neverOpenedResult.error ?? deletedResult.error;
  if (error) {
    console.error("Routine cleanup failed", error);
    return NextResponse.json({ error: "Routine cleanup failed" }, { status: 500 });
  }

  return NextResponse.json({
    archived: (openedResult.data?.length ?? 0) + (neverOpenedResult.data?.length ?? 0),
    deleted: deletedResult.data?.length ?? 0,
  });
}
