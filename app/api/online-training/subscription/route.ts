import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type RequestBody = { clientId?: string; gymId?: string; cedula?: string };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as RequestBody;
  if ((!body.clientId && !body.cedula) || !body.gymId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createClient();
  const [{ data: client, error: clientError }, { data: config, error: configError }] = await Promise.all([
    body.clientId
      ? supabase.from("online_training_clients").select("id, gym_id, email").eq("id", body.clientId).eq("gym_id", body.gymId).maybeSingle()
      : supabase.from("online_training_clients").select("id, gym_id, email").eq("cedula", body.cedula!.trim()).eq("gym_id", body.gymId).maybeSingle(),
    supabase.from("online_training_config").select("is_enabled, monthly_price, payment_url").eq("gym_id", body.gymId).maybeSingle(),
  ]);
  if (clientError || configError || !client || !config?.is_enabled) return NextResponse.json({ error: "Service unavailable" }, { status: 404 });

  const fallbackUrl = config.payment_url || null;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ paymentUrl: fallbackUrl, mode: "manual" });

  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: "Rutina personalizada mensual",
      external_reference: client.id,
      payer_email: client.email,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: config.monthly_price, currency_id: "UYU" },
      back_url: `${request.nextUrl.origin}/entrenamiento/${body.gymId}/agenda`,
      status: "pending",
    }),
  });
  const subscription = await response.json().catch(() => null) as { id?: string; init_point?: string; sandbox_init_point?: string } | null;
  const paymentUrl = subscription?.init_point || subscription?.sandbox_init_point;
  if (!response.ok || !subscription?.id || !paymentUrl) {
    console.error("Mercado Pago subscription creation failed", subscription);
    return NextResponse.json({ paymentUrl: fallbackUrl, mode: "manual" });
  }
  await supabase.from("online_training_clients").update({ mercado_pago_subscription_id: subscription.id }).eq("id", client.id);
  return NextResponse.json({ paymentUrl, mode: "subscription" });
}
