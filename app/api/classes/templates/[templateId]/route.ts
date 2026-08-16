import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGymRequest } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase-server";

const bodySchema = z.object({ gymId: z.string().min(1), title: z.string().trim().min(1).max(120), weekday: z.number().int().min(1).max(7), startTime: z.string().regex(/^\d{2}:\d{2}$/), duration: z.number().int().min(15).max(480), capacity: z.number().int().min(1), notes: z.string().nullable() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Los datos del horario no son válidos." }, { status: 400 });
  const authorization = await authorizeGymRequest(request, body.data.gymId);
  if ("error" in authorization) return authorization.error;
  const { templateId } = await params;
  const supabase = createClient();
  const { data: occurrences, error: occurrenceError } = await supabase.from("class_occurrences").select("id").eq("gym_id", body.data.gymId).eq("template_id", templateId).gt("starts_at", new Date().toISOString());
  if (occurrenceError) return NextResponse.json({ error: "No pudimos revisar las próximas clases." }, { status: 500 });
  const occurrenceIds = (occurrences ?? []).map((item) => item.id);
  if (occurrenceIds.length) {
    const { count, error: reservationError } = await supabase.from("class_reservations").select("id", { count: "exact", head: true }).in("occurrence_id", occurrenceIds);
    if (reservationError) return NextResponse.json({ error: "No pudimos revisar las reservas existentes." }, { status: 500 });
    if (count) return NextResponse.json({ error: "No podés editar este horario porque ya hay personas anotadas en próximas clases. Gestioná esas reservas primero." }, { status: 409 });
  }
  const { data: template, error: updateError } = await supabase.from("class_templates").update({ title: body.data.title, weekday: body.data.weekday, start_time: body.data.startTime, duration_minutes: body.data.duration, capacity: body.data.capacity, notes: body.data.notes }).eq("id", templateId).eq("gym_id", body.data.gymId).select().single();
  if (updateError || !template) return NextResponse.json({ error: "No pudimos actualizar el horario." }, { status: 500 });
  if (occurrenceIds.length) {
    const { error: deleteError } = await supabase.from("class_occurrences").delete().in("id", occurrenceIds);
    if (deleteError) return NextResponse.json({ error: "El horario se guardó, pero no pudimos regenerar sus próximas clases." }, { status: 500 });
  }
  return NextResponse.json({ template });
}
