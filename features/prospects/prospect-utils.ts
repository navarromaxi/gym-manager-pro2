import type { Plan } from "@/lib/supabase";

export const PROSPECTS_PER_BATCH = 10;

/** Calculates the exact plan end date used when a lead becomes a member. */
export const calculatePlanEndDate = (startDate: string, plan?: Plan | null) => {
  if (!startDate) return "";
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return startDate;

  if (plan?.duration_type === "days") date.setDate(date.getDate() + plan.duration);
  else if (plan?.duration_type === "months") date.setMonth(date.getMonth() + plan.duration);
  else if (plan?.duration_type === "years") date.setFullYear(date.getFullYear() + plan.duration);

  return date.toISOString().split("T")[0];
};
