import { toLocalMidnight } from "@/features/reports/report-utils";

export type ReportPeriodBounds = { periodStart: Date | null; periodEnd: Date | null };

export function getReportPeriodBounds(
  filter: string,
  currentDate: Date,
  customRange?: { from?: Date; to?: Date }
): ReportPeriodBounds {
  const startOfMonth = (year: number, month: number) => toLocalMidnight(new Date(year, month, 1));
  const endOfMonth = (year: number, month: number) => toLocalMidnight(new Date(year, month + 1, 0));
  const current = toLocalMidnight(currentDate);

  switch (filter) {
    case "current_month": return { periodStart: startOfMonth(current.getFullYear(), current.getMonth()), periodEnd: endOfMonth(current.getFullYear(), current.getMonth()) };
    case "previous_month": {
      const monthDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      return { periodStart: startOfMonth(monthDate.getFullYear(), monthDate.getMonth()), periodEnd: endOfMonth(monthDate.getFullYear(), monthDate.getMonth()) };
    }
    case "last_6_months": {
      const start = new Date(current);
      start.setMonth(start.getMonth() - 6);
      return { periodStart: start, periodEnd: current };
    }
    case "current_year": return { periodStart: startOfMonth(current.getFullYear(), 0), periodEnd: endOfMonth(current.getFullYear(), 11) };
    case "last_year": return { periodStart: startOfMonth(current.getFullYear() - 1, 0), periodEnd: endOfMonth(current.getFullYear() - 1, 11) };
    case "custom": return { periodStart: customRange?.from ? toLocalMidnight(customRange.from) : null, periodEnd: customRange?.to ? toLocalMidnight(customRange.to) : null };
    default: return { periodStart: null, periodEnd: null };
  }
}

export function isDateWithinReportPeriod(date: Date, { periodStart, periodEnd }: ReportPeriodBounds) {
  return !(periodStart && date < periodStart) && !(periodEnd && date > periodEnd);
}
