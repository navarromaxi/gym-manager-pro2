/** Shared, side-effect-free helpers used by the Reports feature. */

export const MS_PER_DAY = 86_400_000;

export function toLocalMidnight(date: Date) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
}

export function parseFlexibleDate(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDateSafe(value?: string | null) {
  const parsed = parseFlexibleDate(value);
  return parsed ? toLocalMidnight(parsed) : null;
}

export function addMonthsClamped(date: Date, months: number) {
  const base = toLocalMidnight(date);
  const dayOfMonth = base.getDate();
  const result = new Date(base);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return toLocalMidnight(result);
}

export function downloadBlob(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value?: number | null) =>
  currencyFormatter.format(value ?? 0);

export const formatCountAmount = (entry: { count: number; amount: number }) =>
  `${entry.count} · ${formatCurrency(entry.amount)}`;

/** CSV helper using semicolons, which opens cleanly in Spanish Excel locales. */
export function toCSV(rows: Array<Record<string, unknown>>): string {
  if (!rows || rows.length === 0) return "";

  const headersSet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => headersSet.add(key)));
  const headers = Array.from(headersSet);
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[;\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(";")),
  ].join("\n");
}
