export const normalizeFacturaEnvironment = (
  value: string | null | undefined
): "PROD" | "TEST" | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (["PROD", "PRODUCCION", "PRODUCCIÓN", "PRODUCTION"].includes(normalized)) return "PROD";
  if (["TEST", "HOMOLOGACION", "HOMOLOGACIÓN", "HOMOLOGA", "HOMO"].includes(normalized)) return "TEST";
  return null;
};

export const hasConfigValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return false;
};

export const toNumberOrNull = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.trim());
  return Number.isNaN(parsed) ? null : parsed;
};

export const sanitizeInvoiceText = (value: string) =>
  value.replace(/<col\/>/g, " ").replace(/\s+/g, " ").trim();

export const sanitizeConfigString = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

export const mapPaymentMethodToFacturaPaymentType = (method: string | null | undefined) => {
  if (!method) return 1;
  const normalized = method.toLowerCase();
  if (normalized.includes("crédito") || normalized.includes("credito")) return 2;
  if (normalized.includes("débito") || normalized.includes("debito")) return 3;
  if (normalized.includes("transfer")) return 4;
  return 1;
};
