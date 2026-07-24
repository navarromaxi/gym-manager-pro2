import type { PlanContract } from "@/lib/supabase";

export type RawPlanContract = PlanContract & {
  created_at?: string | null;
  start_date?: string | null;
  startDate?: string | null;
};

const parseTimestamp = (value?: string | null): number => {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const getContractTimestamp = (contract: RawPlanContract): number => {
  const candidates = [contract.start_date, contract.startDate, contract.created_at];
  for (const candidate of candidates) {
    const timestamp = parseTimestamp(candidate);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  const idParts = contract.id.split("_");
  const possibleTimestamp = Number.parseInt(idParts[idParts.length - 1] ?? "", 10);
  return Number.isFinite(possibleTimestamp) ? possibleTimestamp : 0;
};

/** Picks the newest contract that still has installments outstanding. */
export const pickRelevantPlanContract = (
  contracts: RawPlanContract[] | null | undefined
): PlanContract | null => {
  if (!contracts?.length) return null;
  const orderedContracts = [...contracts].sort(
    (a, b) => getContractTimestamp(b) - getContractTimestamp(a)
  );
  return orderedContracts.find(
    (contract) => contract.installments_paid < contract.installments_total
  ) ?? null;
};
