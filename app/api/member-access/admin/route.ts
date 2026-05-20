import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const querySchema = z.object({
  gymId: z.string().min(1, "El gimnasio es obligatorio."),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["all", "active", "expiring", "expired", "not_found"])
    .default("all"),
  search: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  reportRange: z.enum(["week", "month"]).default("week"),
});

type SummaryRow = {
  total_count: number | string | null;
  active_count: number | string | null;
  expiring_count: number | string | null;
  expired_count: number | string | null;
  not_found_count: number | string | null;
  unique_members: number | string | null;
};

type PeakHourRow = {
  hour_of_day: number | string | null;
  access_count: number | string | null;
};

type TopMemberRow = {
  member_id: string | null;
  member_name: string | null;
  access_count: number | string | null;
  last_access: string | null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfWeek = () => {
  const date = startOfToday();
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - offset);
  return date;
};

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const endOfToday = () => {
  const date = startOfToday();
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildHistoryQuery = (
  supabase: ReturnType<typeof createClient>,
  params: z.infer<typeof querySchema>
) => {
  let query = supabase
    .from("member_access_logs")
    .select(
      "id, gym_id, member_id, member_name, cedula_entered, normalized_cedula, result, status_color, message, days_remaining, days_expired, created_at",
      { count: "exact" }
    )
    .eq("gym_id", params.gymId);

  if (params.status !== "all") {
    query = query.eq("result", params.status);
  }

  if (params.startDate) {
    query = query.gte("created_at", `${params.startDate}T00:00:00`);
  }

  if (params.endDate) {
    query = query.lte("created_at", `${params.endDate}T23:59:59.999`);
  }

  const trimmedSearch = params.search.trim();
  if (trimmedSearch) {
    const escaped = trimmedSearch.replace(/[%_]/g, "\\$&");
    query = query.or(
      `member_name.ilike.%${escaped}%,cedula_entered.ilike.%${escaped}%,message.ilike.%${escaped}%`
    );
  }

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  return query.order("created_at", { ascending: false }).range(from, to);
};

const fetchSummary = async (
  supabase: ReturnType<typeof createClient>,
  gymId: string,
  from: Date,
  to: Date
) => {
  const { data, error } = await supabase.rpc("member_access_summary", {
    p_gym_id: gymId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) throw error;
  const row = ((data as SummaryRow[] | null) ?? [])[0];

  return {
    total: toNumber(row?.total_count),
    active: toNumber(row?.active_count),
    expiring: toNumber(row?.expiring_count),
    expired: toNumber(row?.expired_count),
    notFound: toNumber(row?.not_found_count),
    unique: toNumber(row?.unique_members),
  };
};

const fetchPeakHours = async (
  supabase: ReturnType<typeof createClient>,
  gymId: string,
  from: Date,
  to: Date
) => {
  const { data, error } = await supabase.rpc("member_access_peak_hours", {
    p_gym_id: gymId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_limit: 5,
  });

  if (error) throw error;

  return ((data as PeakHourRow[] | null) ?? []).map((row) => ({
    hour: toNumber(row.hour_of_day),
    count: toNumber(row.access_count),
  }));
};

const fetchTopMembers = async (
  supabase: ReturnType<typeof createClient>,
  gymId: string,
  from: Date,
  to: Date,
  limit: number
) => {
  const { data, error } = await supabase.rpc("member_access_top_members", {
    p_gym_id: gymId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_limit: limit,
  });

  if (error) throw error;

  return ((data as TopMemberRow[] | null) ?? []).map((row) => ({
    memberId: row.member_id,
    name: row.member_name,
    count: toNumber(row.access_count),
    lastAccess: row.last_access,
  }));
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    gymId: url.searchParams.get("gymId") ?? "",
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    search: url.searchParams.get("search") ?? "",
    startDate: url.searchParams.get("startDate") ?? "",
    endDate: url.searchParams.get("endDate") ?? "",
    reportRange: url.searchParams.get("reportRange") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Los parámetros del reporte de ingresos no son válidos.",
      },
      { status: 400 }
    );
  }

  const params = parsed.data;

  try {
    const supabase = createClient();
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const rangeStart =
      params.reportRange === "week" ? startOfWeek() : startOfMonth();
    const monthStart = startOfMonth();

    const [
      historyResponse,
      todaySummary,
      rangeSummary,
      peakHours,
      topMembersThisMonth,
    ] = await Promise.all([
      buildHistoryQuery(supabase, params),
      fetchSummary(supabase, params.gymId, todayStart, todayEnd),
      fetchSummary(supabase, params.gymId, rangeStart, todayEnd),
      fetchPeakHours(supabase, params.gymId, todayStart, todayEnd),
      fetchTopMembers(supabase, params.gymId, monthStart, todayEnd, 10),
    ]);

    if (historyResponse.error) {
      throw historyResponse.error;
    }

    return NextResponse.json({
      history: {
        items: historyResponse.data ?? [],
        total: historyResponse.count ?? 0,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.max(
          1,
          Math.ceil((historyResponse.count ?? 0) / params.pageSize)
        ),
      },
      todaySummary,
      rangeSummary,
      topHoursToday: peakHours,
      topMembersThisMonth,
      meta: {
        reportRange: params.reportRange,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: todayEnd.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error loading member access admin data", error);
    const normalizedMessage = error?.message?.toLowerCase?.() ?? "";
    const setupHint =
      normalizedMessage.includes("does not exist") ||
      normalizedMessage.includes("schema cache") ||
      normalizedMessage.includes("permission denied") ||
      normalizedMessage.includes("function")
        ? "Debes ejecutar el SQL actualizado de member_access_logs para habilitar los reportes de ingresos."
        : "No se pudieron cargar los ingresos. Intenta nuevamente en unos segundos.";

    return NextResponse.json(
      {
        error: setupHint,
      },
      { status: 500 }
    );
  }
}
