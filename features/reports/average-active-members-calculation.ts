import { addMonthsClamped, MS_PER_DAY, parseDateSafe, parseFlexibleDate, toLocalMidnight } from "@/features/reports/report-utils";

type MemberInput = {
  id: string;
  _next: Date | null;
  join_date?: string | null;
  joinDate?: string | null;
  last_payment?: string | null;
  lastPayment?: string | null;
  plan_end_date?: string | null;
  planEndDate?: string | null;
};

type PaymentInput = { member_id?: string; memberId?: string; date: string; type: string };

export type AverageActiveMembersEntry = {
  month: string;
  average: number;
  roundedAverage: number;
  averageAsInteger: number;
};

const valueFrom = <T extends object>(value: T, ...keys: string[]) => {
  for (const key of keys) {
    const candidate = (value as Record<string, unknown>)[key];
    if (candidate !== undefined && candidate !== null) return candidate;
  }
  return undefined;
};

/** Calculates coverage averages with no UI or database dependencies. */
export function calculateAverageActiveMembersByMonth(members: MemberInput[], payments: PaymentInput[], currentDate: Date): AverageActiveMembersEntry[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const paymentsByMember = new Map<string, Date[]>();

  payments.forEach((payment) => {
    const memberId = payment.member_id ?? payment.memberId;
    if (!memberId || (payment.type !== "plan" && payment.type !== "custom_plan")) return;
    const parsedDate = parseFlexibleDate(payment.date);
    if (!parsedDate) return;
    const dates = paymentsByMember.get(memberId) ?? [];
    dates.push(toLocalMidnight(parsedDate));
    paymentsByMember.set(memberId, dates);
  });

  const coverage: Array<{ start: Date; end: Date }> = [];
  const membersWithPaymentCoverage = new Set<string>();
  paymentsByMember.forEach((dates, memberId) => {
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const member = memberById.get(memberId);
    sortedDates.forEach((start, index) => {
      const nextDate = sortedDates[index + 1];
      const approximateEnd = addMonthsClamped(start, 1);
      const candidate = nextDate && nextDate > start ? nextDate : member?._next && member._next > start ? member._next : null;
      const end = toLocalMidnight(candidate ? new Date(Math.min(candidate.getTime(), approximateEnd.getTime())) : approximateEnd);
      if (end > start) { coverage.push({ start, end }); membersWithPaymentCoverage.add(memberId); }
    });
  });

  members.forEach((member) => {
    if (membersWithPaymentCoverage.has(member.id)) return;
    const start = parseDateSafe(valueFrom(member, "last_payment", "lastPayment") as string | undefined) ?? parseDateSafe(valueFrom(member, "join_date", "joinDate") as string | undefined);
    let end = member._next ?? parseDateSafe(valueFrom(member, "plan_end_date", "planEndDate") as string | undefined);
    if (!end && start) end = addMonthsClamped(start, 1);
    if (start && end && end > start) coverage.push({ start, end });
  });

  const months = Array.from({ length: 13 }, (_, index) => {
    const start = toLocalMidnight(new Date(currentDate.getFullYear(), currentDate.getMonth() - index, 1));
    const end = toLocalMidnight(new Date(start.getFullYear(), start.getMonth() + 1, 1));
    const rawLabel = start.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    return { key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`, month: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1), start, end, days: Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)) };
  });

  return months.map((month) => {
    const activeDays = coverage.reduce((total, range) => {
      const overlapStart = range.start > month.start ? range.start : month.start;
      const overlapEnd = range.end < month.end ? range.end : month.end;
      return overlapEnd > overlapStart ? total + (overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY : total;
    }, 0);
    const average = activeDays / month.days;
    return { month: month.month, average, roundedAverage: Math.round(average * 10) / 10, averageAsInteger: Math.round(average) };
  });
}
