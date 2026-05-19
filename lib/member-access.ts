import type { Member } from "./supabase";

export type MemberAccessStatus = "active" | "expiring" | "expired" | "not_found";
export type MemberAccessColor = "green" | "yellow" | "red";

export interface MemberAccessEvaluation {
  found: boolean;
  memberId: string | null;
  memberName: string | null;
  status: MemberAccessStatus;
  color: MemberAccessColor;
  message: string;
  daysRemaining: number | null;
  daysExpired: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const normalizeCedula = (value: string) =>
  value.replace(/\D+/g, "").trim();

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const parseLocalDate = (iso?: string | null) => {
  if (!iso) return null;
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const evaluateMemberAccess = (
  member: Pick<Member, "id" | "name" | "next_payment"> | null
): MemberAccessEvaluation => {
  if (!member) {
    return {
      found: false,
      memberId: null,
      memberName: null,
      status: "not_found",
      color: "red",
      message: "No encontramos un socio con esa cédula.",
      daysRemaining: null,
      daysExpired: null,
    };
  }

  const nextPaymentDate = parseLocalDate(member.next_payment);
  if (!nextPaymentDate) {
    return {
      found: true,
      memberId: member.id,
      memberName: member.name,
      status: "expired",
      color: "red",
      message: "Tu plan esta vencido, por favor comunicarte con nuestro equipo.",
      daysRemaining: null,
      daysExpired: null,
    };
  }

  const today = startOfToday();
  const diffDays = Math.ceil(
    (nextPaymentDate.getTime() - today.getTime()) / MS_PER_DAY
  );

  if (diffDays < 0) {
    return {
      found: true,
      memberId: member.id,
      memberName: member.name,
      status: "expired",
      color: "red",
      message: "Tu plan esta vencido, por favor comunicarte con nuestro equipo.",
      daysRemaining: null,
      daysExpired: Math.abs(diffDays),
    };
  }

  if (diffDays <= 10) {
    return {
      found: true,
      memberId: member.id,
      memberName: member.name,
      status: "expiring",
      color: "yellow",
      message:
        diffDays === 0
          ? "Tu plan vence hoy."
          : `Tu plan vence en ${diffDays} dia${diffDays === 1 ? "" : "s"}.`,
      daysRemaining: diffDays,
      daysExpired: null,
    };
  }

  return {
    found: true,
    memberId: member.id,
    memberName: member.name,
    status: "active",
    color: "green",
    message: "Bienvenido",
    daysRemaining: diffDays,
    daysExpired: null,
  };
};
