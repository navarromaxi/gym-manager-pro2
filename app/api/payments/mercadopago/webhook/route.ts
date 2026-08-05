import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Notice = { type?: string; topic?: string; data?: { id?: string | number } };
type Subscription = { id?: string; external_reference?: string; status?: string; payer_id?: string | number; next_payment_date?: string | null };
type AuthorizedPayment = { status?: string; preapproval_id?: string };

async function email(apiKey: string, from: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return response.ok;
}

function paymentEmail(name: string) {
  return `<main style="font-family:Arial,sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a"><section style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px"><p style="margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:1.8px">RUTINA PERSONALIZADA</p><h1 style="margin:0 0 18px;font-size:26px">Pago confirmado</h1><p>Hola ${name}, recibimos tu pago mensual correctamente.</p><p>Tu servicio continúa activo. La próxima rutina se preparará dentro de las próximas 48 horas cuando corresponda.</p><p style="margin:26px 0 0;color:#64748b;font-size:13px">PyMesSistemas · Entrenamiento online</p></section></main>`;
}

function signatureIsValid(request: NextRequest, notice: Notice) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const values = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")).filter((part) => part.length === 2));
  const id = String(notice.data?.id || "").toLowerCase();
  if (!secret || !id || !values.ts || !values.v1) return false;
  const manifest = `id:${id};request-id:${requestId};ts:${values.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(values.v1)); }
  catch { return false; }
}

async function getSubscription(accessToken: string, id: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return response.ok ? await response.json() as Subscription : null;
}

export async function POST(request: NextRequest) {
  const notice = await request.json().catch(() => null) as Notice | null;
  if (!notice || !signatureIsValid(request, notice)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const resourceId = String(notice.data?.id || "");
  if (!accessToken || !resourceId) return NextResponse.json({ ok: true });

  const topic = notice.type || notice.topic;
  let subscription: Subscription | null = null;
  let paymentApproved = false;
  if (topic === "subscription_preapproval") subscription = await getSubscription(accessToken, resourceId);
  if (topic === "subscription_authorized_payment") {
    const response = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(resourceId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payment = response.ok ? await response.json() as AuthorizedPayment : null;
    paymentApproved = payment?.status === "approved";
    if (payment?.preapproval_id) subscription = await getSubscription(accessToken, payment.preapproval_id);
  }
  if (!subscription?.external_reference) return NextResponse.json({ ok: true });

  const supabase = createClient();
  const now = new Date();
  const nextPeriod = subscription.next_payment_date ? new Date(subscription.next_payment_date) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const cancelled = ["cancelled", "canceled"].includes(String(subscription.status).toLowerCase());
  const update = paymentApproved ? {
    status: "active", subscription_started_at: now.toISOString(), current_period_ends_at: nextPeriod.toISOString(), grace_ends_at: null,
    mercado_pago_subscription_id: subscription.id || null, mercado_pago_payer_id: subscription.payer_id ? String(subscription.payer_id) : null, last_payment_at: now.toISOString(),
  } : cancelled ? { status: "cancelled" } : { mercado_pago_subscription_id: subscription.id || null, mercado_pago_payer_id: subscription.payer_id ? String(subscription.payer_id) : null };
  const { data: client, error } = await supabase.from("online_training_clients").update(update).eq("id", subscription.external_reference).select("id, full_name, email").maybeSingle();
  if (error) { console.error("Unable to update online training client", error); return NextResponse.json({ error: "Update failed" }, { status: 500 }); }
  if (paymentApproved && client) {
    const notificationPeriod = nextPeriod.toISOString();
    const { error: noticeError } = await supabase
      .from("online_training_notifications")
      .insert({ client_id: client.id, notification_type: "payment_confirmed", period_ends_at: notificationPeriod });
    if (!noticeError) {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (apiKey && from) await email(apiKey, from, client.email, "Confirmamos tu pago mensual", paymentEmail(client.full_name));
    } else if (noticeError.code !== "23505") {
      console.error("Unable to record online training payment notification", noticeError);
    }
  }
  return NextResponse.json({ ok: true });
}
