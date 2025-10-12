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

const extractPdfUrlFromText = (value: string): string | null => {
  const pdfUrlMatch = value.match(/https?:\/\/[^\s"']+\.pdf\b/i);
  if (pdfUrlMatch) {
    return pdfUrlMatch[0];
  }
  return null;
};

const parseStructuredString = (value: string): unknown => {
  const attempts = new Set<string>();
  const trimmed = value.trim();
  if (!trimmed) return null;

  attempts.add(trimmed);

  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    try {
      const decoded = decodeURIComponent(trimmed);
      if (decoded && decoded !== trimmed) {
        attempts.add(decoded.trim());
      }
    } catch (error) {
      console.error(
        "Error decoding URI component while parsing PDF payload",
        error
      );
    }
  }

  for (const candidate of attempts) {
    if (
      (candidate.startsWith("{") && candidate.endsWith("}")) ||
      (candidate.startsWith("[") && candidate.endsWith("]"))
    ) {
      try {
        return JSON.parse(candidate);
      } catch (error) {
        console.error("Error parsing JSON while extracting PDF payload", error);
      }
    }
  }

  if (trimmed.includes("=") && (trimmed.includes("&") || trimmed.includes("\n"))) {
    const normalized = trimmed.replace(/\n+/g, "&");
    try {
      const params = new URLSearchParams(normalized);
      const entries = Array.from(params.entries());
      if (entries.length > 0) {
        return Object.fromEntries(entries);
      }
    } catch (error) {
      console.error("Error parsing query params while extracting PDF payload", error);
    }
  }

  return null;
};

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
    const embeddedUrl = extractPdfUrlFromText(trimmed);
    if (embeddedUrl) {
      return embeddedUrl;
    }
    if (isLikelyPdfString(trimmed)) {
      return trimmed;
    }
    const structured = parseStructuredString(trimmed);
    if (structured) {
      return searchPdfString(structured, seen, currentKey);
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
   if (payload === null || payload === undefined) {
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