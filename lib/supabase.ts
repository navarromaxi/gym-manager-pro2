import { createClient } from "@supabase/supabase-js"

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
  join_date: string
  plan: string
  plan_price: number
  last_payment: string
  next_payment: string
  status: "active" | "expired" | "inactive"
  inactive_level?: "green" | "yellow" | "red"
  inactive_comment?: string
  followed_up?: boolean; // 👈 AÑADIR ESTA LÍNEA
}

export interface Payment {
  id: string
  gym_id: string
  member_id: string
  member_name: string
  amount: number
  date: string
  plan?: string
  method: string
  card_brand?: string
  type: "plan" | "product"
  description?: string
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
  status:
    | "new"
    | "contacted"
    | "waiting_response"
    | "waiting_info"
    | "trial_scheduled"
    | "trial_completed"
    | "not_interested"
    | "contact_later";
  notes: string
  priority_level?: "green" | "yellow" | "red" // ¡NUEVA PROPIEDAD!
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

export interface CustomPlan {
  id: string
  gym_id: string
  member_id: string
  member_name: string
  name: string
  description: string
  price: number
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

export interface Product {
  id: string
  gym_id: string
  name: string
  description: string
  price: number
  is_active: boolean
}
