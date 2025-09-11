// ARCHIVO DONDE VAMOS A HACER DETERMINADAS QUERIES PARA TENER LA LOGICA DE FILTRADO EN SUPABASE Y NO ESTAR SOLICITANDO
//TODO EL TIEMPO AL FRONTEND QUE HAGA LAS CONSULTAS
import { supabase } from "./supabase";
import { Member } from "./supabase";


//QUERY PARA TRAER INACTIVOS
export async function fetchInactiveMembers(gymId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select(
      "id, gym_id, name, email, phone, join_date, plan, plan_price, last_payment, next_payment, status, inactive_level, inactive_comment, followed_up, balance_due"
    )
    .eq("gym_id", gymId)
    .eq("status", "inactive"); // esto trae solo los inactivos

  if (error) {
    console.error("Error fetching inactive members:", error);
    return [];
  }

  return data;
}

// ✅ NUEVO: tipos y función de paginación
export type MembersPageParams = {
  gymId: string;
  page: number;       // 1-based
  pageSize: number;   // ej. 50
  search?: string;    // filtra por nombre/email
  orderBy?: "last_payment" | "next_payment" | "name";
  ascending?: boolean;
};

export async function fetchMembersPage(params: MembersPageParams) {
  const {
    gymId,
    page,
    pageSize,
    search = "",
    orderBy = "last_payment",
    ascending = false,
  } = params;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("members")
    .select(
      "id, gym_id, name, email, phone, join_date, plan, plan_price, last_payment, next_payment, status, inactive_level, inactive_comment, followed_up, balance_due",
      { count: "exact" }
    )
    .eq("gym_id", gymId)
    .order(orderBy, { ascending });

  if (search.trim()) {
    const s = search.trim();
    q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
  }

  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data || []) as Member[],
    total: count ?? 0,
  };
  }

// Suma los pagos asociados a un contract_id y calcula el saldo pendiente
export async function getContractPaymentSummary(
  contractId: string,
  planTotal: number
) {
  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .eq("contract_id", contractId);

  if (error) {
    console.error("Error fetching contract payments:", error);
    return { paid: 0, pending: planTotal, status: "pending" as const };
  }

  const paid = (data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const pending = planTotal - paid;
  return {
    paid,
    pending,
    status: pending <= 0 ? "paid" : "pending",
  };
}