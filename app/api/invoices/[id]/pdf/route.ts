import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { buildInvoicePdfFileName } from "@/lib/invoice-pdf";
import { extractFacturaId, toTrimmedString } from "@/lib/invoice-utils";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const FACTURALIVE_PDF_ENDPOINT =
  "https://facturalive.com/pdf/output/generate_factura.php";

const normalizeEnvironment = (value: unknown): "TEST" | "PROD" | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  if (["PROD", "PRODUCCION", "PRODUCCIÓN", "PRODUCTION"].includes(normalized)) {
    return "PROD";
  }

  if (
    ["TEST", "HOMOLOGACION", "HOMOLOGACIÓN", "HOMOLOGA", "HOMO"].includes(
      normalized
    )
  ) {
    return "TEST";
  }

  return null;
};

const DEFAULT_ENVIRONMENT: "TEST" = "TEST";


type RouteContext = { params: Promise<{ id?: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: invoiceId } = await context.params;

  if (!invoiceId) {
    return NextResponse.json(
      { error: "Debes indicar el identificador de la factura." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, gym_id, member_name, total, currency, invoice_number, invoice_series, environment, typecfe, external_invoice_id, issued_at, due_date, request_payload, response_payload"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching invoice for PDF", error);
    return NextResponse.json(
      { error: "No pudimos obtener la información de la factura." },
      { status: 500 }
    );
  }

  if (!invoice) {
    return NextResponse.json(
      { error: "No encontramos la factura solicitada." },
      { status: 404 }
    );
  }

  const facturaId =
    extractFacturaId(invoice.response_payload) ??
    toTrimmedString(invoice.external_invoice_id);

  if (!facturaId) {
    return NextResponse.json(
      {
        error:
          "No encontramos el identificador de la factura para descargarla. Vuelve a emitirla o contacta al soporte para revisarlo.",
      },
      { status: 404 }
    );
  }

  if (!invoice.gym_id) {
    return NextResponse.json(
      {
        error:
          "La factura no está asociada a un gimnasio válido para solicitar el PDF.",
      },
      { status: 400 }
    );
  }

  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("invoice_user_id, invoice_environment")
    .eq("id", invoice.gym_id)
    .maybeSingle();

  if (gymError) {
    console.error("Error fetching gym for invoice PDF", gymError);
    return NextResponse.json(
      {
        error:
          "No pudimos obtener la configuración de facturación del gimnasio para descargar la factura.",
      },
      { status: 500 }
    );
  }

  const userId = toTrimmedString(gym?.invoice_user_id);

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "El gimnasio no tiene configurado el usuario de FacturaLive. Configura invoice_user_id en Supabase e intenta nuevamente.",
      },
      { status: 400 }
    );
  }

  const environment =
    normalizeEnvironment(invoice.environment) ??
    normalizeEnvironment(gym?.invoice_environment) ??
    DEFAULT_ENVIRONMENT;

  // Enviar como application/x-www-form-urlencoded (NO multipart)
  const bodyParams = new URLSearchParams();
  bodyParams.set("facturaid", facturaId); // <- el ID numérico que te devuelve FacturaLive
  bodyParams.set("userid", userId); // 1021 en tu caso
  bodyParams.set("environment", environment); // "TEST" o "PROD"

  const debugContext = {
    invoiceId,
    gymId: invoice.gym_id,
    facturaId,
    userId,
    environment,
    requestBody: Object.fromEntries(bodyParams.entries()),
    requestBodyRaw: bodyParams.toString(),
  };

  console.info("Solicitando PDF de factura en FacturaLive", debugContext);

  let pdfResponse: Response;
  try {
    pdfResponse = await fetch(FACTURALIVE_PDF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent": "GymManagerPro/2.0 (+vercel)",
      },
      body: bodyParams.toString(),
      // (opcional) evita warnings en algunos runtimes
      // @ts-ignore
      duplex: "half",
    });
  } catch (externalError) {
    console.error(
      "Error connecting to FacturaLive PDF endpoint",
      externalError,
      debugContext
    );
    return NextResponse.json(
      {
        error:
          "No pudimos conectar con el servicio de FacturaLive para descargar la factura. Intenta nuevamente en unos minutos.",
        context: debugContext,
      },
      { status: 502 }
    );
  }


  if (!pdfResponse.ok) {
    let details: string | null = null;
    try {
      const text = (await pdfResponse.text())?.trim();
      if (text) {
        details = text.slice(0, 200);
      }
    } catch (readError) {
      console.error(
        "Error reading error response from FacturaLive PDF endpoint",
        readError,
        debugContext
      );
    }

    console.error(
      "FacturaLive devolvió un estado inesperado al solicitar el PDF",
      {
        status: pdfResponse.status,
        statusText: pdfResponse.statusText,
        details,
        ...debugContext,
      }
    );

    return NextResponse.json(
      {
        error:
          "FacturaLive devolvió un estado inesperado al solicitar el PDF de la factura. Intenta nuevamente en unos minutos.",
        details,
        context: debugContext,
      },
      { status: 502 }
    );
  }

  const pdfArrayBuffer = await pdfResponse.arrayBuffer();

  console.info("FacturaLive devolvió PDF correctamente", {
    ...debugContext,
    contentLength: pdfArrayBuffer.byteLength,
  });

  if (!pdfArrayBuffer || pdfArrayBuffer.byteLength === 0) {
    console.error(
      "FacturaLive devolvió un archivo vacío al solicitar el PDF",
      debugContext
    );
    return NextResponse.json(
      {
        error:
          "FacturaLive devolvió un archivo vacío al solicitar el PDF de la factura. Intenta nuevamente.",
        context: debugContext,
      },
      { status: 502 }
    );
  }

  const fileName = buildInvoicePdfFileName(
    invoice.invoice_number,
    invoice.invoice_series,
    invoice.id
  );

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  headers.set("X-Invoice-Filename", fileName);
  headers.set("Cache-Control", "no-store");

  return new NextResponse(Buffer.from(pdfArrayBuffer), {
    status: 200,
    headers,
  });
}
