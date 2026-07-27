import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const reservationSchema = z.object({
  occurrenceId: z.string().uuid(),
  cedula: z.string().min(1).max(32),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gymId: string }> }
) {
  const { gymId } = await params;
  const supabase = createClient();
  const requestedDays = Number(new URL(request.url).searchParams.get("days"));
  const daysAhead = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.floor(requestedDays), 8), 21) : 8;

  await supabase.rpc("generate_upcoming_class_occurrences", { days_ahead: daysAhead });

  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("name, logo_url")
    .eq("id", gymId)
    .maybeSingle();

  if (gymError || !gym) {
    console.error("Error loading public gym for classes", gymError);
    return NextResponse.json({ error: "No se pudo cargar la información del gimnasio." }, { status: 404 });
  }

  const { data: occurrences, error } = await supabase
    .from("class_occurrences")
    .select("id, title, starts_at, ends_at, capacity, notes")
    .eq("gym_id", gymId)
    .gt("starts_at", new Date().toISOString())
    .lt("starts_at", new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Error loading public classes", error);
    return NextResponse.json({ error: "No se pudieron cargar las clases." }, { status: 500 });
  }

  const ids = (occurrences ?? []).map((occurrence) => occurrence.id);
  const { data: reservations } = ids.length
    ? await supabase.from("class_reservations").select("occurrence_id").in("occurrence_id", ids)
    : { data: [] as { occurrence_id: string }[] };
  const reservedByOccurrence = (reservations ?? []).reduce<Record<string, number>>((counts, reservation) => {
    counts[reservation.occurrence_id] = (counts[reservation.occurrence_id] ?? 0) + 1;
    return counts;
  }, {});

  return NextResponse.json({
    gym: {
      name: typeof gym.name === "string" && gym.name.trim() ? gym.name : null,
      logoUrl: typeof gym.logo_url === "string" && gym.logo_url.trim() ? gym.logo_url : null,
    },
    classes: occurrences ?? [],
    reservedByOccurrence,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gymId: string }> }
) {
  const { gymId } = await params;
  const parsed = reservationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ingresa una cédula válida." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("reserve_class_occurrence", {
    p_gym_id: gymId,
    p_occurrence_id: parsed.data.occurrenceId,
    p_cedula: parsed.data.cedula,
  });
  if (error) {
    console.error("Error reserving class", error);
    return NextResponse.json({ error: "No se pudo confirmar la reserva." }, { status: 500 });
  }

  const result = data as { ok?: boolean; code?: string; member_name?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      invalid_cedula: "Ingresa una cédula válida.",
      member_not_active: "No pudimos validar una membresía activa. Contactate con el gimnasio.",
      unavailable: "Esta clase ya no está disponible.",
      started: "La clase ya comenzó.",
      full: "Esta clase ya alcanzó su cupo.",
      already_reserved: "Ya tienes una reserva para esta clase.",
    };
    return NextResponse.json({ error: messages[result?.code ?? ""] ?? "No se pudo confirmar la reserva." }, { status: 409 });
  }

  return NextResponse.json({ data: { memberName: result.member_name } }, { status: 201 });
}
