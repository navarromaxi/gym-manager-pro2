import { NextRequest, NextResponse } from "next/server";

import { createGoogleCalendarEvent, getGoogleCalendarBusyIntervals } from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const DAYS = new Set([1, 3, 4]); // lunes, miércoles y jueves
const HOURS = [18, 18.5, 19, 19.5];

async function sendAppointmentConfirmation(name: string, email: string, startsAt: Date) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  const date = new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startsAt);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Tu llamada con el profesor quedó agendada",
      html: `<main style="font-family:Arial,sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a"><section style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px"><p style="margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:1.8px">RUTINA PERSONALIZADA</p><h1 style="margin:0 0 18px;font-size:26px">Tu llamada quedó agendada</h1><p>Hola ${name}, reservamos tu turno para el <strong>${date}</strong>.</p><p>Te enviaremos un recordatorio antes de la llamada.</p><p style="margin:26px 0 0;color:#64748b;font-size:13px">PyMesSistemas · Entrenamiento online</p></section></main>`,
    }),
  });
  return response.ok;
}

function montevideoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function availableStarts(now: Date) {
  const starts: Date[] = [];
  const startDate = new Date(`${montevideoDate(now)}T12:00:00-03:00`);
  for (let dayOffset = 0; dayOffset < 35; dayOffset += 1) {
    const day = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    if (!DAYS.has(day.getDay())) continue;
    const date = montevideoDate(day);
    for (const hour of HOURS) {
      const hourPart = String(Math.floor(hour)).padStart(2, "0");
      const minutePart = hour % 1 ? "30" : "00";
      const start = new Date(`${date}T${hourPart}:${minutePart}:00-03:00`);
      if (start > now) starts.push(start);
    }
  }
  return starts;
}

function overlaps(start: Date, end: Date, busy: Array<{ start: string; end: string }>) {
  return busy.some((interval) => start < new Date(interval.end) && end > new Date(interval.start));
}

async function activeClient(gymId: string, cedula: string) {
  const supabase = createClient();
  const { data } = await supabase.from("online_training_clients").select("id, full_name, email, status").eq("gym_id", gymId).eq("cedula", cedula.trim()).maybeSingle();
  return data && ["active", "payment_due"].includes(data.status) ? data : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const cedula = request.nextUrl.searchParams.get("cedula") || "";
  const client = await activeClient(gymId, cedula);
  if (!client) return NextResponse.json({ error: "Necesitás una suscripción activa para agendar tu llamada." }, { status: 403 });
  const now = new Date();
  const starts = availableStarts(now);
  let googleBusy: Array<{ start: string; end: string }> = [];
  try {
    googleBusy = (await getGoogleCalendarBusyIntervals(now, new Date(now.getTime() + 36 * 24 * 60 * 60 * 1000))) ?? [];
  } catch (calendarError) {
    console.error("No se pudo consultar Google Calendar para la agenda online", calendarError);
    return NextResponse.json({ error: "No pudimos consultar la disponibilidad del profesor. Intentá nuevamente." }, { status: 503 });
  }
  const supabase = createClient();
  const { data: appointments } = await supabase.from("online_training_appointments").select("starts_at, client_id, status").eq("gym_id", gymId).gte("starts_at", now.toISOString()).eq("status", "confirmed");
  const taken = new Set((appointments || []).filter((appointment) => appointment.client_id !== client.id).map((appointment) => appointment.starts_at));
  const own = (appointments || []).filter((appointment) => appointment.client_id === client.id).map((appointment) => appointment.starts_at);
  return NextResponse.json({
    clientName: client.full_name,
    slots: starts
      .filter((start) => !taken.has(start.toISOString()))
      .filter((start) => !overlaps(start, new Date(start.getTime() + 30 * 60 * 1000), googleBusy))
      .map((start) => start.toISOString()),
    appointments: own,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const body = await request.json().catch(() => ({})) as { cedula?: string; startsAt?: string };
  const client = await activeClient(gymId, body.cedula || "");
  const start = body.startsAt ? new Date(body.startsAt) : null;
  if (!client || !start || Number.isNaN(start.getTime()) || !availableStarts(new Date()).some((slot) => slot.toISOString() === start.toISOString())) return NextResponse.json({ error: "El turno no está disponible." }, { status: 400 });
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  try {
    const busy = await getGoogleCalendarBusyIntervals(start, end);
    if (busy && overlaps(start, end, busy)) return NextResponse.json({ error: "Ese turno ya no está disponible. Elegí otro." }, { status: 409 });
  } catch (calendarError) {
    console.error("No se pudo validar Google Calendar antes de reservar", calendarError);
    return NextResponse.json({ error: "No pudimos validar el horario del profesor. Intentá nuevamente." }, { status: 503 });
  }
  const supabase = createClient();
  const { data: appointment, error } = await supabase
    .from("online_training_appointments")
    .insert({ gym_id: gymId, client_id: client.id, starts_at: start.toISOString(), ends_at: end.toISOString() })
    .select("id")
    .single();
  if (error?.code === "23505") return NextResponse.json({ error: "Ese turno acaba de ser reservado. Elegí otro." }, { status: 409 });
  if (error) return NextResponse.json({ error: "No pudimos guardar el turno." }, { status: 500 });
  try {
    const calendarEventId = await createGoogleCalendarEvent({
      summary: `Llamada inicial · ${client.full_name}`,
      description: `Cliente de rutina personalizada\\nCédula: ${body.cedula?.trim() || "No informada"}`,
      startsAt: start,
      endsAt: end,
    });
    if (calendarEventId) {
      const { error: updateError } = await supabase
        .from("online_training_appointments")
        .update({ google_calendar_event_id: calendarEventId })
        .eq("id", appointment.id);
      if (updateError) throw updateError;
      console.info("Turno online sincronizado con Google Calendar", { appointmentId: appointment.id, calendarEventId });
    }
  } catch (calendarError) {
    console.error("No se pudo sincronizar el turno online con Google Calendar", calendarError);
    await supabase.from("online_training_appointments").delete().eq("id", appointment.id);
    return NextResponse.json({ error: "No pudimos registrar tu turno en la agenda. Intentá nuevamente." }, { status: 503 });
  }
  try {
    const sent = await sendAppointmentConfirmation(client.full_name, client.email, start);
    if (sent) {
      await supabase.from("online_training_notifications").insert({
        client_id: client.id,
        notification_type: "appointment_confirmed",
        period_ends_at: start.toISOString(),
      });
    }
  } catch (emailError) {
    console.error("No se pudo enviar la confirmación de turno online", emailError);
  }
  return NextResponse.json({ ok: true });
}
