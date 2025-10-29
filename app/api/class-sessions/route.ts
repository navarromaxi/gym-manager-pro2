import { NextResponse } from "next/server";
import { z } from "zod";

import { CLASS_RECEIPTS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase-server";

const createSessionSchema = z.object({
  gymId: z.string().min(1, "El gimnasio es obligatorio"),
  title: z.string().min(1, "El título es obligatorio"),
  date: z.string().min(1, "La fecha es obligatoria"),
  startTime: z.string().min(1, "El horario es obligatorio"),
  capacity: z.number().int().positive("La capacidad debe ser mayor a 0"),
  price: z
    .number()
    .min(0, "El precio no puede ser negativo")
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
  acceptReceipts: z.boolean().optional().default(false),
});

const deleteSessionSchema = z.object({
  gymId: z.string().min(1, "El identificador del gimnasio es obligatorio"),
  sessionId: z.string().min(1, "El identificador de la clase es obligatorio"),
});

const updateSessionSchema = z.object({
  gymId: z.string().min(1, "El identificador del gimnasio es obligatorio"),
  sessionId: z
    .string()
    .min(1, "El identificador de la clase es obligatorio"),
  title: z.string().min(1, "El título es obligatorio"),
  date: z.string().min(1, "La fecha es obligatoria"),
  startTime: z.string().min(1, "El horario es obligatorio"),
  capacity: z.number().int().positive("La capacidad debe ser mayor a 0"),
  price: z
    .number()
    .min(0, "El precio no puede ser negativo")
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
  acceptReceipts: z.boolean().optional(),
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
      price:
        typeof body?.price === "number"
          ? body.price
          : typeof body?.price === "string" && body.price.trim().length > 0
          ? Number(body.price)
          : null,
      notes:
        typeof body?.notes === "string" && body.notes.trim().length > 0
          ? body.notes.trim()
          : null,
      acceptReceipts:
        typeof body?.acceptReceipts === "boolean"
          ? body.acceptReceipts
          : typeof body?.acceptReceipts === "string"
          ? body.acceptReceipts.toLowerCase() === "true"
          : undefined,
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
        price: parsed.data.price ?? null,
        notes: parsed.data.notes ?? null,
        accept_receipts: parsed.data.acceptReceipts ?? false,
      })
      .select(
        "id, gym_id, title, date, start_time, capacity, price, notes, created_at, accept_receipts"
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateSessionSchema.safeParse({
      gymId: body?.gymId,
      sessionId: body?.sessionId,
      title: body?.title,
      date: body?.date,
      startTime: body?.startTime,
      capacity: Number(body?.capacity ?? 0),
      price:
        typeof body?.price === "number"
          ? body.price
          : typeof body?.price === "string" && body.price.trim().length > 0
          ? Number(body.price)
          : null,
      notes:
        typeof body?.notes === "string" && body.notes.trim().length > 0
          ? body.notes.trim()
          : null,
      acceptReceipts:
        typeof body?.acceptReceipts === "boolean"
          ? body.acceptReceipts
          : typeof body?.acceptReceipts === "string"
          ? body.acceptReceipts.toLowerCase() === "true"
          : undefined,
    });

    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(" ");
      return NextResponse.json(
        {
          error:
            message ||
            "Los datos enviados para actualizar la clase no son válidos.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: existingSession, error: lookupError } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("id", parsed.data.sessionId)
      .eq("gym_id", parsed.data.gymId)
      .maybeSingle();

    if (lookupError) {
      console.error("Error fetching class session before update", lookupError);
      return NextResponse.json(
        {
          error:
            "No se pudo validar la clase a actualizar. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }

    if (!existingSession) {
      return NextResponse.json(
        {
          error: "La clase no existe o fue eliminada.",
        },
        { status: 404 }
      );
    }

    const updateResponse = await supabase
      .from("class_sessions")
      .update({
        title: parsed.data.title,
        date: parsed.data.date,
        start_time: parsed.data.startTime,
        capacity: parsed.data.capacity,
        price: parsed.data.price ?? null,
        notes: parsed.data.notes ?? null,
        accept_receipts: parsed.data.acceptReceipts ?? false,
      })
      .eq("id", parsed.data.sessionId)
      .eq("gym_id", parsed.data.gymId)
      .select(
        "id, gym_id, title, date, start_time, capacity, price, notes, created_at, accept_receipts"
      )
      .single();

    if (updateResponse.error) {
      console.error("Error updating class session", updateResponse.error);
      return NextResponse.json(
        {
          error:
            "No se pudo actualizar la clase en este momento. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updateResponse.data }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((issue) => issue.message).join(" ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Unexpected error updating class session", error);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al actualizar la clase. Intenta nuevamente más tarde.",
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

    const { data: sessionToDelete, error: lookupError } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("id", parsed.data.sessionId)
      .eq("gym_id", parsed.data.gymId)
      .maybeSingle();

    if (lookupError) {
      console.error("Error fetching class session before deletion", lookupError);
      return NextResponse.json(
        {
          error:
            "No se pudo validar la clase a eliminar. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }

    if (!sessionToDelete) {
      return NextResponse.json(
        {
          error: "La clase no existe o ya fue eliminada.",
        },
        { status: 404 }
      );
    }

    

    const { data: registrationReceipts, error: receiptsLookupError } =
      await supabase
        .from("class_registrations")
        .select("receipt_storage_path")
        .eq("session_id", sessionToDelete.id)
        .eq("gym_id", parsed.data.gymId);

    if (receiptsLookupError) {
      console.error("Error fetching receipts before deletion", receiptsLookupError);
      return NextResponse.json(
        {
          error:
            "No se pudieron revisar los comprobantes de la clase. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }

    const receiptPaths = (registrationReceipts ?? [])
      .map((item) => item.receipt_storage_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);

    const { error: registrationsError } = await supabase
      .from("class_registrations")
      .delete()
      .eq("session_id", sessionToDelete.id)
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

    const sessionDeleteResponse = await supabase
      .from("class_sessions")
      .delete()
      .eq("id", sessionToDelete.id)
      .eq("gym_id", parsed.data.gymId)
      .select("id")
      .maybeSingle();

    if (sessionDeleteResponse.error) {
      console.error("Error deleting class session", sessionDeleteResponse.error);
      return NextResponse.json(
        {
          error:
            "No se pudo eliminar la clase. Intenta nuevamente más tarde.",
        },
        { status: 500 }
      );
    }
    if (!sessionDeleteResponse.data) {
      return NextResponse.json(
        {
          error: "No se encontró la clase para eliminar.",
        },
        { status: 404 }
      );
    }

    if (receiptPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(CLASS_RECEIPTS_BUCKET)
        .remove(receiptPaths);

      if (storageError) {
        console.error("Error removing receipt files", storageError);
      }
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
