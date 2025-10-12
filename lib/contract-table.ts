import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "./supabase";

export type ContractTableName = "plan_contracts" | "plan_contract";

const CONTRACT_TABLE_CANDIDATES: ContractTableName[] = [
  "plan_contract",
  "plan_contracts",
];

const isMissingTableError = (error: PostgrestError | null) => {
  if (!error) return false;

  if (error.code && ["PGRST116", "42P01"].includes(error.code)) {
    return true;
  }

  const message = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("not found");
};

export const detectContractTable = async (): Promise<ContractTableName | null> => {
  for (const table of CONTRACT_TABLE_CANDIDATES) {
    const { error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (!error) {
      return table;
    }

    if (!isMissingTableError(error)) {
      console.warn(
        "Unexpected error while probing contract table candidate:",
        table,
        error,
      );
    return null;
    }
  }

  return null;
};