import type { Payment } from "@/lib/supabase";

const CUSTOM_PLAN_MARKER_PREFIX = "[custom_plan_id:";
const CUSTOM_PLAN_MARKER_SUFFIX = "]";
const CUSTOM_PLAN_MARKER_REGEX = /\[custom_plan_id:([^\]]+)\]/g;

const buildMarker = (planId: string) =>
  `${CUSTOM_PLAN_MARKER_PREFIX}${planId}${CUSTOM_PLAN_MARKER_SUFFIX}`;

export const ensureCustomPlanMarker = (
  description: string | null | undefined,
  planId: string
): string => {
  const base = description?.trim() ?? "";
  const marker = buildMarker(planId);
  if (base.includes(marker)) {
    return base;
  }
  if (!base) {
    return marker;
  }
  return `${base} ${marker}`;
};

export const stripCustomPlanMarker = (
  description: string | null | undefined
): string => {
  if (!description) return "";
  return description.replace(CUSTOM_PLAN_MARKER_REGEX, "").replace(/\s+/g, " ").trim();
};

export const extractCustomPlanIdFromDescription = (
  description: string | null | undefined
): string | null => {
  if (!description) return null;
  CUSTOM_PLAN_MARKER_REGEX.lastIndex = 0;
  const match = CUSTOM_PLAN_MARKER_REGEX.exec(description);
  if (!match) {
    return null;
  }
  return match[1] ?? null;
};

export const isPaymentLinkedToCustomPlan = (
  payment: Payment,
  customPlanId: string
): boolean => {
  if (payment.plan_id && payment.plan_id === customPlanId) {
    return true;
  }

  const extracted = extractCustomPlanIdFromDescription(payment.description);
  return extracted === customPlanId;
};

export const normalizeCustomPlanPaymentType = (
  payment: Payment
): Payment => {
  if (payment.type === "custom_plan") {
    return payment;
  }

  const extracted = extractCustomPlanIdFromDescription(payment.description);
  if (!extracted) {
    return payment;
  }

  return {
    ...payment,
    type: "custom_plan",
  };
};

export const normalizeCustomPlanPayments = (
  payments: Payment[]
): Payment[] => payments.map(normalizeCustomPlanPaymentType);