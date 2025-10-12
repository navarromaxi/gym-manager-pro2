import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { buildInvoicePdfFileName, findInvoicePdfSource } from "@/lib/invoice-pdf";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const toArrayBuffer = (buffer: Buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

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

export async function GET(
  _request: Request,
  context: { params: { id?: string } }
) {
  const invoiceId = context.params.id;

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
      "id, invoice_number, invoice_series, response_payload"
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

  const pdfSource = findInvoicePdfSource(invoice.response_payload);

  if (!pdfSource) {
    return NextResponse.json(
      {
        error:
          "La factura no tiene un PDF disponible todavía. Intenta nuevamente más tarde.",
      },
      { status: 404 }
    );
  }

   const pdfBuffer: ArrayBuffer | null =
    decodeBase64Pdf(pdfSource) ?? (await fetchRemotePdf(pdfSource));


    if (!pdfBuffer || pdfBuffer.byteLength === 0) {
    return NextResponse.json(
      {
        error:
          "No pudimos descargar el PDF de la factura. Intenta nuevamente en unos minutos.",
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

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers,
  });
}