import type { CustomPlan, Member, Payment, Plan } from "@/lib/supabase";

export const MEMBERS_PER_BATCH = 10;

export type MemberSortOption =
  | "recent_activity_desc"
  | "plan_end_asc"
  | "plan_end_desc"
  | "installment_due_asc"
  | "installment_due_desc"
  | "days_remaining_asc"
  | "days_remaining_desc";

/** Converts date-only and timestamp values to local midnight without timezone shifts. */
export const toLocalDate = (isoDate: string) => {
  if (!isoDate) return new Date(NaN);

  const dateMatch = isoDate.match(/^(\d{4}-\d{2}-\d{2})/);
  const dateOnly = dateMatch ? dateMatch[1] : null;

  if (dateOnly) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return new Date(NaN);

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const calculatePlanEndDate = (startDate: string, plan?: Plan | null) => {
  if (!startDate) return "";
  const baseDate = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return startDate;

  if (plan?.duration_type === "days") baseDate.setDate(baseDate.getDate() + plan.duration);
  else if (plan?.duration_type === "months") baseDate.setMonth(baseDate.getMonth() + plan.duration);
  else if (plan?.duration_type === "years") baseDate.setFullYear(baseDate.getFullYear() + plan.duration);

  return baseDate.toISOString().split("T")[0];
};

export const formatDateForAlert = (isoDate: string) => {
  if (!isoDate) return "";
  const date = toLocalDate(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
};

export const getRealMemberStatus = (member: Member): "active" | "expired" | "inactive" => {
  const today = new Date();
  const next = toLocalDate(member.next_payment);
  const diffDays = Math.ceil((today.getTime() - next.getTime()) / 86400000);

  if (diffDays <= 0) return "active";
  if (diffDays <= 30) return "expired";
  return "inactive";
};

const extractCustomPlanTimestamp = (plan: CustomPlan) => {
  const parts = plan.id.split("_");
  const maybeTimestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  return Number.isNaN(maybeTimestamp) ? 0 : maybeTimestamp;
};

const getCustomPlanEndDate = (plan: CustomPlan) => {
  if (!plan.end_date) return null;
  const parsed = toLocalDate(plan.end_date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isCustomPlanMoreRecent = (candidate: CustomPlan, current: CustomPlan) => {
  const candidateEnd = getCustomPlanEndDate(candidate);
  const currentEnd = getCustomPlanEndDate(current);

  if (candidateEnd && currentEnd && candidateEnd.getTime() !== currentEnd.getTime()) {
    return candidateEnd.getTime() > currentEnd.getTime();
  }

  if (candidateEnd && !currentEnd) return true;
  if (!candidateEnd && currentEnd) return false;

  return extractCustomPlanTimestamp(candidate) > extractCustomPlanTimestamp(current);
};

export const sortMembers = (members: Member[], sortOption: MemberSortOption) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDateValue = (value?: string | null) => {
    if (!value) return null;
    const time = toLocalDate(value).getTime();
    return Number.isNaN(time) ? null : time;
  };

  const compareOptional = (aValue: number | null, bValue: number | null, ascending: boolean) => {
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return ascending ? aValue - bValue : bValue - aValue;
  };

  const getDaysRemaining = (member: Member) => {
    const time = getDateValue(member.next_payment);
    return time === null ? null : Math.ceil((time - today.getTime()) / 86400000);
  };

  return [...members].sort((a, b) => {
    if (sortOption === "plan_end_asc" || sortOption === "plan_end_desc") {
      return compareOptional(getDateValue(a.next_payment), getDateValue(b.next_payment), sortOption === "plan_end_asc");
    }

    if (sortOption === "installment_due_asc" || sortOption === "installment_due_desc") {
      return compareOptional(getDateValue(a.next_installment_due ?? a.next_payment), getDateValue(b.next_installment_due ?? b.next_payment), sortOption === "installment_due_asc");
    }

    if (sortOption === "days_remaining_asc" || sortOption === "days_remaining_desc") {
      return compareOptional(getDaysRemaining(a), getDaysRemaining(b), sortOption === "days_remaining_asc");
    }

    const aTime = Math.max(getDateValue(a.last_payment) ?? -Infinity, getDateValue(a.join_date) ?? -Infinity);
    const bTime = Math.max(getDateValue(b.last_payment) ?? -Infinity, getDateValue(b.join_date) ?? -Infinity);
    return compareOptional(aTime, bTime, false);
  });
};

type FilterMembersParams = {
  members: Member[];
  search: string;
  statusFilter: string;
  followUpMemberIds: Set<string>;
  longTermFollowUpMemberIds: Set<string>;
  expiringCustomPlanMemberIds: Set<string> | null;
  hasOverduePartialInstallment: (member: Member) => boolean;
};

export const filterMembers = ({
  members,
  search,
  statusFilter,
  followUpMemberIds,
  longTermFollowUpMemberIds,
  expiringCustomPlanMemberIds,
  hasOverduePartialInstallment,
}: FilterMembersParams) => {
  const today = new Date();
  const filtered = members.filter((member) => {
    const matchesSearch = !search ||
      (member.name ?? "").toLowerCase().includes(search) ||
      (member.email ?? "").toLowerCase().includes(search) ||
      (member.phone ?? "").toLowerCase().includes(search);
    if (!matchesSearch) return false;

    const realStatus = getRealMemberStatus(member);
    if (statusFilter === "expiring_soon" || statusFilter === "expiring_soon_contacted") {
      const diffDays = Math.ceil((toLocalDate(member.next_payment).getTime() - today.getTime()) / 86400000);
      const isContacted = Boolean(member.expiring_soon_contacted);
      return diffDays <= 10 && diffDays >= 0 && realStatus === "active" &&
        (statusFilter === "expiring_soon" ? !isContacted : isContacted);
    }
    if (statusFilter === "follow_up") return followUpMemberIds.has(member.id);
    if (statusFilter === "long_plan_follow_up") return longTermFollowUpMemberIds.has(member.id);
    if (statusFilter === "balance_due") return hasOverduePartialInstallment(member);
    if (statusFilter === "custom_expiring") return expiringCustomPlanMemberIds?.has(member.id) ?? false;
    return statusFilter === "all" || realStatus === statusFilter;
  });

  return statusFilter === "balance_due"
    ? filtered.sort((a, b) => (b.balance_due || 0) - (a.balance_due || 0))
    : filtered;
};

export const getMembersToFollowUp = (members: Member[], payments: Payment[]) => {
  const today = new Date();

  return members.filter((member) => {
    let referenceDate: Date | null = null;

    for (const payment of payments) {
      if (payment.member_id !== member.id || payment.type !== "plan" || !payment.start_date) continue;

      const startDate = toLocalDate(payment.start_date);
      if (Number.isNaN(startDate.getTime())) continue;
      if (!referenceDate || startDate.getTime() > referenceDate.getTime()) referenceDate = startDate;
    }

    if (!referenceDate) {
      const joinDate = toLocalDate(member.join_date);
      if (Number.isNaN(joinDate.getTime())) return false;
      referenceDate = joinDate;
    }

    const diffDays = Math.floor((today.getTime() - referenceDate.getTime()) / 86400000);
    return !member.followed_up && diffDays >= 5 && diffDays <= 12;
  });
};

export const getLatestPlanStartDateByMember = (payments: Payment[]) => {
  const startDateByMember = new Map<string, string>();
  const timestampByMember = new Map<string, number>();

  for (const payment of payments) {
    if (payment.type !== "plan" || !payment.start_date) continue;
    const time = toLocalDate(payment.start_date).getTime();
    if (Number.isNaN(time)) continue;

    const current = timestampByMember.get(payment.member_id) ?? -Infinity;
    if (time > current) {
      timestampByMember.set(payment.member_id, time);
      startDateByMember.set(payment.member_id, payment.start_date);
    }
  }

  return startDateByMember;
};

export const getLatestCustomPlanByMember = (customPlans: CustomPlan[]) => {
  const latestByMember = new Map<string, CustomPlan>();
  for (const plan of customPlans) {
    const current = latestByMember.get(plan.member_id);
    if (!current || isCustomPlanMoreRecent(plan, current)) latestByMember.set(plan.member_id, plan);
  }
  return latestByMember;
};

export const getExpiringCustomPlans = (customPlans: CustomPlan[], latestByMember: Map<string, CustomPlan>) => {
  const today = new Date();
  return customPlans.filter((plan) => {
    if (latestByMember.get(plan.member_id)?.id !== plan.id || !plan.is_active || !plan.end_date) return false;
    const endDate = toLocalDate(plan.end_date);
    if (Number.isNaN(endDate.getTime())) return false;
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
    return diffDays <= 10 && diffDays >= 0;
  });
};

export type LongTermPlanFollowUp = {
  memberId: string;
  memberName: string;
  planName: string;
  daysSinceStart: number;
};

export const getLongTermPlanFollowUps = (
  members: Member[],
  payments: Payment[],
  planById: Map<string, Plan>,
  planByName: Map<string, Plan>
): LongTermPlanFollowUp[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latestPaymentByMember = new Map<string, { payment: Payment; startDate: Date }>();

  for (const payment of payments) {
    if (payment.type !== "plan" || !payment.start_date) continue;
    const startDate = toLocalDate(payment.start_date);
    if (Number.isNaN(startDate.getTime())) continue;
    const current = latestPaymentByMember.get(payment.member_id);
    if (!current || startDate.getTime() > current.startDate.getTime()) {
      latestPaymentByMember.set(payment.member_id, { payment, startDate });
    }
  }

  const membersById = new Map(members.map((member) => [member.id, member]));
  const alerts: LongTermPlanFollowUp[] = [];
  for (const [memberId, { payment, startDate }] of latestPaymentByMember) {
    const member = membersById.get(memberId);
    if (!member || member.long_plan_followed_up || !payment.start_date) continue;

    const paymentPlanName = payment.plan?.trim().toLowerCase();
    const memberPlanName = member.plan?.trim().toLowerCase();
    const plan = (payment.plan_id && planById.get(payment.plan_id)) ||
      (paymentPlanName && planByName.get(paymentPlanName)) ||
      (memberPlanName && planByName.get(memberPlanName));
    if (!plan) continue;

    const qualifies = (plan.duration_type === "months" && plan.duration >= 5) ||
      (plan.duration_type === "years" && plan.duration * 12 >= 5) ||
      (plan.duration_type === "days" && plan.duration >= 150);
    if (!qualifies) continue;

    const planEndDate = toLocalDate(calculatePlanEndDate(payment.start_date, plan));
    if (Number.isNaN(planEndDate.getTime()) || planEndDate.getTime() < today.getTime()) continue;

    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / 86400000);
    if (daysSinceStart < 120) continue;
    alerts.push({ memberId, memberName: member.name || "Socio", planName: plan.name, daysSinceStart });
  }

  return alerts.sort((a, b) => b.daysSinceStart - a.daysSinceStart);
};

export const getPlanIndexes = (plans: Plan[]) => {
  const byId = new Map<string, Plan>();
  const byName = new Map<string, Plan>();

  for (const plan of plans) {
    byId.set(plan.id, plan);
    const normalizedName = plan.name?.trim().toLowerCase();
    if (normalizedName) byName.set(normalizedName, plan);
  }

  return { byId, byName };
};

export const hasOverduePartialInstallment = (member: Member) => {
  if ((member.balance_due ?? 0) <= 0 || !member.next_installment_due) return false;
  const dueDate = toLocalDate(member.next_installment_due);
  if (Number.isNaN(dueDate.getTime())) return false;

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return dueDate.getTime() <= todayMidnight.getTime();
};

export const getDaysUntilExpiration = (nextPayment: string) => {
  const today = new Date();
  return Math.ceil((toLocalDate(nextPayment).getTime() - today.getTime()) / 86400000);
};

export const getExpiringMembers = (members: Member[], contacted: boolean) =>
  members.filter((member) => {
    const daysUntilExpiration = getDaysUntilExpiration(member.next_payment);
    return daysUntilExpiration <= 10 && daysUntilExpiration >= 0 &&
      getRealMemberStatus(member) === "active" &&
      Boolean(member.expiring_soon_contacted) === contacted;
  });

export const getExpiredMembers = (members: Member[]) =>
  members.filter((member) => getRealMemberStatus(member) === "expired");

export const getMembersWithBalanceDue = (members: Member[]) =>
  members.filter((member) => (member.balance_due || 0) > 0);
