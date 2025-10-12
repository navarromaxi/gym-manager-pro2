const PDF_KEY_HINTS = [
  "pdf",
  "archivo",
  "document",
  "comprobante",
  "enlace",
  "link",
  "url",
  "base64",
];

const isLikelyPdfString = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^data:application\/pdf;base64,/i.test(trimmed)) {
    return true;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }

  if (!trimmed.includes(" ") && !trimmed.includes("http")) {
    const base64Candidate = trimmed.replace(/\s+/g, "");
    if (/^[A-Za-z0-9+/=]+$/.test(base64Candidate) && base64Candidate.length > 50) {
      return true;
    }
  }

  return false;
};

const searchPdfString = (
  value: unknown,
  seen: WeakSet<Record<string, unknown>>,
  currentKey?: string
): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isLikelyPdfString(trimmed)) {
      return trimmed;
    }
    if (currentKey) {
      const normalizedKey = currentKey.toLowerCase();
      if (PDF_KEY_HINTS.some((hint) => normalizedKey.includes(hint))) {
        return trimmed;
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = searchPdfString(item, seen, currentKey);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (seen.has(record)) {
      return null;
    }
    seen.add(record);

    const entries = Object.entries(record);

    for (const [key, child] of entries) {
      const normalizedKey = key.toLowerCase();
      if (PDF_KEY_HINTS.some((hint) => normalizedKey.includes(hint))) {
        const found = searchPdfString(child, seen, normalizedKey);
        if (found) {
          return found;
        }
      }
    }

    for (const [key, child] of entries) {
      const found = searchPdfString(child, seen, key);
      if (found) {
        return found;
      }
    }
  }

  return null;
};

export const findInvoicePdfSource = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return searchPdfString(payload, new WeakSet());
};

const sanitizeSegment = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[^a-zA-Z0-9-_]/g, "_");
};

export const buildInvoicePdfFileName = (
  invoiceNumber?: string | null,
  invoiceSeries?: string | null,
  invoiceId?: string
) => {
  const parts = [
    sanitizeSegment(invoiceSeries),
    sanitizeSegment(invoiceNumber),
    sanitizeSegment(invoiceId ?? null),
  ].filter(Boolean) as string[];

  const base = parts.length > 0 ? parts.join("-") : "factura";
  return `${base}.pdf`;
};