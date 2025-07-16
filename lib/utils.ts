import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Member } from "@/lib/supabase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


//Logica para poder utilizar que me recalcule el stado del socio para mostrar los inactivos
export function getRealStatus(member: Member): "active" | "expired" | "inactive" {
  const today = new Date();
  const next = new Date(member.next_payment);
  const diffMs = today.getTime() - next.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "active";
  if (diffDays <= 30) return "expired";
  return "inactive";
}