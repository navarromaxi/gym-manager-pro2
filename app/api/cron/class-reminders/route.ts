import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

type Occurrence = { id: string; gym_id: string; title: string; starts_at: string; ends_at: string };
type Reservation = { occurrence_id: string; member_id: string };
type MemberEmail = { id: string; name: string | null; email: string | null };
type Gym = { id: string; name: string | null };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Montevideo" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Montevideo" }).format(new Date(value));
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!resendApiKey || !from) return NextResponse.json({ error: "Email is not configured" }, { status: 500 });

  const supabase = createClient();
  const now = new Date();
  const end = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const { data: occurrences, error: occurrencesError } = await supabase
    .from("class_occurrences")
    .select("id, gym_id, title, starts_at, ends_at")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", end.toISOString());
  if (occurrencesError) {
    console.error("Unable to load class occurrences for reminders", occurrencesError);
    return NextResponse.json({ error: "Unable to load classes" }, { status: 500 });
  }
  const occurrenceRows = (occurrences ?? []) as Occurrence[];
  if (!occurrenceRows.length) return NextResponse.json({ sent: 0, skipped: 0 });

  const occurrenceIds = occurrenceRows.map((item) => item.id);
  const { data: reservations, error: reservationsError } = await supabase.from("class_reservations").select("occurrence_id, member_id").in("occurrence_id", occurrenceIds);
  if (reservationsError) return NextResponse.json({ error: "Unable to load reservations" }, { status: 500 });
  const reservationRows = (reservations ?? []) as Reservation[];
  if (!reservationRows.length) return NextResponse.json({ sent: 0, skipped: 0 });

  const memberIds = [...new Set(reservationRows.map((item) => item.member_id))];
  const gymIds = [...new Set(occurrenceRows.map((item) => item.gym_id))];
  const [{ data: members }, { data: gyms }, { data: sentReminders }] = await Promise.all([
    supabase.from("members").select("id, name, email").in("id", memberIds),
    supabase.from("gyms").select("id, name").in("id", gymIds),
    supabase.from("class_reservation_reminders").select("occurrence_id, member_id").in("occurrence_id", occurrenceIds),
  ]);
  const memberMap = new Map(((members ?? []) as MemberEmail[]).map((item) => [item.id, item]));
  const gymMap = new Map(((gyms ?? []) as Gym[]).map((item) => [item.id, item]));
  const occurrenceMap = new Map(occurrenceRows.map((item) => [item.id, item]));
  const alreadySent = new Set((sentReminders ?? []).map((item) => `${item.occurrence_id}:${item.member_id}`));

  let sent = 0;
  let skipped = 0;
  for (const reservation of reservationRows) {
    const key = `${reservation.occurrence_id}:${reservation.member_id}`;
    const member = memberMap.get(reservation.member_id);
    const occurrence = occurrenceMap.get(reservation.occurrence_id);
    if (alreadySent.has(key) || !member?.email || !occurrence) { skipped += 1; continue; }
    const gym = gymMap.get(occurrence.gym_id);
    const gymName = gym?.name || "Tu gimnasio";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [member.email],
        subject: `Recordatorio de clase: ${occurrence.title}`,
        html: `<div style="font-family:Arial,sans-serif;color:#0f172a"><h2>¡Hola${member.name ? ` ${member.name}` : ""}!</h2><p>Te recordamos tu reserva en <strong>${gymName}</strong>.</p><p><strong>${occurrence.title}</strong><br>${formatDate(occurrence.starts_at)} a las ${formatTime(occurrence.starts_at)} hs.</p><p>Si no podés asistir, podés cancelar tu reserva desde el enlace de clases hasta una hora antes.</p><p>¡Te esperamos!</p></div>`,
      }),
    });
    if (!response.ok) {
      console.error("Unable to send class reminder", await response.text());
      continue;
    }
    const { error: reminderError } = await supabase.from("class_reservation_reminders").insert({ occurrence_id: reservation.occurrence_id, member_id: reservation.member_id, reminder_type: "upcoming_class" });
    if (reminderError) console.error("Reminder email sent but could not be recorded", reminderError);
    else sent += 1;
  }
  return NextResponse.json({ sent, skipped });
}
