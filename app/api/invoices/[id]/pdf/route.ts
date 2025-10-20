import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import {
  buildInvoicePdfFileName,
  findInvoicePdfSource,
} from "@/lib/invoice-pdf";
import { buildManualInvoicePdf } from "@/lib/manual-invoice-pdf";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;

const fromUint8Array = (value: Uint8Array): ArrayBuffer =>
  value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);

const decodeBase64Pdf = (value: string): ArrayBuffer | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^data:application\/pdf;base64,/i.test(trimmed)) {
    const [, base64] = trimmed.split(",", 2);
    if (!base64) return null;
    try {
      const buffer = Buffer.from(base64, "base64");
      return toArrayBuffer(buffer);
    } catch (error) {
      console.error("Error decoding data URL PDF", error);
      return null;
    }
  }

  if (!trimmed.includes("http")) {
    const sanitized = trimmed.replace(/\s+/g, "");
    if (/^[A-Za-z0-9+/=]+$/.test(sanitized)) {
      try {
        const buffer = Buffer.from(sanitized, "base64");
        return toArrayBuffer(buffer);
      } catch (error) {
        console.error("Error decoding base64 PDF", error);
        return null;
      }
    }
  }

  return null;
};

const fetchRemotePdf = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.error("Remote PDF responded with status", response.status, url);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error fetching remote PDF", error);
    return null;
  }
};

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
    .select("id, gym_id, member_name, total, currency, invoice_number, invoice_series, environment, typecfe, external_invoice_id, issued_at, due_date, request_payload, response_payload")
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

  const pdfSource = findInvoicePdfSource(invoice.response_payload);
  const hadExternalSource = Boolean(pdfSource);
  let pdfBuffer: ArrayBuffer | null = null;

  if (pdfSource) {
    const externalPdf =
      decodeBase64Pdf(pdfSource) ?? (await fetchRemotePdf(pdfSource));
    if (externalPdf && externalPdf.byteLength > 0) {
      pdfBuffer = externalPdf;
    }
  }

  if (!pdfBuffer) {
    let gym: {
      id: string;
      name?: string | null;
      invoice_rutneg?: string | null;
      invoice_dirneg?: string | null;
      invoice_cityneg?: string | null;
      invoice_stateneg?: string | null;
      invoice_addinfoneg?: string | null;
    } | null = null;

    if (invoice.gym_id) {
      const { data: gymRecord, error: gymError } = await supabase
        .from("gyms")
        .select(
          "id, name, invoice_rutneg, invoice_dirneg, invoice_cityneg, invoice_stateneg, invoice_addinfoneg"
        )
        .eq("id", invoice.gym_id)
        .maybeSingle();

      if (gymError) {
        console.error("Error fetching gym for invoice PDF", gymError);
      } else {
        gym = gymRecord;
      }
    }

  const manualPdf = await buildManualInvoicePdf({
      invoice,
      gym,
    });

    if (manualPdf && manualPdf.byteLength > 0) {
      pdfBuffer = fromUint8Array(manualPdf);
    }
  }

  if (!pdfBuffer || pdfBuffer.byteLength === 0) {
    const status = hadExternalSource ? 502 : 404;
    const message = hadExternalSource
      ? "No pudimos descargar ni reconstruir el PDF de la factura. Intenta nuevamente en unos minutos."
      : "La factura todavía no cuenta con los datos necesarios para generar un PDF. Intenta nuevamente más tarde.";
    return NextResponse.json(
      {
        error: message,
      },
      { status }
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

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers,
  });
}
