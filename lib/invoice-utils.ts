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

export const extractFacturaId = (
  payload: unknown,
  depth = 0
): string | null => {
  if (depth > 6 || payload == null) return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (looksNumeric(trimmed)) {
      return onlyDigits(trimmed);
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return extractFacturaId(parsed, depth + 1);
      }
    } catch (_error) {
      // Ignore JSON parse errors from raw payloads
    }

    return null;
  }

  if (typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const directCandidates = [
    record.facturaid,
    record.facturaId,
    record.FacturaId,
    record.FacturaID,
    record.FACTURAID,
  ].map(toTrimmedString);

  for (const candidate of directCandidates) {
    if (!candidate) continue;
    const digits = onlyDigits(candidate);
    if (looksNumeric(digits)) return digits;
  }

  const nestedSources: unknown[] = [
    record.data,
    record.result,
    record.response,
    record.parsed,
    record.raw,
  ];

  for (const source of nestedSources) {
    const resolved = extractFacturaId(source, depth + 1);
    if (resolved) return resolved;
  }

  return null;
};

export const resolveInvoiceNumber = (invoice: InvoiceLike): string | null =>
  toTrimmedString(invoice.invoice_number) ??
  extractFacturaId(invoice.response_payload) ??
  toTrimmedString(invoice.external_invoice_id);
