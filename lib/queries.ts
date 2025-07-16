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