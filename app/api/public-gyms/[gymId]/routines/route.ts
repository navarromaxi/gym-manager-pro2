import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const querySchema = z.string().trim().min(2).max(80);

type MemberRow = { id: string; name: string; cedula?: string | null };
type RoutineRow = { id: string; member_id?: string | null; name: string; description?: string | null; duration?: number | null; exercises?: unknown; weekly_plan?: unknown };

export async function GET(request: Request, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const search = querySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!search.success) return NextResponse.json({ error: "Ingresa al menos 2 caracteres para buscar." }, { status: 400 });

  const supabase = createClient();
  const { data: gym, error: gymError } = await supabase.from("gyms").select("name, logo_url").eq("id", gymId).maybeSingle();
  if (gymError || !gym) return NextResponse.json({ error: "No encontramos este gimnasio." }, { status: 404 });

  const term = search.data;
  const { data: nameMatches, error: membersError } = await supabase
    .from("members")
    .select("id, name, cedula")
    .eq("gym_id", gymId)
    .ilike("name", `%${term}%`)
    .order("name")
    .limit(8);
  if (membersError) {
    console.error("Error searching room members", membersError);
    return NextResponse.json({ error: "No pudimos buscar socios." }, { status: 500 });
  }

  let members = (nameMatches ?? []) as MemberRow[];
  if (/^\d+$/.test(term)) {
    const { data: cedulaMatches } = await supabase.from("members").select("id, name, cedula").eq("gym_id", gymId).eq("cedula", term).limit(1);
    members = [...members, ...((cedulaMatches ?? []) as MemberRow[]).filter((item) => !members.some((member) => member.id === item.id))].slice(0, 8);
  }
  if (!members.length) return NextResponse.json({ gym: { name: gym.name ?? null, logoUrl: gym.logo_url ?? null }, results: [] });

  const { data: routines, error: routinesError } = await supabase
    .from("routines")
    .select("id, member_id, name, description, duration, exercises, weekly_plan")
    .eq("gym_id", gymId)
    .in("member_id", members.map((member) => member.id));
  if (routinesError) {
    console.error("Error loading room routines", routinesError);
    return NextResponse.json({ error: "No pudimos cargar las rutinas." }, { status: 500 });
  }

  const routinesByMember = new Map<string, RoutineRow[]>();
  for (const routine of (routines ?? []) as RoutineRow[]) {
    if (!routine.member_id) continue;
    routinesByMember.set(routine.member_id, [...(routinesByMember.get(routine.member_id) ?? []), routine]);
  }
  const results = members.flatMap((member) => (routinesByMember.get(member.id) ?? []).map((routine) => ({
    member: { id: member.id, name: member.name },
    routine: { id: routine.id, name: routine.name, description: routine.description ?? "", duration: routine.duration ?? 0, exercises: Array.isArray(routine.exercises) ? routine.exercises : [], weeklyPlan: routine.weekly_plan && typeof routine.weekly_plan === "object" ? routine.weekly_plan : {} },
  })));

  return NextResponse.json({ gym: { name: gym.name ?? null, logoUrl: gym.logo_url ?? null }, results });
}
