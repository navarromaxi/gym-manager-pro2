import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Client = { id: string; full_name: string; email: string; status: string; current_period_ends_at: string | null; grace_ends_at: string | null };
type Appointment = { client_id: string; starts_at: string };

async function email(apiKey: string, from: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  return response.ok;
}

function emailLayout(title: string, content: string) {
  return `<main style="font-family:Arial,sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a"><section style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px"><p style="margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:1.8px">RUTINA PERSONALIZADA</p><h1 style="margin:0 0 18px;font-size:26px">${title}</h1>${content}<p style="margin:26px 0 0;color:#64748b;font-size:13px">PyMesSistemas · Entrenamiento online</p></section></main>`;
}

function formatAppointment(value: string) {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return NextResponse.json({ error: "Email is not configured" }, { status: 500 });

  const supabase = createClient();
  const { data, error } = await supabase.from("online_training_clients").select("id, full_name, email, status, current_period_ends_at, grace_ends_at").in("status", ["active", "payment_due", "grace"]);
  if (error) return NextResponse.json({ error: "Unable to load clients" }, { status: 500 });
  const clients = (data || []) as Client[];
  if (clients.length === 0) return NextResponse.json({ processed: 0, emails: 0 });

  const clientIds = clients.map((client) => client.id);
  const [{ data: notices }, { data: appointments, error: appointmentsError }] = await Promise.all([
    supabase.from("online_training_notifications").select("client_id, notification_type, period_ends_at").in("client_id", clientIds),
    supabase.from("online_training_appointments").select("client_id, starts_at").in("client_id", clientIds).eq("status", "confirmed").gte("starts_at", new Date().toISOString()),
  ]);
  if (appointmentsError) return NextResponse.json({ error: "Unable to load appointments" }, { status: 500 });
  const sent = new Set((notices || []).map((item) => `${item.client_id}:${item.notification_type}:${item.period_ends_at || ""}`));
  const now = new Date();
  const fiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const appointmentReminderLimit = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  let emails = 0;

  for (const client of clients) {
    const periodEnd = client.current_period_ends_at ? new Date(client.current_period_ends_at) : null;
    const periodKey = periodEnd?.toISOString() || "";
    const key = (type: string) => `${client.id}:${type}:${periodKey}`;
    if (periodEnd && client.status !== "grace" && periodEnd > now && periodEnd <= fiveDays && !sent.has(key("renewal_reminder"))) {
      if (await email(apiKey, from, client.email, "Tu rutina se renueva pronto", `<div style="font-family:Arial;color:#0f172a"><h2>Hola ${client.full_name}</h2><p>Tu mes de rutina personalizada se renueva en pocos días.</p><p>Verificá que tu suscripción esté al día para que podamos preparar tu próximo plan.</p></div>`)) {
        await supabase.from("online_training_notifications").insert({ client_id: client.id, notification_type: "renewal_reminder", period_ends_at: periodEnd.toISOString() });
        await supabase.from("online_training_clients").update({ status: "payment_due" }).eq("id", client.id);
        emails += 1;
      }
      continue;
    }
    if (periodEnd && client.status !== "grace" && periodEnd <= now) {
      const graceEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      await supabase.from("online_training_clients").update({ status: "grace", grace_ends_at: graceEnd.toISOString() }).eq("id", client.id);
      if (!sent.has(key("period_ended")) && await email(apiKey, from, client.email, "Tu rutina mensual terminó", `<div style="font-family:Arial;color:#0f172a"><h2>Hola ${client.full_name}</h2><p>Tu período actual terminó. Tenés 10 días para regularizar el pago y continuar con tu próximo plan.</p><p>Una vez confirmado, la nueva rutina estará lista dentro de las próximas 48 horas.</p></div>`)) {
        await supabase.from("online_training_notifications").insert({ client_id: client.id, notification_type: "period_ended", period_ends_at: periodEnd.toISOString() }); emails += 1;
      }
      continue;
    }
    const graceEnd = client.grace_ends_at ? new Date(client.grace_ends_at) : null;
    if (client.status === "grace" && graceEnd && graceEnd <= now) {
      await supabase.from("online_training_clients").update({ status: "expired" }).eq("id", client.id);
      if (!sent.has(key("service_expired")) && await email(apiKey, from, client.email, "Tu servicio quedó pausado", `<div style="font-family:Arial;color:#0f172a"><h2>Hola ${client.full_name}</h2><p>Venció el plazo de regularización. Tu servicio queda pausado hasta que se confirme nuevamente el pago.</p></div>`)) {
        await supabase.from("online_training_notifications").insert({ client_id: client.id, notification_type: "service_expired", period_ends_at: periodEnd?.toISOString() ?? null }); emails += 1;
      }
    }
  }

  const clientsById = new Map(clients.map((client) => [client.id, client]));
  for (const appointment of (appointments || []) as Appointment[]) {
    const client = clientsById.get(appointment.client_id);
    const startsAt = new Date(appointment.starts_at);
    const key = `${appointment.client_id}:appointment_reminder:${startsAt.toISOString()}`;
    if (!client || startsAt <= now || startsAt > appointmentReminderLimit || sent.has(key)) continue;
    if (await email(
      apiKey,
      from,
      client.email,
      "Recordatorio de tu llamada con el profesor",
      emailLayout(
        `Hola ${client.full_name}`,
        `<p>Te recordamos que tenés una llamada de control o entrevista con el profesor el <strong>${formatAppointment(appointment.starts_at)}</strong>.</p><p>Si necesitás reprogramarla, respondé este correo con anticipación.</p>`,
      ),
    )) {
      await supabase.from("online_training_notifications").insert({ client_id: client.id, notification_type: "appointment_reminder", period_ends_at: startsAt.toISOString() });
      emails += 1;
    }
  }

  return NextResponse.json({ processed: clients.length, emails });
}
