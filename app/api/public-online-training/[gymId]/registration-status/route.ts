import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ gymId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { gymId } = await params;
  const cedula = request.nextUrl.searchParams.get("cedula")?.trim();
  if (!cedula) return NextResponse.json({ error: "Ingresá tu cédula." }, { status: 400 });

  const supabase = createClient();
  const { data: client, error } = await supabase
    .from("online_training_clients")
    .select("full_name, status, linked_routine_id")
    .eq("gym_id", gymId)
    .eq("cedula", cedula)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No pudimos verificar la inscripción." }, { status: 500 });
  if (!client) return NextResponse.json({ exists: false });

  let routinePath: string | null = null;
  if (client.linked_routine_id) {
    const { data: routine } = await supabase
      .from("routines")
      .select("public_share_token, public_link_enabled")
      .eq("id", client.linked_routine_id)
      .maybeSingle();
    if (routine?.public_share_token && routine.public_link_enabled) routinePath = `/rutina/${routine.public_share_token}`;
  }

  return NextResponse.json({
    exists: true,
    clientName: client.full_name,
    status: client.status,
    routinePath,
  });
}
