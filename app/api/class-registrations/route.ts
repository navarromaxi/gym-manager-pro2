import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sessionId,
      gymId,
      fullName,
      email,
      phone,
    }: {
      sessionId?: string;
      gymId?: string;
      fullName?: string;
      email?: string | null;
      phone?: string | null;
    } = body ?? {};

    if (!sessionId || !gymId || !fullName?.trim()) {
      return NextResponse.json(
        {
          error:
            "Faltan datos obligatorios para registrar la clase. Verifica la información ingresada.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: session, error: sessionError } = await supabase
      .from("class_sessions")
      .select("id, gym_id, title, capacity, date, start_time")
      .eq("id", sessionId)
      .eq("gym_id", gymId)
      .maybeSingle();

    if (sessionError) {
      console.error("Error fetching class session", sessionError);
      return NextResponse.json(
        {
          error: "No se pudo verificar la información de la clase. Intenta nuevamente.",
        },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          error: "La clase seleccionada no está disponible.",
        },
        { status: 404 }
      );
    }

    const sessionDateTimeRaw = `${session.date}T${session.start_time}`;
    const sessionDateTimeNormalized =
      sessionDateTimeRaw.length === 16
        ? `${sessionDateTimeRaw}:00`
        : sessionDateTimeRaw;
    const sessionStart = new Date(sessionDateTimeNormalized);

    if (!Number.isNaN(sessionStart.getTime())) {
      if (sessionStart.getTime() <= Date.now()) {
        return NextResponse.json(
          {
            error:
              "Usted no se ha podido anotar a esta clase, la misma ya ha iniciado.",
          },
          { status: 409 }
        );
      }
    } else {
      console.warn(
        "No se pudo interpretar la fecha y hora de la clase",
        session.date,
        session.start_time
      );
    }
    
    const { count: registrationsCount, error: countError } = await supabase
      .from("class_registrations")
      .select("id", { head: true, count: "exact" })
      .eq("session_id", sessionId)
      .eq("gym_id", gymId);

    if (countError) {
      console.error("Error counting class registrations", countError);
      return NextResponse.json(
        {
          error:
            "No pudimos verificar la disponibilidad de la clase. Intenta nuevamente en unos segundos.",
        },
        { status: 500 }
      );
    }

    if ((registrationsCount ?? 0) >= session.capacity) {
      return NextResponse.json(
        {
          error: "Esta clase ya alcanzó su cupo máximo.",
        },
        { status: 409 }
      );
    }

    const { data: registration, error: insertError } = await supabase
      .from("class_registrations")
      .insert({
        session_id: sessionId,
        gym_id: gymId,
        full_name: fullName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
      })
      .select("id, session_id, gym_id, full_name, email, phone, created_at")
      .single();

    if (insertError) {
      console.error("Error inserting class registration", insertError);
      return NextResponse.json(
        {
          error:
            "No pudimos registrar tu lugar. Intenta nuevamente en unos segundos.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ registration });
  } catch (error) {
    console.error("Unexpected error creating class registration", error);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado. Intenta nuevamente en unos segundos.",
      },
      { status: 500 }
    );
  }
}