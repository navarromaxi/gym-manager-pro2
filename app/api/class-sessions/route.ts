import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const createSessionSchema = z.object({
  gymId: z.string().min(1, "El gimnasio es obligatorio"),
  title: z.string().min(1, "El título es obligatorio"),
  date: z.string().min(1, "La fecha es obligatoria"),
  startTime: z.string().min(1, "El horario es obligatorio"),
  capacity: z.number().int().positive("La capacidad debe ser mayor a 0"),
  notes: z.string().nullable().optional(),
});

const deleteSessionSchema = z.object({
  gymId: z.string().min(1, "El identificador del gimnasio es obligatorio"),
  sessionId: z.string().min(1, "El identificador de la clase es obligatorio"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse({
      gymId: body?.gymId,
      title: body?.title,
      date: body?.date,
      startTime: body?.startTime,
      capacity: Number(body?.capacity ?? 0),
      notes:
        typeof body?.notes === "string" && body.notes.trim().length > 0
          ? body.notes.trim()
          : null,
    });

    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(" ");
      return NextResponse.json(
        {
          error:
            message ||
            "Los datos enviados para crear la clase no son válidos.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("class_sessions")
      .insert({
        gym_id: parsed.data.gymId,
        title: parsed.data.title,
        date: parsed.data.date,
        start_time: parsed.data.startTime,
        capacity: parsed.data.capacity,
        notes: parsed.data.notes ?? null,
      })
      .select(
        "id, gym_id, title, date, start_time, capacity, notes, created_at"
      )
      .single();

    if (error) {
      console.error("Error inserting class session", error);
      return NextResponse.json(
        {
          error:
            "No se pudo crear la clase en este momento. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error creating class session", error);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al crear la clase. Intenta nuevamente más tarde.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = deleteSessionSchema.safeParse({
      gymId: body?.gymId,
      sessionId: body?.sessionId,
    });

    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(" ");
      return NextResponse.json(
        {
          error:
            message ||
            "Los datos enviados para eliminar la clase no son válidos.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error: registrationsError } = await supabase
      .from("class_registrations")
      .delete()
      .eq("session_id", parsed.data.sessionId)
      .eq("gym_id", parsed.data.gymId);

    if (registrationsError) {
      console.error("Error deleting class registrations", registrationsError);
      return NextResponse.json(
        {
          error:
            "No se pudieron eliminar las inscripciones de la clase. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }

    const { error: sessionError } = await supabase
      .from("class_sessions")
      .delete()
      .eq("id", parsed.data.sessionId)
      .eq("gym_id", parsed.data.gymId);

    if (sessionError) {
      console.error("Error deleting class session", sessionError);
      return NextResponse.json(
        {
          error:
            "No se pudo eliminar la clase. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((issue) => issue.message).join(" ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Unexpected error deleting class session", error);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al eliminar la clase. Intenta nuevamente más tarde.",
      },
      { status: 500 }
    );
  }
}