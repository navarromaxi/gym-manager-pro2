import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type ProspectEmail = {
  id: string;
  gym_id: string;
  name: string;
  email: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  trial_email_reminder_sent_for: string | null;
};

const MONTEVIDEO_TIME_ZONE = "America/Montevideo";

const getScheduleKey = (prospect: ProspectEmail) =>
  `${prospect.scheduled_date ?? ""}T${prospect.scheduled_time?.slice(0, 5) ?? ""}`;

const getScheduledAt = (prospect: ProspectEmail) => {
  if (!prospect.scheduled_date || !prospect.scheduled_time) return null;

  const date = new Date(
    `${prospect.scheduled_date}T${prospect.scheduled_time.slice(0, 5)}:00-03:00`
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatClassTime = (date: Date) =>
  new Intl.DateTimeFormat("es-UY", {
    timeZone: MONTEVIDEO_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!resendApiKey || !from) {
    return NextResponse.json({ error: "Email is not configured" }, { status: 500 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select(
      "id, gym_id, name, email, scheduled_date, scheduled_time, trial_email_reminder_sent_for"
    )
    .in("status", ["trial_scheduled", "waiting_response"])
    .not("email", "is", null)
    .neq("email", "");

  if (error) {
    console.error("Unable to load prospect trial reminders", error);
    return NextResponse.json({ error: "Unable to load prospects" }, { status: 500 });
  }

  const now = new Date();
  const minimumScheduledAt = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const maximumScheduledAt = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
  const prospects = (data ?? []) as ProspectEmail[];
  let sent = 0;
  let skipped = 0;

  for (const prospect of prospects) {
    const scheduledAt = getScheduledAt(prospect);
    const scheduleKey = getScheduleKey(prospect);

    if (
      !scheduledAt ||
      !prospect.email?.trim() ||
      prospect.trial_email_reminder_sent_for === scheduleKey ||
      scheduledAt < minimumScheduledAt ||
      scheduledAt > maximumScheduledAt
    ) {
      skipped += 1;
      continue;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [prospect.email.trim()],
        subject: "Recordatorio de tu clase de prueba",
        html: `<main style="font-family:Arial,sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a"><section style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px"><p style="margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:1.8px">CLASE DE PRUEBA</p><h1 style="margin:0 0 18px;font-size:26px">Hola ${prospect.name}</h1><p>Te recordamos que mañana tenés tu clase de prueba agendada.</p><p style="font-size:18px"><strong>${formatClassTime(scheduledAt)} hs.</strong></p><p>¡Te esperamos!</p></section></main>`,
      }),
    });

    if (!response.ok) {
      console.error("Unable to send prospect trial reminder", {
        prospectId: prospect.id,
        response: await response.text(),
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("prospects")
      .update({ trial_email_reminder_sent_for: scheduleKey })
      .eq("id", prospect.id)
      .eq("gym_id", prospect.gym_id);

    if (updateError) {
      console.error("Email sent but reminder could not be recorded", updateError);
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({ processed: prospects.length, sent, skipped });
}
