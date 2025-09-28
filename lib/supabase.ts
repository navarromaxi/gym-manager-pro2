import { createClient } from "@supabase/supabase-js"
import type { ProspectStatusUI } from "./prospect-status"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

//export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Tipos para TypeScript
export interface Member {
  id: string
  gym_id: string
  name: string
  email: string
  phone: string
  referral_source?: string | null
  join_date: string
  plan: string
  plan_price: number
  description?: string | null
  balance_due?: number
  last_payment: string
  next_payment: string
  next_installment_due?: string | null
  status: "active" | "expired" | "inactive"
  inactive_level?: "green" | "yellow" | "red"
  inactive_comment?: string
  //balance_due: number
  followed_up?: boolean;
}

export interface Payment {
  id: string
  gym_id: string
  member_id: string
  member_name: string
  amount: number
  date: string
  start_date?: string
  plan?: string
  method: string
  card_brand?: string | null
  card_installments?: number | null
  type: "plan" | "product" | "custom_plan"
  description?: string | null
  plan_id?: string
}

export interface Expense {
  id: string
  gym_id: string
  description: string
  amount: number
  date: string
  category: string
  is_recurring: boolean
}

export interface Prospect {
  id: string
  gym_id: string
  name: string
  email: string
  phone: string
  contact_date: string
  interest: string
  status: ProspectStatusUI
  notes: string
  priority_level?: "green" | "yellow" | "red" // ¡NUEVA PROPIEDAD!
  scheduled_date?: string | null
  created_at?: string
  next_contact_date?: string | null
}

export interface Plan {
  id: string
  gym_id: string
  name: string
  description: string
  price: number
  duration: number
  duration_type: "days" | "months" | "years"
  activities: string[]
  is_active: boolean
}

export interface PlanContract {
  id: string
  gym_id: string
  member_id: string
  plan_id: string
  installments_total: number
  installments_paid: number
}

export interface CustomPlan {
  id: string
  gym_id: string
  member_id: string
  member_name: string
  name: string
  description: string
  price: number
  start_date?: string | null
  end_date: string
  is_active: boolean
}

export interface Activity {
  id: string
  gym_id: string
  name: string
  description: string
  instructor: string
  capacity: number
  duration: number
  schedule: { day: string; startTime: string; endTime: string }[]
  is_active: boolean
  created_at: string // 👈 AGREGAR ESTO
}

export interface OneTimePayment {
  id: string
  gym_id: string
  full_name: string
  phone: string
  source: string
  amount: number | null
  description?: string | null
  visit_date: string
  estimated_payment_date: string
  created_at?: string | null
}

export interface Product {
  id: string
  gym_id: string
  name: string
  description: string
  price: number
  is_active: boolean
}
