// ARCHIVO DONDE VAMOS A HACER DETERMINADAS QUERIES PARA TENER LA LOGICA DE FILTRADO EN SUPABASE Y NO ESTAR SOLICITANDO
//TODO EL TIEMPO AL FRONTEND QUE HAGA LAS CONSULTAS
import { supabase } from "./supabase";
import { Member } from "./supabase";


//QUERY PARA TRAER INACTIVOS
export async function fetchInactiveMembers(gymId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
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
    .select("*", { count: "exact" })
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