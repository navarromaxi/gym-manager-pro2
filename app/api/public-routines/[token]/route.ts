import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

type RoutineRow = {
  id: string; gym_id: string; member_id: string | null; name: string; description: string | null; duration: number | null;
  exercises: unknown; weekly_plan: unknown; valid_from: string | null; valid_until: string | null;
  day_intensities: Record<string, "green" | "yellow" | "red"> | null; plan_cycle: "weekly" | "biweekly" | "monthly" | null;
  cycle_plan: unknown;
};

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) return NextResponse.json({ error: "No encontramos esta rutina." }, { status: 404 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("routines")
    .select("id, gym_id, member_id, name, description, duration, exercises, weekly_plan, valid_from, valid_until, day_intensities, plan_cycle, cycle_plan")
    .eq("public_share_token", token)
    .eq("public_link_enabled", true)
    .is("archived_at", null)
    .maybeSingle();
  const routine = data as RoutineRow | null;
  if (error || !routine) return NextResponse.json({ error: "Este enlace ya no está disponible." }, { status: 404 });

  const today = new Date().toLocaleDateString("en-CA");
  if ((routine.valid_from && routine.valid_from > today) || (routine.valid_until && routine.valid_until < today)) {
    return NextResponse.json({ error: "Esta rutina no está vigente en este momento." }, { status: 404 });
  }

  const [{ data: gym }, { data: member }] = await Promise.all([
    supabase.from("gyms").select("name, logo_url").eq("id", routine.gym_id).maybeSingle(),
    routine.member_id ? supabase.from("members").select("name").eq("id", routine.member_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  await supabase.from("routines").update({ last_opened_at: new Date().toISOString() }).eq("id", routine.id);

  return NextResponse.json({
    gym: { id: routine.gym_id, name: gym?.name ?? null, logoUrl: gym?.logo_url ?? null },
    routine: {
      name: routine.name, description: routine.description ?? "", duration: routine.duration ?? 0,
      memberName: member?.name ?? null, exercises: Array.isArray(routine.exercises) ? routine.exercises : [],
      weeklyPlan: routine.weekly_plan && typeof routine.weekly_plan === "object" ? routine.weekly_plan : {},
      dayIntensities: routine.day_intensities ?? {}, planCycle: routine.plan_cycle ?? "weekly",
      cyclePlan: routine.cycle_plan && typeof routine.cycle_plan === "object" ? routine.cycle_plan : {},
      validFrom: routine.valid_from, validUntil: routine.valid_until,
    },
  });
}
