import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const cancelSchema = z.object({
  occurrenceId: z.string().uuid(),
  cedula: z.string().min(1).max(32),
});

export async function GET(request: Request, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const cedula = new URL(request.url).searchParams.get("cedula") ?? "";
  if (!cedula.trim()) return NextResponse.json({ error: "Ingresa tu cédula." }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_class_reservations", { p_gym_id: gymId, p_cedula: cedula });
  if (error) {
    console.error("Error loading my class reservations", error);
    return NextResponse.json({ error: "No se pudieron cargar tus reservas." }, { status: 500 });
  }
  const reservations = (data ?? []).map((reservation: { occurrence_id: string; title: string; starts_at: string; ends_at: string; capacity: number; notes: string | null }) => ({
    id: reservation.occurrence_id,
    title: reservation.title,
    starts_at: reservation.starts_at,
    ends_at: reservation.ends_at,
    capacity: reservation.capacity,
    notes: reservation.notes,
  }));
  return NextResponse.json({ reservations });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos de cancelación inválidos." }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase.rpc("cancel_my_class_reservation", {
    p_gym_id: gymId,
    p_occurrence_id: parsed.data.occurrenceId,
    p_cedula: parsed.data.cedula,
  });
  if (error) {
    console.error("Error cancelling class reservation", error);
    return NextResponse.json({ error: "No se pudo cancelar la reserva." }, { status: 500 });
  }
  const result = data as { ok?: boolean; code?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      too_late: "Esta reserva ya no se puede cancelar porque falta una hora o menos para la clase.",
      not_found: "No encontramos esa reserva.",
      invalid_cedula: "Ingresa una cédula válida.",
    };
    return NextResponse.json({ error: messages[result?.code ?? ""] ?? "No se pudo cancelar la reserva." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
