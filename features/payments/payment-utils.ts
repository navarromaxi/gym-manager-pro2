import type { Member, Payment, Plan } from "@/lib/supabase";

export type ReferenceFilterOption =
  | "all"
  | "new_plan"
  | "existing_plan"
  | "product"
  | "custom_plan";

export const getPlanPrice = (payment: Payment, members: Member[], plans: Plan[]) => {
  const member = members.find((candidate) => candidate.id === payment.member_id);
  if (member && typeof member.plan_price === "number") return member.plan_price;
  if (payment.plan_id) {
    const plan = plans.find((candidate) => candidate.id === payment.plan_id);
    if (plan) return plan.price;
  }
  if (payment.plan) {
    const plan = plans.find((candidate) => candidate.name === payment.plan);
    if (plan) return plan.price;
  }
  return 0;
};

export const getPaymentReferenceType = (payment: Payment): ReferenceFilterOption => {
  if (payment.type === "product") return "product";
  if (payment.type === "custom_plan") return "custom_plan";
  return typeof payment.start_date === "string" && payment.start_date.trim() !== ""
    ? "new_plan"
    : "existing_plan";
};

export const getEffectivePaymentDate = (payment: Payment) =>
  payment.start_date && payment.start_date.trim() !== "" ? payment.start_date : payment.date;

export const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const findLatestPlanPaymentDate = (payments: Payment[], memberId: string) => {
  const relevant = payments.filter(
    (payment) => payment.member_id === memberId && (!payment.type || payment.type === "plan")
  );
  if (!relevant.length) return null;

  const latest = relevant.reduce((currentLatest, payment) =>
    parseLocalDate(getEffectivePaymentDate(payment)) > parseLocalDate(getEffectivePaymentDate(currentLatest))
      ? payment
      : currentLatest
  );
  return getEffectivePaymentDate(latest);
};

export const parseDueDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDate(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export const formatDueDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = parseDueDate(value);
  return parsed ? parsed.toLocaleDateString() : value;
};

export const calculatePlanEndDate = (startDate: string, plan?: Plan | null) => {
  if (!startDate) return "";
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return startDate;

  if (plan?.duration_type === "days") date.setDate(date.getDate() + plan.duration);
  else if (plan?.duration_type === "months") date.setMonth(date.getMonth() + plan.duration);
  else if (plan?.duration_type === "years") date.setFullYear(date.getFullYear() + plan.duration);

  return date.toISOString().split("T")[0];
};
