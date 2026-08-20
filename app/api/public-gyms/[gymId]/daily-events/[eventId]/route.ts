import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(_request: Request, context: { params: Promise<{ gymId: string; eventId: string }> }) {
  const { gymId, eventId } = await context.params;
  const supabase = createClient();
  const { data: event, error: eventError } = await supabase.from("daily_events").select("id, gym_id, title, date, start_time, end_time, slot_interval_minutes, capacity_per_slot, accept_receipts, notes, created_at").eq("id", eventId).eq("gym_id", gymId).maybeSingle();
  if (eventError) return NextResponse.json({ error: "No se pudo cargar la agenda." }, { status: 500 });
  if (!event) return NextResponse.json({ error: "La agenda no está disponible." }, { status: 404 });
  const { data: sessions, error: sessionsError } = await supabase.from("class_sessions").select("id, gym_id, title, date, start_time, capacity, price, notes, created_at, accept_receipts, daily_event_id").eq("daily_event_id", eventId).eq("gym_id", gymId).order("start_time");
  if (sessionsError) return NextResponse.json({ error: "No se pudieron cargar los horarios." }, { status: 500 });
  const ids = (sessions ?? []).map((session) => session.id);
  const occupiedSeats: Record<string, number> = {};
  if (ids.length) { const { data: registrations, error } = await supabase.from("class_registrations").select("session_id").in("session_id", ids); if (error) return NextResponse.json({ error: "No se pudo calcular la disponibilidad." }, { status: 500 }); for (const registration of registrations ?? []) occupiedSeats[registration.session_id] = (occupiedSeats[registration.session_id] ?? 0) + 1; }
  return NextResponse.json({ event, sessions: sessions ?? [], occupiedSeats });
}
