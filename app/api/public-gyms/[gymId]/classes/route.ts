import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const reservationSchema = z.object({
  occurrenceId: z.string().uuid(),
  cedula: z.string().min(1).max(32),
});

type ReservationResult = { ok?: boolean; code?: string; member_name?: string; member_email?: string | null; next_payment?: string | null };

function formatClassDate(value: string) {
  return new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Montevideo" }).format(new Date(value));
}

function daysUntilPayment(nextPayment: string) {
  const target = nextPayment.slice(0, 10).split("-").map(Number);
  if (target.length !== 3 || target.some(Number.isNaN)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Math.round((Date.UTC(target[0], target[1] - 1, target[2]) - Date.UTC(get("year"), get("month") - 1, get("day"))) / 86_400_000);
}

async function sendReservationConfirmation({ email, name, gymName, classTitle, startsAt, classesUrl, nextPayment }: { email: string; name?: string; gymName?: string | null; classTitle: string; startsAt: string; classesUrl: string; nextPayment?: string | null }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  const days = nextPayment ? daysUntilPayment(nextPayment) : null;
  const paymentNote = days === null || days > 15 ? "" : days >= 5
    ? `<p style="margin:20px 0 0;padding:14px 16px;border-radius:12px;background:#fffbeb;color:#92400e">Tu plan se vencerá pronto, dentro de <strong>${days} ${days === 1 ? "día" : "días"}</strong>.</p>`
    : `<p style="margin:20px 0 0;padding:14px 16px;border-radius:12px;background:#fff1f2;color:#9f1239"><strong>Recordá regularizar tu plan.</strong> ${days <= 0 ? "Vence hoy." : `Se vence dentro de ${days} ${days === 1 ? "día" : "días"}.`}</p>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Reserva confirmada: ${classTitle}`,
      html: `<main style="font-family:Arial,sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a"><section style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px"><p style="margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:1.8px">${gymName || "TU GIMNASIO"}</p><h1 style="margin:0 0 18px;font-size:26px">Tu lugar está reservado</h1><p>Hola${name ? ` ${name}` : ""}, confirmamos tu reserva.</p><p style="margin:22px 0;padding:16px;border-radius:14px;background:#eff6ff"><strong>${classTitle}</strong><br><span style="color:#334155">${formatClassDate(startsAt)}</span></p><p>Si no podés asistir, podés cancelar tu lugar hasta una hora antes desde el enlace de clases.</p><p style="margin:24px 0"><a href="${classesUrl}" style="display:inline-block;background:#2563eb;border-radius:10px;color:#fff;font-weight:700;padding:12px 18px;text-decoration:none">Gestionar mi reserva</a></p>${paymentNote}</section></main>`,
    }),
  });
  return response.ok;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gymId: string }> }
) {
  const { gymId } = await params;
  const supabase = createClient();
  const requestedDays = Number(new URL(request.url).searchParams.get("days"));
  const daysAhead = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.floor(requestedDays), 8), 42) : 8;

  const { error: generationError } = await supabase.rpc("generate_upcoming_class_occurrences", { days_ahead: daysAhead });
  if (generationError) {
    console.error("Error generating upcoming class occurrences", generationError);
    return NextResponse.json({ error: "No se pudieron generar las próximas clases." }, { status: 500 });
  }

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
    .eq("is_cancelled", false)
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

  const result = data as ReservationResult | null;
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

  try {
    const [{ data: occurrence }, { data: gym }] = await Promise.all([
      supabase.from("class_occurrences").select("title, starts_at").eq("id", parsed.data.occurrenceId).eq("gym_id", gymId).maybeSingle(),
      supabase.from("gyms").select("name").eq("id", gymId).maybeSingle(),
    ]);
    if (result.member_email && occurrence) {
      const classesUrl = new URL(`/clases/${gymId}`, request.url).toString();
      const sent = await sendReservationConfirmation({ email: result.member_email, name: result.member_name, gymName: gym?.name, classTitle: occurrence.title, startsAt: occurrence.starts_at, classesUrl, nextPayment: result.next_payment });
      if (!sent) console.error("Unable to send class reservation confirmation");
    }
  } catch (emailError) {
    // The reservation is already confirmed; an email outage must not undo it.
    console.error("Unable to send class reservation confirmation", emailError);
  }

  return NextResponse.json({ data: { memberName: result.member_name } }, { status: 201 });
}
