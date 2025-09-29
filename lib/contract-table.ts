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
  const { data, error } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .in("table_name", CONTRACT_TABLE_CANDIDATES);

    if (error) {
    if (!isMissingTableError(error)) {
      console.warn(
        "Error while looking up contract table candidates in information_schema:",
        error,
      );
    }

     return null;
  }

  const tables = new Set<ContractTableName>(
    data?.map((table) => table.table_name as ContractTableName) ?? [],
  );

  for (const table of CONTRACT_TABLE_CANDIDATES) {
    if (tables.has(table)) {
      return table;
    }
  }

  return null;
};