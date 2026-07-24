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

export type ConversionData = {
  plan: string;
  planPrice: number;
  planStartDate: string;
  paymentDate: string;
  installments: number;
  paymentAmount: number;
  paymentMethod: string;
  cardBrand: string;
  cardInstallments: number;
  description: string;
  referralSource: string;
  nextInstallmentDue: string;
};

export const createInitialConversionData = (): ConversionData => {
  const today = new Date().toISOString().split("T")[0];
  return {
    plan: "", planPrice: 0, planStartDate: today, paymentDate: today,
    installments: 1, paymentAmount: 0, paymentMethod: "Efectivo", cardBrand: "",
    cardInstallments: 1, description: "", referralSource: "", nextInstallmentDue: today,
  };
};

export const parseScheduledDate = (value?: string | null) => {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const normalized = trimmed.includes("T") ? trimmed : trimmed.includes(" ")
    ? trimmed.replace(" ", "T") : `${trimmed}T00:00:00`;
  let parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}))?$/);
    if (match) {
      const [, day, month, year, time] = match;
      parsed = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}${time ? `T${time}` : "T00:00"}:00`);
    }
  }
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatScheduledDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = parseScheduledDate(value);
  if (!parsed) return null;
  return parsed.toLocaleString(undefined, value.includes(":")
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" });
};
