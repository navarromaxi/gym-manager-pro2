import { parseFlexibleDate, toLocalMidnight } from "@/features/reports/report-utils";

type DatedAmount = { date: string; amount: number };
type RenewalPayment = { type?: string; member_id?: string; memberId?: string };
type RenewalMember = { id: string; derivedStatus: string; _next: Date | null };

export type RenewalStats = {
  renewedCount: number;
  notRenewedCount: number;
  renewalRate: number;
  totalEligible: number;
};

export function calculateFinancialSummary(
  payments: Array<{ amount: number }>,
  expenses: Array<{ amount: number }>
) {
  const totalIncome = payments.reduce((total, payment) => total + payment.amount, 0);
  const totalExpenseAmount = expenses.reduce((total, expense) => total + expense.amount, 0);
  return { totalIncome, totalExpenseAmount, totalProfit: totalIncome - totalExpenseAmount };
}

/** Builds the income series shown in the six-month trend card. */
export function calculateLast6MonthsIncome(payments: DatedAmount[], currentDate: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - index, 1);
    const month = monthDate.getMonth();
    const year = monthDate.getFullYear();
    const income = payments.reduce((total, payment) => {
      const parsedDate = parseFlexibleDate(payment.date);
      if (!parsedDate) return total;
      const paymentDate = toLocalMidnight(parsedDate);
      return paymentDate.getMonth() === month && paymentDate.getFullYear() === year
        ? total + payment.amount
        : total;
    }, 0);
    return {
      month: monthDate.toLocaleDateString("es-ES", { month: "short", year: "numeric" }),
      income,
    };
  }).reverse();
}

/** Calculates renewals independently from the report UI. */
export function calculateRenewalStats(
  payments: RenewalPayment[],
  filteredPlanPayments: RenewalPayment[],
  members: RenewalMember[],
  periodStart: Date | null,
  periodEnd: Date | null
): RenewalStats {
  const historicalCounts: Record<string, number> = {};
  payments.forEach((payment) => {
    if (payment.type && payment.type !== "plan") return;
    const memberId = payment.member_id ?? payment.memberId;
    if (memberId) historicalCounts[memberId] = (historicalCounts[memberId] ?? 0) + 1;
  });

  const filteredMemberIds = new Set(
    filteredPlanPayments
      .map((payment) => payment.member_id ?? payment.memberId)
      .filter((memberId): memberId is string => Boolean(memberId))
  );
  const renewedCount = [...filteredMemberIds].filter((memberId) => (historicalCounts[memberId] ?? 0) > 1).length;
  const notRenewedCount = members.filter((member) => {
    if (member.derivedStatus === "active") return false;
    if (periodStart && (!member._next || member._next < periodStart)) return false;
    if (periodEnd && (!member._next || member._next > periodEnd)) return false;
    return true;
  }).length;
  const totalEligible = renewedCount + notRenewedCount;
  return {
    renewedCount,
    notRenewedCount,
    renewalRate: totalEligible > 0 ? Math.round((renewedCount / totalEligible) * 100) : 0,
    totalEligible,
  };
}
