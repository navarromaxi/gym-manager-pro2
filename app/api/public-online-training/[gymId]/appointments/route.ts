import { NextRequest, NextResponse } from "next/server";

import { createGoogleCalendarEvent, deleteGoogleCalendarEvent, getGoogleCalendarBusyIntervals } from "@/lib/google-calendar";
import { ONLINE_TRAINING_MANAGEMENT_URL } from "@/lib/online-training-links";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const DAYS = new Set([1, 3, 4]); // lunes, miércoles y jueves
const HOURS = [18, 18.5, 19, 19.5];
const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "https://www.pymessistemas.com",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

function publicJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...publicCorsHeaders, ...init?.headers },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: publicCorsHeaders });
}

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
      html: `<main style="font-family:Arial,sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a"><section style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px"><p style="margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:1.8px">RUTINA PERSONALIZADA</p><h1 style="margin:0 0 18px;font-size:26px">Tu llamada quedó agendada</h1><p>Hola ${name}, reservamos tu turno para el <strong>${date}</strong>.</p><p>Te enviaremos un recordatorio antes de la llamada.</p><p style="margin:24px 0"><a href="${ONLINE_TRAINING_MANAGEMENT_URL}" style="display:inline-block;background:#2563eb;border-radius:10px;color:#ffffff;font-weight:700;padding:12px 18px;text-decoration:none">Gestionar mi reunión</a></p><p style="margin:0;color:#475569;font-size:14px">Si necesitás cambiar el horario, ingresá con tu cédula y elegí otro turno disponible.</p><p style="margin:26px 0 0;color:#64748b;font-size:13px">PyMesSistemas · Entrenamiento online</p></section></main>`,
    }),
  });
  return response.ok;
}

function montevideoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function montevideoMonth(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}`;
}

function monthBounds(date: Date) {
  const [year, month] = montevideoMonth(date).split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00-03:00`),
    end: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-03:00`),
  };
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
  if (!client) return publicJson({ error: "Necesitás una suscripción activa para agendar tu llamada." }, { status: 403 });
  const now = new Date();
  const starts = availableStarts(now);
  let googleBusy: Array<{ start: string; end: string }> = [];
  try {
    googleBusy = (await getGoogleCalendarBusyIntervals(now, new Date(now.getTime() + 36 * 24 * 60 * 60 * 1000))) ?? [];
  } catch (calendarError) {
    console.error("No se pudo consultar Google Calendar para la agenda online", calendarError);
    // La agenda propia sigue siendo la fuente de reserva: una caída temporal de
    // Google Calendar no debe impedir que el socio consulte los turnos.
    googleBusy = [];
  }
  const supabase = createClient();
  const { data: appointments } = await supabase.from("online_training_appointments").select("id, starts_at, client_id, status").eq("gym_id", gymId).gte("starts_at", now.toISOString()).eq("status", "confirmed");
  const taken = new Set((appointments || []).filter((appointment) => appointment.client_id !== client.id).map((appointment) => appointment.starts_at));
  const own = (appointments || []).filter((appointment) => appointment.client_id === client.id).map((appointment) => ({ id: appointment.id, startsAt: appointment.starts_at }));
  const monthsWithOwnAppointment = new Set(own.map((appointment) => montevideoMonth(new Date(appointment.startsAt))));
  return publicJson({
    clientName: client.full_name,
    slots: starts
      .filter((start) => !taken.has(start.toISOString()))
      .filter((start) => !monthsWithOwnAppointment.has(montevideoMonth(start)))
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
  if (!client || !start || Number.isNaN(start.getTime()) || !availableStarts(new Date()).some((slot) => slot.toISOString() === start.toISOString())) return publicJson({ error: "El turno no está disponible." }, { status: 400 });
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const period = monthBounds(start);
  const supabase = createClient();
  const { data: existingMonthAppointments, error: existingMonthError } = await supabase
    .from("online_training_appointments")
    .select("id")
    .eq("gym_id", gymId)
    .eq("client_id", client.id)
    .eq("status", "confirmed")
    .gte("starts_at", period.start.toISOString())
    .lt("starts_at", period.end.toISOString())
    .limit(1);
  if (existingMonthError) return publicJson({ error: "No pudimos verificar tus reuniones anteriores." }, { status: 500 });
  if (existingMonthAppointments?.length) return publicJson({ error: "Ya tenés una reunión agendada para este mes." }, { status: 409 });
  try {
    const busy = await getGoogleCalendarBusyIntervals(start, end);
    if (busy && overlaps(start, end, busy)) return publicJson({ error: "Ese turno ya no está disponible. Elegí otro." }, { status: 409 });
  } catch (calendarError) {
    console.error("No se pudo validar Google Calendar antes de reservar", calendarError);
    // Si Google Calendar no responde, el bloqueo por turnos confirmados en
    // ManagerPro continúa activo y permite conservar el flujo del socio.
  }
  const { data: appointment, error } = await supabase
    .from("online_training_appointments")
    .insert({ gym_id: gymId, client_id: client.id, starts_at: start.toISOString(), ends_at: end.toISOString() })
    .select("id")
    .single();
  if (error?.code === "23505") return publicJson({ error: "Ese turno acaba de ser reservado. Elegí otro." }, { status: 409 });
  if (error) return publicJson({ error: "No pudimos guardar el turno." }, { status: 500 });
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
    // El turno ya quedó reservado en ManagerPro. Lo conservamos para no perder
    // la reserva del socio aunque la integración externa esté indisponible.
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
  return publicJson({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const body = await request.json().catch(() => ({})) as { cedula?: string; appointmentId?: string };
  const client = await activeClient(gymId, body.cedula || "");
  if (!client || !body.appointmentId) return publicJson({ error: "No pudimos identificar tu turno." }, { status: 400 });
  const supabase = createClient();
  const { data: appointment, error: appointmentError } = await supabase
    .from("online_training_appointments")
    .select("id, starts_at, google_calendar_event_id")
    .eq("id", body.appointmentId)
    .eq("gym_id", gymId)
    .eq("client_id", client.id)
    .eq("status", "confirmed")
    .maybeSingle();
  if (appointmentError || !appointment) return publicJson({ error: "No encontramos ese turno." }, { status: 404 });
  if (new Date(appointment.starts_at) <= new Date()) return publicJson({ error: "Solo podés cancelar reuniones futuras." }, { status: 400 });
  if (appointment.google_calendar_event_id) {
    try {
      await deleteGoogleCalendarEvent(appointment.google_calendar_event_id);
    } catch (calendarError) {
      console.error("No se pudo eliminar el evento de Google Calendar", calendarError);
    }
  }
  const { error } = await supabase.from("online_training_appointments").delete().eq("id", appointment.id).eq("gym_id", gymId).eq("client_id", client.id);
  if (error) return publicJson({ error: "No pudimos cancelar el turno." }, { status: 500 });
  return publicJson({ ok: true });
}
