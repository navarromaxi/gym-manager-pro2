import { NextRequest, NextResponse } from "next/server";

import { POST as syncFacialAccess } from "@/app/api/facial-access/route";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: configs, error } = await supabase
    .from("fusionar_integration_configs")
    .select("gym_id")
    .eq("is_enabled", true);
  if (error) return NextResponse.json({ error: "Unable to load facial integrations" }, { status: 500 });

  const results: Array<{ gymId: string; members: boolean; accesses: boolean }> = [];
  for (const config of configs ?? []) {
    const headers = {
      "Content-Type": "application/json",
      "x-fusionar-cron-secret": cronSecret,
    };
    const run = (action: "sync_members" | "sync_accesses") =>
      syncFacialAccess(
        new Request("http://cron.local/api/facial-access", {
          method: "POST",
          headers,
          body: JSON.stringify({ gymId: config.gym_id, action }),
        })
      );
    const membersResponse = await run("sync_members");
    const accessesResponse = await run("sync_accesses");
    results.push({ gymId: config.gym_id, members: membersResponse?.ok ?? false, accesses: accessesResponse?.ok ?? false });
  }

  return NextResponse.json({ processed: results.length, results });
}
