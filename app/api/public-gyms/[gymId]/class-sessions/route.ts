import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const paramsSchema = z.object({
  gymId: z.string().min(1, "El identificador del gimnasio es obligatorio."),
});

/**
 * Public reservation data deliberately excludes attendee information. The
 * browser only needs the sessions and the number of occupied seats.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ gymId?: string }> }
) {
  const params = await context.params;
  const parsed = paramsSchema.safeParse({ gymId: params?.gymId });

  if (!parsed.success) {
    return NextResponse.json({ error: "El enlace de reservas no es válido." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("class_sessions")
    .select("id, gym_id, title, date, start_time, capacity, price, notes, created_at, accept_receipts")
    .eq("gym_id", parsed.data.gymId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (sessionsError) {
    console.error("Error loading public class sessions", sessionsError);
    return NextResponse.json({ error: "No se pudieron cargar las clases." }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const occupiedSeats: Record<string, number> = {};

  if (sessionIds.length > 0) {
    const { data: registrations, error: registrationsError } = await supabase
      .from("class_registrations")
      .select("session_id")
      .eq("gym_id", parsed.data.gymId)
      .in("session_id", sessionIds);

    if (registrationsError) {
      console.error("Error counting public class registrations", registrationsError);
      return NextResponse.json({ error: "No se pudo calcular la disponibilidad." }, { status: 500 });
    }

    for (const registration of registrations ?? []) {
      occupiedSeats[registration.session_id] =
        (occupiedSeats[registration.session_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    sessions: sessions ?? [],
    occupiedSeats,
  });
}
