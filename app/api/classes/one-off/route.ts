import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGymRequest } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase-server";

const bodySchema = z.object({
  gymId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().int().min(15).max(480),
  capacity: z.number().int().min(1),
  notes: z.string().max(1000).nullable(),
  suspendConflicts: z.boolean(),
});

export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Los datos de la clase puntual no son válidos." }, { status: 400 });
  const authorization = await authorizeGymRequest(request, body.data.gymId);
  if ("error" in authorization) return authorization.error;

  const startsAt = new Date(`${body.data.date}T${body.data.startTime}:00-03:00`);
  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) return NextResponse.json({ error: "Elegí una fecha y hora futuras para la clase puntual." }, { status: 400 });
  const endsAt = new Date(startsAt.getTime() + body.data.duration * 60_000);
  const supabase = createClient();

  const { data: conflicts, error: conflictError } = await supabase
    .from("class_occurrences")
    .select("id, title")
    .eq("gym_id", body.data.gymId)
    .eq("is_cancelled", false)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());
  if (conflictError) return NextResponse.json({ error: "No pudimos comprobar los horarios existentes." }, { status: 500 });

  const conflictIds = (conflicts ?? []).map((item) => item.id);
  if (body.data.suspendConflicts && conflictIds.length) {
    const { count, error: reservationsError } = await supabase
      .from("class_reservations")
      .select("id", { count: "exact", head: true })
      .in("occurrence_id", conflictIds);
    if (reservationsError) return NextResponse.json({ error: "No pudimos comprobar las reservas de las clases que se superponen." }, { status: 500 });
    if (count) return NextResponse.json({ error: "No se pueden suspender clases que ya tienen personas anotadas. Elegí otro horario o gestioná esas reservas primero." }, { status: 409 });
    const { error: suspendError } = await supabase.from("class_occurrences").update({ is_cancelled: true }).in("id", conflictIds);
    if (suspendError) return NextResponse.json({ error: "No pudimos suspender las clases que se superponen." }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("class_occurrences").insert({
    template_id: null,
    gym_id: body.data.gymId,
    title: body.data.title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    capacity: body.data.capacity,
    notes: body.data.notes,
    is_cancelled: false,
  });
  if (insertError) return NextResponse.json({ error: "No pudimos crear la clase puntual." }, { status: 500 });
  return NextResponse.json({ ok: true, suspended: body.data.suspendConflicts ? conflictIds.length : 0 }, { status: 201 });
}
