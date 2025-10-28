import type { Invoice } from "./supabase";

type InvoiceLike = Pick<
  Invoice,
  "invoice_number" | "response_payload" | "external_invoice_id"
>;

const onlyDigits = (value: string) => value.replace(/\D+/g, "");
const looksNumeric = (value: string | null) =>
  !!value && /^\d{1,20}$/.test(value.trim());

export const toTrimmedString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

export const extractFacturaId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const candidatesRaw = [
    record.facturaid,
    record.facturaId,
    record.FacturaId,
    record.FacturaID,
    record.FACTURAID,
    (record.data as any)?.facturaid,
    (record.result as any)?.facturaid,
    (record.response as any)?.facturaid,
  ].map(toTrimmedString);

  for (const candidate of candidatesRaw) {
    if (!candidate) continue;
    const digits = onlyDigits(candidate);
    if (looksNumeric(digits)) return digits;
  }

  return null;
};

export const resolveInvoiceNumber = (invoice: InvoiceLike): string | null =>
  toTrimmedString(invoice.invoice_number) ??
  extractFacturaId(invoice.response_payload) ??
  toTrimmedString(invoice.external_invoice_id);
