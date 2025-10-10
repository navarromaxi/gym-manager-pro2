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

// === Tipos de apoyo ===
export interface GymInvoiceConfig {
  userId?: string | null
  companyId?: string | null
  branchCode?: string | null
  branchId?: string | null
  environment?: string | null
  customerId?: string | null
  series?: string | null
  currency?: string | null
  cotizacion?: number | null
  typecfe?: number | null
  tipoTraslado?: number | null
}

export interface Gym extends GymInvoiceConfig {
  id: string
  name: string
  logo_url?: string | null
  subscription?: string | null
}

const parseOptionalString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null
  }
  return null
}

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export const mapGymInvoiceConfig = (
  row: Partial<Record<string, any>>
): GymInvoiceConfig => ({
  userId: parseOptionalString(row.invoice_user_id),
  companyId: parseOptionalString(row.invoice_company_id),
  branchCode: parseOptionalString(row.invoice_branch_code),
  branchId: parseOptionalString(row.invoice_branch_id),
  environment: parseOptionalString(row.invoice_environment),
  customerId: parseOptionalString(row.invoice_customer_id),
  series: parseOptionalString(row.invoice_series),
  currency: parseOptionalString(row.invoice_currency),
  cotizacion: parseOptionalNumber(row.invoice_cotizacion),
  typecfe: parseOptionalNumber(row.invoice_typecfe),
  tipoTraslado: parseOptionalNumber(row.invoice_tipo_traslado),
})

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

export interface Invoice {
  id: string
  gym_id: string
  payment_id: string
  member_id?: string | null
  member_name: string
  total: number
  currency: string
  status: string
  invoice_number?: string | null
  invoice_series?: string | null
  external_invoice_id?: string | null
  environment?: string | null
  typecfe?: number | null
  issued_at: string
  due_date?: string | null
  request_payload?: Record<string, any> | null
  response_payload?: Record<string, any> | null
  created_at?: string | null
  updated_at?: string | null
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
  payment_method?: string | null
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

export interface ClassSession {
  id: string
  gym_id: string
  title: string
  date: string
  start_time: string
  capacity: number
  notes?: string | null
  created_at?: string | null
}

export interface ClassRegistration {
  id: string
  session_id: string
  gym_id: string
  full_name: string
  email?: string | null
  phone?: string | null
  created_at?: string | null
}