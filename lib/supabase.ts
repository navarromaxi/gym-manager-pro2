import { createClient } from "@supabase/supabase-js"
import type { ProspectStatusUI } from "./prospect-status"

export { CLASS_RECEIPTS_BUCKET } from "./storage"

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
  rutneg?: string | null
  dirneg?: string | null
  cityneg?: string | null
  stateneg?: string | null
  addinfoneg?: string | null
  environment?: string | null
  customerId?: string | null
  series?: string | null
  currency?: string | null
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
  rutneg: parseOptionalString(row.invoice_rutneg),
  dirneg: parseOptionalString(row.invoice_dirneg),
  cityneg: parseOptionalString(row.invoice_cityneg),
  stateneg: parseOptionalString(row.invoice_stateneg),
  addinfoneg: parseOptionalString(row.invoice_addinfoneg),
  environment: parseOptionalString(row.invoice_environment),
  customerId: parseOptionalString(row.invoice_customer_id),
  series: parseOptionalString(row.invoice_series),
  currency: parseOptionalString(row.invoice_currency),
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
  cedula?: string | null
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
  expiring_soon_contacted?: boolean;
  long_plan_followed_up?: boolean;
}

const MEMBER_BASE_SELECT_COLUMNS = [
  "id",
  "gym_id",
  "name",
  "email",
  "phone",
  "cedula",
  "referral_source",
  "join_date",
  "plan",
  "plan_price",
  "last_payment",
  "next_payment",
  "status",
] as const

const MEMBER_OPTIONAL_SELECT_COLUMNS = [
  "next_installment_due",
  "inactive_level",
  "inactive_comment",
  "followed_up",
  "expiring_soon_contacted",
  "balance_due",
] as const

const buildMemberSelectColumns = (optionalColumns: readonly string[]) =>
  [...MEMBER_BASE_SELECT_COLUMNS, ...optionalColumns].join(", ")

const getErrorText = (error: any) =>
  [error?.message, error?.details, error?.hint].filter(Boolean).join(" ")

const extractMissingMembersColumn = (error: any): string | null => {
  const text = getErrorText(error)
  if (!text) return null

  const qualifiedMatch = text.match(/members\.([a-zA-Z0-9_]+)/i)
  if (qualifiedMatch?.[1]) {
    return qualifiedMatch[1]
  }

  const schemaCacheMatch = text.match(
    /could not find the ['"]?([a-zA-Z0-9_]+)['"]? column of ['"]?members['"]? in the schema cache/i
  )
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1]
  }

  const genericMatch = text.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i)
  return genericMatch?.[1] ?? null
}

export async function selectMembersWithFallback(gymId: string) {
  const optionalColumns = [...MEMBER_OPTIONAL_SELECT_COLUMNS]

  while (true) {
    const selectedColumns = buildMemberSelectColumns(optionalColumns)
    let query = supabase
      .from("members")
      .select(selectedColumns)
      .eq("gym_id", gymId)

    if (optionalColumns.includes("balance_due")) {
      query = query
        .order("balance_due", { ascending: false })
        .order("last_payment", { ascending: false })
    } else {
      query = query.order("last_payment", { ascending: false })
    }

    const result = await query
    if (!result.error) {
      return result
    }

    const missingColumn = extractMissingMembersColumn(result.error)
    if (!missingColumn || !optionalColumns.includes(missingColumn as any)) {
      return result
    }

    const index = optionalColumns.indexOf(missingColumn as any)
    optionalColumns.splice(index, 1)
    console.warn(
      `Columna opcional de members no disponible: ${missingColumn}. Se reintenta sin ella.`,
      result.error
    )
  }
}

const cloneWithoutKey = <T extends Record<string, any>>(value: T, key: string) => {
  const next = { ...value }
  delete next[key]
  return next
}

async function runMembersWriteWithFallback<T>(
  initialPayload: Record<string, any>,
  execute: (payload: Record<string, any>) => PromiseLike<T & { error?: any }>
) {
  let payload = { ...initialPayload }

  while (true) {
    const result = await execute(payload)
    if (!result.error) {
      return result
    }

    const missingColumn = extractMissingMembersColumn(result.error)
    if (!missingColumn || !(missingColumn in payload)) {
      return result
    }

    payload = cloneWithoutKey(payload, missingColumn)
    console.warn(
      `Columna opcional de members no disponible en escritura: ${missingColumn}. Se reintenta sin ella.`,
      result.error
    )
  }
}

export async function insertMemberWithFallback(member: Record<string, any>) {
  return runMembersWriteWithFallback(member, (payload) =>
    supabase.from("members").insert([payload]).then((result) => result)
  )
}

export async function updateMemberWithFallback(
  memberId: string,
  changes: Record<string, any>
) {
  return runMembersWriteWithFallback(changes, (payload) =>
    supabase
      .from("members")
      .update(payload)
      .eq("id", memberId)
      .then((result) => result)
  )
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
  price?: number | null
  notes?: string | null
  created_at?: string | null
  accept_receipts: boolean
}

export interface ClassRegistration {
  id: string
  session_id: string
  gym_id: string
  full_name: string
  email?: string | null
  phone?: string | null
  created_at?: string | null
  receipt_url?: string | null
  receipt_storage_path?: string | null
}

export interface MemberAccessLog {
  id: string
  gym_id: string
  member_id?: string | null
  member_name?: string | null
  cedula_entered: string
  normalized_cedula: string
  result: "active" | "expiring" | "expired" | "not_found"
  status_color: "green" | "yellow" | "red"
  message: string
  days_remaining?: number | null
  days_expired?: number | null
  created_at?: string | null
}
