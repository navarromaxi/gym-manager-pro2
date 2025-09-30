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