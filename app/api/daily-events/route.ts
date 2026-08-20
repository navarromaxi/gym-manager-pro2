import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGymRequest } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase-server";

const schema = z.object({
  gymId: z.string().min(1), title: z.string().trim().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/), end_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_interval_minutes: z.coerce.number().int().min(5).max(240), capacity_per_slot: z.coerce.number().int().min(1).max(100),
  notes: z.string().nullable().optional(), accept_receipts: z.boolean().optional().default(false),
});

const minutes = (value: string) => { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; };
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export async function GET(request: Request) {
  const gymId = new URL(request.url).searchParams.get("gymId") ?? "";
  const authorization = await authorizeGymRequest(request, gymId);
  if (authorization.error) return authorization.error;
  const { data, error } = await createClient().from("daily_events").select("id, gym_id, title, date, start_time, end_time, slot_interval_minutes, capacity_per_slot, accept_receipts, notes, created_at").eq("gym_id", gymId).order("date").order("start_time");
  if (error) return NextResponse.json({ error: "No se pudieron cargar los eventos diarios." }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Revisa los datos de la agenda diaria." }, { status: 400 });
    if (minutes(parsed.data.end_time) <= minutes(parsed.data.start_time)) return NextResponse.json({ error: "La hora de fin debe ser posterior a la de inicio." }, { status: 400 });
    const authorization = await authorizeGymRequest(request, parsed.data.gymId);
    if (authorization.error) return authorization.error;
    const supabase = createClient();
    const { data: event, error } = await supabase.from("daily_events").insert({
      gym_id: parsed.data.gymId,
      title: parsed.data.title,
      date: parsed.data.date,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      slot_interval_minutes: parsed.data.slot_interval_minutes,
      capacity_per_slot: parsed.data.capacity_per_slot,
      notes: parsed.data.notes ?? null,
      accept_receipts: parsed.data.accept_receipts,
    }).select("id, gym_id, title, date, start_time, end_time, slot_interval_minutes, capacity_per_slot, accept_receipts, notes, created_at").single();
    if (error || !event) throw error ?? new Error("No se pudo crear el evento.");
    const slots = [];
    for (let start = minutes(parsed.data.start_time); start < minutes(parsed.data.end_time); start += parsed.data.slot_interval_minutes) {
      slots.push({ gym_id: parsed.data.gymId, daily_event_id: event.id, title: parsed.data.title, date: parsed.data.date, start_time: time(start), capacity: parsed.data.capacity_per_slot, price: null, notes: parsed.data.notes ?? null, accept_receipts: parsed.data.accept_receipts });
    }
    const { error: slotsError } = await supabase.from("class_sessions").insert(slots);
    if (slotsError) { await supabase.from("daily_events").delete().eq("id", event.id); throw slotsError; }
    return NextResponse.json({ event, slots: slots.length }, { status: 201 });
  } catch (error) {
    console.error("Error creando evento diario", error);
    return NextResponse.json({ error: "No se pudo crear la agenda diaria. Intenta nuevamente." }, { status: 500 });
  }
}
