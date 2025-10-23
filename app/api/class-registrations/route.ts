import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import { CLASS_RECEIPTS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase-server";

async function ensureReceiptBucket(
  supabase: SupabaseClient,
  bucketId: string
) {
  const { data, error } = await supabase.storage.getBucket(bucketId);

  if (error && !error.message?.includes("not found")) {
    throw error;
  }

  if (!data) {
    const { error: createError } = await supabase.storage.createBucket(
      bucketId,
      {
        public: true,
      }
    );

    if (createError && !createError.message?.includes("already exists")) {
      throw createError;
    }
  }
}

const MAX_RECEIPT_SIZE_MB = 5;
const MAX_RECEIPT_SIZE_BYTES = MAX_RECEIPT_SIZE_MB * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let sessionId: string | undefined;
    let gymId: string | undefined;
    let fullName: string | undefined;
    let email: string | undefined;
    let phone: string | undefined;
    let receiptFile: File | null = null;

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      if (body) {
        sessionId =
          typeof body.sessionId === "string" ? body.sessionId : undefined;
        gymId = typeof body.gymId === "string" ? body.gymId : undefined;
        fullName =
          typeof body.fullName === "string" ? body.fullName : undefined;
        email = typeof body.email === "string" ? body.email : undefined;
        phone = typeof body.phone === "string" ? body.phone : undefined;
      }
    } else {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        const sessionIdEntry = formData.get("sessionId");
        if (typeof sessionIdEntry === "string") {
          sessionId = sessionIdEntry;
        }
        const gymIdEntry = formData.get("gymId");
        if (typeof gymIdEntry === "string") {
          gymId = gymIdEntry;
        }
        const fullNameEntry = formData.get("fullName");
        if (typeof fullNameEntry === "string") {
          fullName = fullNameEntry;
        }
        const emailEntry = formData.get("email");
        if (typeof emailEntry === "string") {
          email = emailEntry;
        }
        const phoneEntry = formData.get("phone");
        if (typeof phoneEntry === "string") {
          phone = phoneEntry;
        }
        const receiptEntry = formData.get("receipt");
        if (receiptEntry instanceof File && receiptEntry.size > 0) {
          receiptFile = receiptEntry;
        }
      }
    }

    const normalizedSessionId = sessionId?.trim() ?? "";
    const normalizedGymId = gymId?.trim() ?? "";
    const normalizedFullName = fullName?.trim() ?? "";
    const normalizedEmail =
      email && email.trim().length > 0 ? email.trim() : null;
    const normalizedPhone =
      phone && phone.trim().length > 0 ? phone.trim() : null;

    if (!normalizedSessionId || !normalizedGymId || !normalizedFullName) {
      return NextResponse.json(
        {
          error:
            "Faltan datos obligatorios para registrar la clase. Verifica la información ingresada.",
        },
        { status: 400 }
      );
    }

    if (receiptFile) {
      if (receiptFile.size > MAX_RECEIPT_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `El comprobante supera el tamaño máximo de ${MAX_RECEIPT_SIZE_MB} MB.`,
          },
          { status: 400 }
        );
      }

      const isImage = receiptFile.type?.startsWith("image/") ?? false;
      const isPdf = receiptFile.type === "application/pdf";

      if (!isImage && !isPdf) {
        return NextResponse.json(
          {
            error:
              "El comprobante debe ser un archivo de imagen o un PDF válido.",
          },
          { status: 400 }
        );
      }
    }

    const supabase = createClient();

    const { data: session, error: sessionError } = await supabase
      .from("class_sessions")
      .select("id, gym_id, title, capacity, date, start_time, accept_receipts")
      .eq("id", normalizedSessionId)
      .eq("gym_id", normalizedGymId)
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

    if (receiptFile && !session.accept_receipts) {
      receiptFile = null;
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
      .eq("session_id", normalizedSessionId)
      .eq("gym_id", normalizedGymId);

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

    let receiptUrl: string | null = null;
    let receiptStoragePath: string | null = null;

    if (receiptFile) {
      try {
        await ensureReceiptBucket(supabase, CLASS_RECEIPTS_BUCKET);
      } catch (bucketError) {
        console.error("Error ensuring receipts bucket", bucketError);
        return NextResponse.json(
          {
            error:
              "No se pudo preparar el almacenamiento de comprobantes. Intenta nuevamente en unos segundos.",
          },
          { status: 500 }
        );
      }

      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const originalExtension = receiptFile.name
        ? extname(receiptFile.name)
        : "";
      const fallbackExtension =
        receiptFile.type === "application/pdf" ? ".pdf" : ".jpg";
      const extension = originalExtension || fallbackExtension;
      const normalizedExtension = extension.startsWith(".")
        ? extension
        : `.${extension}`;
      const storagePath = `${normalizedGymId}/${normalizedSessionId}/${randomUUID()}${normalizedExtension}`;

      const { error: uploadError } = await supabase.storage
        .from(CLASS_RECEIPTS_BUCKET)
        .upload(storagePath, buffer, {
          contentType: receiptFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading receipt file", uploadError);
        return NextResponse.json(
          {
            error:
              "No se pudo guardar el comprobante. Intenta nuevamente en unos segundos.",
          },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from(CLASS_RECEIPTS_BUCKET)
        .getPublicUrl(storagePath);

      receiptUrl = publicUrlData?.publicUrl ?? null;
      receiptStoragePath = storagePath;
    }

    const { data: registration, error: insertError } = await supabase
      .from("class_registrations")
      .insert({
        session_id: normalizedSessionId,
        gym_id: normalizedGymId,
        full_name: normalizedFullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        receipt_url: receiptUrl,
        receipt_storage_path: receiptStoragePath,
      })
      .select(
        "id, session_id, gym_id, full_name, email, phone, created_at, receipt_url, receipt_storage_path"
      )
      .single();

    if (insertError) {
      console.error("Error inserting class registration", insertError);
      if (receiptStoragePath) {
        await supabase.storage
          .from(CLASS_RECEIPTS_BUCKET)
          .remove([receiptStoragePath])
          .catch((cleanupError) =>
            console.error(
              "Error removing receipt after failed registration",
              cleanupError
            )
          );
      }
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