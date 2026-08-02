import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Notice = { type?: string; topic?: string; data?: { id?: string | number } };
type Subscription = { id?: string; external_reference?: string; status?: string; payer_id?: string | number; next_payment_date?: string | null };
type AuthorizedPayment = { status?: string; preapproval_id?: string };

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
  const { data: client, error } = await supabase.from("online_training_clients").update(update).eq("id", subscription.external_reference).select("id").maybeSingle();
  if (error) { console.error("Unable to update online training client", error); return NextResponse.json({ error: "Update failed" }, { status: 500 }); }
  if (paymentApproved && client) await supabase.from("online_training_notifications").upsert({ client_id: client.id, notification_type: "payment_confirmed" }, { onConflict: "client_id,notification_type", ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}
