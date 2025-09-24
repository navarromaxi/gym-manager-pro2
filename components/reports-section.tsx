"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Filter,
  RefreshCw,
} from "lucide-react";
import { PieChart, Pie } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  joinDate?: string;
  join_date?: string;
  plan?: string;
  planPrice?: number;
  plan_price?: number;
  lastPayment?: string;
  last_payment?: string;
  nextPayment?: string;
  next_payment?: string;
  nextInstallmentDue?: string | null;
  next_installment_due?: string | null;
  status?: "active" | "expired" | "inactive";
  inactiveLevel?: "green" | "yellow" | "red";
  inactive_level?: "green" | "yellow" | "red";
  inactiveComment?: string | null;
  inactive_comment?: string | null;
  description?: string | null;
  balanceDue?: number | null;
  balance_due?: number | null;
  followedUp?: boolean | null;
  followed_up?: boolean | null;
  planEndDate?: string | null;
  plan_end_date?: string | null;
}

interface Payment {
  id: string;
  memberId?: string;
  member_id?: string;
  memberName?: string;
  member_name?: string;
  amount: number;
  date: string;
  plan?: string;
  plan_name?: string;
  method: string;
  cardBrand?: string;
  card_brand?: string;
  cardInstallments?: number;
  card_installments?: number;
  start_date?: string;
  startDate?: string;
  type: "plan" | "product";
  description?: string;
  plan_id?: string;
  product_id?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  is_recurring?: boolean;
}

type ProspectStatus =
  | "averiguador"
  | "trial_scheduled"
  | "reagendado"
  | "asistio"
  | "no_asistio"
  | "inactivo"
  | "otro";

type ProspectPriority = "green" | "yellow" | "red";

interface Prospect {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contactDate?: string | null;
  contact_date?: string | null;
  interest?: string | null;
  status?: ProspectStatus | null;
  notes?: string | null;
  priority_level?: ProspectPriority | null;
  priorityLevel?: ProspectPriority | null;
  scheduled_date?: string | null;
  scheduledDate?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
}

interface CustomPlan {
  id: string;
  member_id?: string;
  memberId?: string;
  member_name?: string;
  memberName?: string;
  name: string;
  description?: string | null;
  price?: number | null;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  is_active?: boolean | null;
  isActive?: boolean | null;
  payment_date?: string | null;
  paymentDate?: string | null;
  payment_method?: string | null;
  paymentMethod?: string | null;
  card_brand?: string | null;
  cardBrand?: string | null;
  card_installments?: number | null;
  cardInstallments?: number | null;
}

interface ReportsSectionProps {
  members: Member[];
  payments: Payment[];
  expenses: Expense[];
  prospects: Prospect[];
  customPlans: CustomPlan[];
  gymName: string;
}

/** ==== Helpers de fecha ==== */
function toLocalMidnight(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function parseDateSafe(s?: string | null) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function downloadBlob(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// CSV helper (usa ; para Excel ES). Tolera filas con distintas columnas.
function toCSV(rows: Array<Record<string, any>>): string {
  if (!rows || rows.length === 0) return "";

  // unimos todas las keys que aparezcan en cualquier fila (en orden)
  const headersSet = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => headersSet.add(k)));
  const headers = Array.from(headersSet);

  const escape = (val: any) => {
    const s = String(val ?? "");
    return /[;\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ];

  return lines.join("\n");
}

type DerivedStatus = "active" | "expired" | "inactive";
type DerivedMember = Member & {
  derivedStatus: DerivedStatus;
  _next: Date | null;
};

export function ReportsSection({
  members,
  payments,
  expenses,
  prospects,
  customPlans,
  gymName,
}: ReportsSectionProps) {
  const [timeFilter, setTimeFilter] = useState("current_month");
  const currentDate = new Date();

  /** =================== Estado REAL (misma lógica que MemberManagement) =================== */
// Normaliza "YYYY-MM-DD" a medianoche local (evita desfase por UTC)
const toLocalDate = (isoDate: string) => new Date(`${isoDate}T00:00:00`);

const todayMid = toLocalMidnight(new Date());

/** === helpers de fecha consistentes con MemberManagement === */
function toLocalDateISO(s?: string | null) {
  if (!s) return null;
  // normaliza "YYYY-MM-DD" a medianoche local (evita desfase UTC)
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function getRealStatusReport(m: Member): DerivedStatus {
  const todayMid = toLocalMidnight(new Date());
  const rawNext =
    (m as any).nextPayment ??
    (m as any).next_payment ??
    m.nextPayment ??
    m.next_payment ??
    null;
  const next = toLocalDateISO(typeof rawNext === "string" ? rawNext : null);
  if (!next) return "expired"; // sin fecha lo tratamos como vencido
  const nextMid = toLocalMidnight(next);
  const diffDays = Math.ceil((todayMid.getTime() - nextMid.getTime()) / 86400000);
  if (diffDays <= 0) return "active";
  if (diffDays <= 30) return "expired";
  return "inactive";
}

/** =================== Derivar estado por fecha (CONSISTENTE) =================== */
//const todayMid = toLocalMidnight(new Date());

// helpers para tolerar camelCase / snake_case
const pick = <T extends object>(obj: T, ...keys: string[]) => {
  for (const k of keys) {
    const v = (obj as any)[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};
const toLocalDateFromISO = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00`) : null;

const memberIdOf = (payment: Payment): string | undefined =>
  (pick(payment as any, "member_id", "memberId") as string | undefined) ||
  undefined;

const membersWithDerived: DerivedMember[] = members.map((m) => {
  // tomar status y next payment sin importar el formato
  const rawStatus = pick(m, "status"); // en tu tabla es "status"
  const rawNextISO = pick(m as any, "nextPayment", "next_payment");

  // si está marcado como inactivo en DB, respetarlo
  if (rawStatus === "inactive") {
    const nextD = toLocalDateFromISO(rawNextISO);
    return {
      ...m,
      derivedStatus: "inactive",
      _next: nextD ? toLocalMidnight(nextD) : null,
    };
  }

  // normalizar fecha y derivar como en member-management (getRealStatus)
  const nextD = toLocalDateFromISO(rawNextISO);
  if (!nextD) {
    // sin fecha válida => tratar como vencido
    return { ...m, derivedStatus: "expired", _next: null };
  }

  const nextMid = toLocalMidnight(nextD);
  const diffDays = Math.ceil((todayMid.getTime() - nextMid.getTime()) / 86400000);

  let derived: DerivedStatus;
  if (diffDays <= 0) derived = "active";
  else if (diffDays <= 30) derived = "expired";
  else derived = "inactive";

  return { ...m, derivedStatus: derived, _next: nextMid };
});

// Conteos derivados (ahora consistentes con member-management)
const activeMembers   = membersWithDerived.filter((m) => m.derivedStatus === "active").length;
const expiredMembers  = membersWithDerived.filter((m) => m.derivedStatus === "expired").length;
const inactiveMembers = membersWithDerived.filter((m) => m.derivedStatus === "inactive").length;

// Próximos vencimientos (0–7 días)
const upcomingExpirations = membersWithDerived.filter((m) => {
  if (!m._next) return false;
  const diffDays = Math.ceil((m._next.getTime() - todayMid.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 7;
});

// Morosos = vencidos (derivados)
const overdueMembers = membersWithDerived.filter((m) => m.derivedStatus === "expired");


  /** =================== Filtro por período (ingresos/gastos) =================== */
  const getFilteredData = () => {
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    const startOfMonth = (year: number, month: number) =>
      toLocalMidnight(new Date(year, month, 1));
    const endOfMonth = (year: number, month: number) =>
      toLocalMidnight(new Date(year, month + 1, 0));

    switch (timeFilter) {
      case "current_month": {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        periodStart = startOfMonth(year, month);
        periodEnd = endOfMonth(year, month);
        break;
        }

      case "previous_month": {
        const month = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
        const year =
          currentDate.getMonth() === 0
            ? currentDate.getFullYear() - 1
            : currentDate.getFullYear();
       periodStart = startOfMonth(year, month);
        periodEnd = endOfMonth(year, month);
        break;
      }

      case "last_6_months": {
         const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        start.setMonth(start.getMonth() - 6);
        periodStart = start;
        periodEnd = todayMid;
        break;
      }

       case "current_year": {
        const year = currentDate.getFullYear();
        periodStart = startOfMonth(year, 0);
        periodEnd = endOfMonth(year, 11);
        break;
        }

      case "last_year": {
        const year = currentDate.getFullYear() - 1;
        periodStart = startOfMonth(year, 0);
        periodEnd = endOfMonth(year, 11);
        break;
      }
       default:
        periodStart = null;
        periodEnd = null;
    }
const isWithinPeriod = (date: Date) => {
      if (periodStart && date < periodStart) return false;
      if (periodEnd && date > periodEnd) return false;
      return true;
    };

    const filteredPayments = payments.filter((payment) =>
      isWithinPeriod(toLocalDate(payment.date))
    );
    const filteredExpenses = expenses.filter((expense) =>
      isWithinPeriod(toLocalDate(expense.date))
    );

    return { filteredPayments, filteredExpenses, periodStart, periodEnd };
  };

  const { filteredPayments, filteredExpenses, periodStart, periodEnd } =
    getFilteredData();

  // Cálculos con datos filtrados
  const totalIncome = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenseAmount = filteredExpenses.reduce(
    (sum, e) => sum + e.amount,
    0
  );
  const totalProfit = totalIncome - totalExpenseAmount;

  /** =================== Renovaciones (usando estado derivado) =================== */
  /** =================== Renovaciones ===================
 *  - Renovaron: socios con >1 pago histórico que pagaron en el período
   *  - No renovaron: vencidos/inactivos con vencimiento en el período
   *  - Elegibles: renovaron + no_renovaron
   */
  const filteredPlanPayments = filteredPayments.filter(
    (payment) => (payment.type ?? "plan") === "plan"
  );

  const getRenewalStats = () => {
    // Conteo histórico de pagos de planes por socio
    const historicalCounts: Record<string, number> = {};
    for (const payment of payments) {
      if ((payment.type ?? "plan") !== "plan") continue;
      const memberId = memberIdOf(payment);
      if (!memberId) continue;
      historicalCounts[memberId] = (historicalCounts[memberId] || 0) + 1;
    }

  const filteredMemberIds = new Set<string>();
    for (const payment of filteredPlanPayments) {
      const memberId = memberIdOf(payment);
      if (!memberId) continue;
      filteredMemberIds.add(memberId);
    }

   const renewedCount = Array.from(filteredMemberIds).filter(
      (memberId) => (historicalCounts[memberId] || 0) > 1
    ).length;

  const notRenewedMembers = membersWithDerived.filter((member) => {
      if (member.derivedStatus === "active") return false;
      if (periodStart || periodEnd) {
        if (!member._next) return false;
        if (periodStart && member._next < periodStart) return false;
        if (periodEnd && member._next > periodEnd) return false;
      }
      return true;
    });

    const notRenewedCount = notRenewedMembers.length;
    const totalEligible = renewedCount + notRenewedCount;
    const renewalRate =
      totalEligible > 0 ? Math.round((renewedCount / totalEligible) * 100) : 0;

    return { renewedCount, notRenewedCount, renewalRate, totalEligible };
  };



  const renewalStats = getRenewalStats();


  const renewalChartData = [
    {
      status: "renovaron",
      value: renewalStats.renewedCount,
      fill: "var(--color-renovaron)",
    },
    {
      status: "noRenovaron",
      value: renewalStats.notRenewedCount,
      fill: "var(--color-noRenovaron)",
    },
  ];

  const renewalChartConfig = {
    renovaron: { label: "Renovaron", color: "hsl(var(--chart-1))" },
    noRenovaron: { label: "No Renovaron", color: "hsl(var(--chart-2))" },
  };

  /** =================== Distribuciones y series =================== */
  const resolvePlanLabel = (payment: Payment) => {
    const rawPlan = pick(payment as any, "plan", "plan_name");
    if (typeof rawPlan === "string" && rawPlan.trim().length > 0) {
      return rawPlan;
    }

    const memberId = memberIdOf(payment);
    if (memberId) {
      const memberPlan = members.find((member) => member.id === memberId)?.plan;
      if (memberPlan) return memberPlan;
    }

    return "Plan no especificado";
  };

  const planDistributionMap = new Map<string, Set<string>>();
  for (const payment of filteredPlanPayments) {
    const planLabel = resolvePlanLabel(payment);
    const memberId = memberIdOf(payment) ?? `${payment.id}-sin-socio`;
    if (!planDistributionMap.has(planLabel)) {
      planDistributionMap.set(planLabel, new Set());
    }
    planDistributionMap.get(planLabel)!.add(memberId);
  }

  const planDistributionEntries = Array.from(planDistributionMap.entries()).map(
    ([plan, memberIds]) => ({ plan, count: memberIds.size })
  );
  planDistributionEntries.sort((a, b) => b.count - a.count);

  const totalPlanMembers = planDistributionEntries.reduce(
    (sum, entry) => sum + entry.count,
    0
  );

  const paymentMethodDistribution = filteredPayments.reduce((acc, payment) => {
    acc[payment.method] = (acc[payment.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const creditCardPayments = filteredPayments.filter(
    (p) => p.method === "Tarjeta de Crédito"
  );
  const debitCardPayments = filteredPayments.filter(
    (p) => p.method === "Tarjeta de Débito"
  );

  const cardBrands = [
    "VISA",
    "OCA",
    "MASTER",
    "CABAL",
    "AMEX",
    "TARJETA D",
    "MERCADO PAGO",
  ];

   const buildCardStats = (paymentsList: Payment[]) =>
    paymentsList.reduce(
      (acc, payment) => {
        const brand =
          pick(payment as any, "card_brand", "cardBrand") || "Otra";
        if (!acc[brand]) acc[brand] = { count: 0, amount: 0 };
        acc[brand].count += 1;
        acc[brand].amount += payment.amount;
        return acc;
      },
      {} as Record<string, { count: number; amount: number }>
    );

  const buildCardDistribution = (
    stats: Record<string, { count: number; amount: number }>,
    totalPayments: number
  ) =>
    cardBrands.map((brand) => ({
      brand,
      count: stats[brand]?.count || 0,
      amount: stats[brand]?.amount || 0,
      percentage:
        totalPayments > 0
          ? Math.round(
              ((stats[brand]?.count || 0) / totalPayments) * 100
            )
          : 0,
    }));

  const creditCardStats = buildCardStats(creditCardPayments);
  const debitCardStats = buildCardStats(debitCardPayments);

  const creditCardDistribution = buildCardDistribution(
    creditCardStats,
    creditCardPayments.length
  );
  const debitCardDistribution = buildCardDistribution(
    debitCardStats,
    debitCardPayments.length
  );

  const last6MonthsIncome = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();

    const monthPayments = payments.filter((p) => {
      const paymentDate = toLocalDate(p.date);
      return (
        paymentDate.getMonth() === month && paymentDate.getFullYear() === year
      );
    });

    return {
      month: date.toLocaleDateString("es-ES", {
        month: "short",
        year: "numeric",
      }),
      income: monthPayments.reduce((sum, p) => sum + p.amount, 0),
    };
  }).reverse();

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case "current_month":
        return "Mes Actual";
      case "previous_month":
        return "Mes Anterior";
      case "last_6_months":
        return "Últimos 6 Meses";
      case "current_year":
        return "Año Actual";
      case "last_year":
        return "Año Anterior";
      default:
        return "Período Seleccionado";
    }
  };

  const statusLabels: Record<DerivedStatus, string> = {
    active: "Activo",
    expired: "Vencido",
    inactive: "Inactivo",
  };

  const inactivityLevelLabels: Record<
    NonNullable<Member["inactiveLevel"]>,
    string
  > = {
    green: "Verde",
    yellow: "Amarillo",
    red: "Rojo",
  };

  const prospectStatusLabels: Record<ProspectStatus, string> = {
    averiguador: "Averiguador",
    trial_scheduled: "Clase prueba coordinada",
    reagendado: "Reagendado",
    asistio: "Asistió",
    no_asistio: "No asistió",
    inactivo: "Inactivo",
    otro: "Otro",
  };

  const prospectPriorityLabels: Record<ProspectPriority, string> = {
    red: "Alta",
    yellow: "Media",
    green: "Baja",
  };

  const customPlanStatusLabels: Record<
    "active" | "expiring" | "expired" | "inactive",
    string
  > = {
    active: "Activo",
    expiring: "Por vencer",
    expired: "Vencido",
    inactive: "Inactivo",
  };

  const formatDateCell = (value?: string | Date | null) => {
    if (!value) return "";
    if (value instanceof Date) {
      return toLocalMidnight(value).toLocaleDateString();
    }
    const parsed = toLocalDateFromISO(value);
    return parsed ? parsed.toLocaleDateString() : "";
  };

  const formatBooleanCell = (value: unknown) => {
    if (value === undefined || value === null) return "";
    return value ? "Sí" : "No";
  };

  const getProspectStatusLabel = (status?: string | null) =>
    status ? prospectStatusLabels[status as ProspectStatus] ?? status : "";

  const getProspectPriorityLabel = (priority?: string | null) =>
    priority
      ? prospectPriorityLabels[priority as ProspectPriority] ?? priority
      : "";

  const getCustomPlanStatusLabel = (status?: string | null) =>
    status
      ? customPlanStatusLabels[
          status as "active" | "expiring" | "expired" | "inactive"
        ] ?? status
      : "";

  const getOverdueDays = (iso?: string | null) => {
    if (!iso) return "";
    const nextDate = toLocalDateFromISO(iso);
    if (!nextDate) return "";
    const diffDays = Math.ceil(
      (todayMid.getTime() - toLocalMidnight(nextDate).getTime()) / 86400000
    );
    return diffDays > 0 ? diffDays : 0;
  };
  // === Construye las "hojas" a exportar a partir de lo ya calculado ===
  function buildSheets() {
    const resumen = [
      {
        Gimnasio: gymName,
        Periodo: getTimeFilterLabel(),
        Fecha: new Date().toLocaleDateString(),
        Ingresos: totalIncome,
        Gastos: totalExpenseAmount,
        Ganancia: totalProfit,
        Activos: activeMembers,
        Vencidos: expiredMembers,
        Inactivos: inactiveMembers,
        TotalSocios: members.length,
        Renovaron: renewalStats.renewedCount,
        NoRenovaron: renewalStats.notRenewedCount,
        TasaRenovacion: `${renewalStats.renewalRate}%`,
        ProximosVencimientos: upcomingExpirations.length,
        Morosos: overdueMembers.length,
      },
    ];

    const pagos = filteredPayments.map((p) => {
      const memberId = pick(p as any, "member_id", "memberId");
      const memberName =
        pick(p as any, "member_name", "memberName") ||
        members.find((m) => m.id === memberId)?.name ||
        "";

        const startDate = pick(p as any, "start_date", "startDate") as
        | string
        | undefined;
      const planId = pick(p as any, "plan_id", "planId") as
        | string
        | undefined;
      const productId = pick(p as any, "product_id", "productId") as
        | string
        | undefined;
      const description = pick(p as any, "description") as
        | string
        | undefined;
      const resolvedPlan = resolvePlanLabel(p);

      return {
        PagoId: p.id,
        SocioId: memberId || "",
        Socio: memberName,
        Monto: p.amount,
        Fecha: formatDateCell(p.date),
        FechaPago: formatDateCell(p.date),
        FechaInicioPlan: formatDateCell(startDate),
        Plan: resolvedPlan,
        Concepto:
          p.type === "plan" ? resolvedPlan : description || resolvedPlan,
        Metodo: p.method,
        Tarjeta: pick(p as any, "card_brand", "cardBrand") || "",
        Cuotas:
          pick(p as any, "card_installments", "cardInstallments") ?? "",
        Tipo: p.type,
        Descripcion: description || "",
        PlanId: planId || "",
        ProductoId: productId || "",
      };
    });

    const gastos = filteredExpenses.map((e) => ({
      GastoId: e.id,
      Descripcion: e.description,
      Monto: e.amount,
      Fecha: formatDateCell(e.date),
      Categoria: e.category,
      EsRecurrente: formatBooleanCell(e.is_recurring),
    }));

    const socios = membersWithDerived.map((m) => {
      const joinISO = pick(m as any, "joinDate", "join_date") as
        | string
        | undefined;
      const lastISO = pick(m as any, "lastPayment", "last_payment") as
        | string
        | undefined;
      const planEndISO = pick(
        m as any,
        "planEndDate",
        "plan_end_date",
        "nextPayment",
        "next_payment"
      ) as string | undefined;
      const nextInstallmentISO = pick(
        m as any,
        "nextInstallmentDue",
        "next_installment_due"
      ) as string | undefined;
      const nextPaymentISO = nextInstallmentISO ?? planEndISO;
      const rawStatus = pick(m as any, "status") as
        | DerivedStatus
        | undefined;
      const inactivityLevel = pick(
        m as any,
        "inactiveLevel",
        "inactive_level"
      ) as Member["inactiveLevel"];
      const inactivityComment = pick(
        m as any,
        "inactiveComment",
        "inactive_comment"
      ) as string | null | undefined;
      const balanceDue = pick(m as any, "balanceDue", "balance_due") as
        | number
        | null
        | undefined;
      const memberDescription = pick(m as any, "description") as
        | string
        | null
        | undefined;
      const followedUp = pick(m as any, "followedUp", "followed_up") as
        | boolean
        | null
        | undefined;
      const planPrice = pick(m as any, "planPrice", "plan_price") ??
        m.planPrice;
      const planName = pick(m as any, "plan") ?? m.plan;

      const formattedJoin = formatDateCell(joinISO);
      const formattedNextInstallment = formatDateCell(nextInstallmentISO);

      return {
        SocioId: m.id,
        Nombre: pick(m as any, "name") ?? m.name,
        Email: pick(m as any, "email") ?? m.email ?? "",
        Telefono: pick(m as any, "phone") ?? m.phone ?? "",
        Plan: planName ?? "",
        PrecioPlan: planPrice ?? "",
        Descripcion: memberDescription ?? "",
        Alta: formattedJoin,
        FechaAlta: formattedJoin,
        UltimoPago: formatDateCell(lastISO),
        FechaFinPlan: formatDateCell(planEndISO),
        ProximoPago: formatDateCell(nextPaymentISO),
        ProximaCuota: formattedNextInstallment,
        Estado: statusLabels[m.derivedStatus],
        EstadoDerivado: m.derivedStatus,
        EstadoSistema: rawStatus
          ? statusLabels[rawStatus as DerivedStatus] ?? rawStatus
          : "",
        EstadoSistemaCodigo: rawStatus ?? "",
        DiasAtraso: getOverdueDays(planEndISO),
        SaldoPendiente: balanceDue ?? "",
        NivelInactividad: inactivityLevel
          ? inactivityLevelLabels[
              inactivityLevel as NonNullable<Member["inactiveLevel"]>
            ] ?? inactivityLevel
          : "",
        ComentarioInactividad: inactivityComment ?? "",
        SeguimientoRealizado: formatBooleanCell(followedUp),
      };
    });

    const proximos = upcomingExpirations.map((m) => {
      const planEndISO = pick(
        m as any,
        "planEndDate",
        "plan_end_date",
        "nextPayment",
        "next_payment"
      ) as string | undefined;
      const nextDate =
        m._next ?? (planEndISO ? toLocalDateFromISO(planEndISO) : null);
      const days = nextDate
        ? Math.ceil(
             (toLocalMidnight(nextDate).getTime() - todayMid.getTime()) /
              86400000
          )
        : "";
      return {
        SocioId: m.id,
        Socio: pick(m as any, "name") ?? m.name,
        Plan: pick(m as any, "plan") ?? m.plan,
        Vence: nextDate ? formatDateCell(nextDate) : "",
        EstadoActual: statusLabels[m.derivedStatus],
        EstadoCodigo: m.derivedStatus,
        DiasRestantes: days,
      };
    });

     const interesados = prospects.map((prospect) => {
      const status = pick(prospect as any, "status") as
        | ProspectStatus
        | undefined;
      const priority = pick(
        prospect as any,
        "priority_level",
        "priorityLevel"
      ) as ProspectPriority | undefined;
      const contactISO = pick(
        prospect as any,
        "contact_date",
        "contactDate"
      ) as string | undefined;
      const scheduledISO = pick(
        prospect as any,
        "scheduled_date",
        "scheduledDate"
      ) as string | undefined;
      const createdISO = pick(
        prospect as any,
        "created_at",
        "createdAt"
      ) as string | undefined;

      return {
        InteresadoId: prospect.id,
        Nombre: pick(prospect as any, "name") ?? prospect.name,
        Email: pick(prospect as any, "email") ?? prospect.email ?? "",
        Telefono: pick(prospect as any, "phone") ?? prospect.phone ?? "",
        Interes: pick(prospect as any, "interest") ?? prospect.interest ?? "",
        Estado: getProspectStatusLabel(status),
        EstadoCodigo: status ?? "",
        Prioridad: getProspectPriorityLabel(priority),
        PrioridadCodigo: priority ?? "",
        FechaContacto: formatDateCell(contactISO),
        FechaAgendada: formatDateCell(scheduledISO),
        FechaCreacion: formatDateCell(createdISO),
        Notas: pick(prospect as any, "notes") ?? prospect.notes ?? "",
      };
    });

    const planesPersonalizados = customPlans.map((plan) => {
      const startISO = pick(plan as any, "start_date", "startDate") as
        | string
        | undefined;
      const endISO = pick(plan as any, "end_date", "endDate") as
        | string
        | undefined;
      const paymentISO = pick(plan as any, "payment_date", "paymentDate") as
        | string
        | undefined;
      const isActive = pick(plan as any, "is_active", "isActive") as
        | boolean
        | null
        | undefined;
      const endDate = endISO ? toLocalDateFromISO(endISO) : null;
      const daysUntilEnd = endDate
        ? Math.ceil(
            (toLocalMidnight(endDate).getTime() - todayMid.getTime()) /
              86400000
          )
        : "";

      let statusCode: "active" | "expiring" | "expired" | "inactive" | "" =
        "";
      if (typeof isActive === "boolean") {
        if (!isActive) {
          statusCode = "inactive";
        } else if (typeof daysUntilEnd === "number") {
          if (daysUntilEnd < 0) statusCode = "expired";
          else if (daysUntilEnd <= 7) statusCode = "expiring";
          else statusCode = "active";
        } else {
          statusCode = "active";
        }
      }

      return {
        PlanPersonalizadoId: plan.id,
        NombrePlan: pick(plan as any, "name") ?? plan.name,
        SocioId:
          (pick(plan as any, "member_id", "memberId") as string | undefined) ||
          "",
        Socio:
          pick(plan as any, "member_name", "memberName") ??
            plan.member_name ??
            "",
        Precio: pick(plan as any, "price") ?? plan.price ?? "",
        FechaInicio: formatDateCell(startISO),
        FechaFin: formatDateCell(endISO),
        DiasHastaVencimiento:
          typeof daysUntilEnd === "number" ? daysUntilEnd : "",
        Estado: getCustomPlanStatusLabel(statusCode),
        EstadoCodigo: statusCode,
        Activo:
          typeof isActive === "boolean" ? formatBooleanCell(isActive) : "",
        MetodoPago:
          pick(plan as any, "payment_method", "paymentMethod") ?? "",
        FechaPago: formatDateCell(paymentISO),
        MarcaTarjeta: pick(plan as any, "card_brand", "cardBrand") ?? "",
        Cuotas:
          pick(plan as any, "card_installments", "cardInstallments") ?? "",
        Descripcion: pick(plan as any, "description") ?? plan.description ?? "",
      };
    });

    return {
      resumen,
      pagos,
      gastos,
      socios,
      proximos,
      interesados,
      planesPersonalizados,
    };
  }

  // === Exportadores ===

  // JSON (reemplaza a tu handleExportReport)
  function exportJSON() {
    const data = buildSheets();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const fname = `reporte-${gymName.toLowerCase().replace(/\s+/g, "-")}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    downloadBlob(blob, fname);
  }

  // CSV (genera 1 .csv por "hoja"; Excel lo abre directo)
  function exportCSV() {
    const {
      resumen,
      pagos,
      gastos,
      socios,
      proximos,
      interesados,
      planesPersonalizados,
    } = buildSheets();

    const files: { name: string; rows: Array<Record<string, any>> }[] = [
      { name: "Resumen", rows: resumen },
      { name: "Pagos", rows: pagos },
      { name: "Gastos", rows: gastos },
      { name: "Socios", rows: socios },
      { name: "ProximosVencimientos", rows: proximos },
      { name: "Interesados", rows: interesados },
      { name: "PlanesPersonalizados", rows: planesPersonalizados },
    ];

    const base = gymName.toLowerCase().replace(/\s+/g, "-");

    files.forEach((f) => {
      const csv = toCSV(f.rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const fname = `${f.name}-${base}.csv`;
      downloadBlob(blob, fname);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Reportes y Estadísticas
          </h2>
          <p className="text-muted-foreground">
            Análisis completo del rendimiento de {gymName}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportJSON}>
              Exportar JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCSV}>
              Exportar CSV (Excel)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* FILTRO DE TIEMPO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filtros de Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Mes Actual</SelectItem>
                <SelectItem value="previous_month">Mes Anterior</SelectItem>
                <SelectItem value="last_6_months">Últimos 6 Meses</SelectItem>
                <SelectItem value="current_year">Año Actual</SelectItem>
                <SelectItem value="last_year">Año Anterior</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Mostrando datos de: <strong>{getTimeFilterLabel()}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Resumen Financiero - {getTimeFilterLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${totalIncome.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Ingresos</div>
              <div className="text-xs text-muted-foreground">
                {filteredPayments.length} pagos
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                ${totalExpenseAmount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Gastos</div>
              <div className="text-xs text-muted-foreground">
                {filteredExpenses.length} gastos
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div
                className={`text-2xl font-bold ${
                  totalProfit >= 0 ? "text-blue-600" : "text-red-600"
                }`}
              >
                ${totalProfit.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Ganancia</div>
              <div className="text-xs text-muted-foreground">
                {totalProfit >= 0 ? "Positiva" : "Negativa"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ANÁLISIS DE RENOVACIONES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className="mr-2 h-5 w-5" />
            Análisis de Renovaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {renewalStats.renewedCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Socios que Renovaron
              </div>
              <div className="text-xs text-muted-foreground">
                Tienen más de 1 pago
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {renewalStats.notRenewedCount}
              </div>
              <div className="text-sm text-muted-foreground">No Renovaron</div>
              <div className="text-xs text-muted-foreground">
                Vencidos/Inactivos
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {renewalStats.renewalRate}%
              </div>
              <div className="text-sm text-muted-foreground">
                Tasa de Renovación
              </div>
              <div className="text-xs text-muted-foreground">
                % que renovaron
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {renewalStats.totalEligible}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Elegibles
              </div>
              <div className="text-xs text-muted-foreground">
                Para renovación
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Estadísticas de Socios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {activeMembers}
              </div>
              <div className="text-sm text-muted-foreground">Activos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {expiredMembers}
              </div>
              <div className="text-sm text-muted-foreground">Vencidos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {inactiveMembers}
              </div>
              <div className="text-sm text-muted-foreground">Inactivos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{members.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts and Warnings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Alertas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingExpirations.length > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-orange-800">
                      Vencimientos Próximos
                    </h4>
                    <p className="text-sm text-orange-600">
                      {upcomingExpirations.length} socios con plan por vencer en
                      los próximos 7 días
                    </p>
                  </div>
                  <Badge className="bg-orange-500 text-white">
                    {upcomingExpirations.length}
                  </Badge>
                </div>
              </div>
            )}

            {overdueMembers.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-red-800">Socios Morosos</h4>
                    <p className="text-sm text-red-600">
                      {overdueMembers.length} socios con pagos vencidos
                    </p>
                  </div>
                  <Badge className="bg-red-500 text-white">
                    {overdueMembers.length}
                  </Badge>
                </div>
              </div>
            )}

            {renewalStats.renewalRate < 50 &&
              renewalStats.totalEligible > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-yellow-800">
                        Baja Tasa de Renovación
                      </h4>
                      <p className="text-sm text-yellow-600">
                        Solo el {renewalStats.renewalRate}% de los socios
                        elegibles renovaron su plan
                      </p>
                    </div>
                    <Badge className="bg-yellow-500 text-white">
                      {renewalStats.renewalRate}%
                    </Badge>
                  </div>
                </div>
              )}

            {upcomingExpirations.length === 0 &&
              overdueMembers.length === 0 &&
              renewalStats.renewalRate >= 50 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <div>
                      <h4 className="font-medium text-green-800">
                        Todo en Orden
                      </h4>
                      <p className="text-sm text-green-600">
                        No hay alertas importantes en este momento
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Distribution */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Planes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
               {planDistributionEntries.length > 0 ? (
                planDistributionEntries.map(({ plan, count }) => (
                  <div key={plan} className="flex items-center justify-between">
                    <span className="font-medium">{plan}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {count} socios
                      </span>
                      <Badge variant="outline">
                        {totalPlanMembers > 0
                          ? Math.round((count / totalPlanMembers) * 100)
                          : 0}
                        %
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay pagos de planes en el período seleccionado.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago - {getTimeFilterLabel()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(paymentMethodDistribution).map(
                ([method, count]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium">{method}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {count} pagos
                      </span>
                      <Badge variant="outline">
                        {filteredPayments.length > 0
                          ? Math.round((count / filteredPayments.length) * 100)
                          : 0}
                        %
                      </Badge>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pagos con Débito - {getTimeFilterLabel()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debitCardDistribution.map((item) => (
                <div
                  key={item.brand}
                  className="flex items-center justify-between"
                >
                  <span className="font-medium">{item.brand}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-muted-foreground">
                      {item.count} pagos
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ${item.amount.toLocaleString()}
                    </span>
                    <Badge variant="outline">{item.percentage}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pagos con Crédito - {getTimeFilterLabel()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creditCardDistribution.map((item) => (
                <div
                  key={item.brand}
                  className="flex items-center justify-between"
                >
                  <span className="font-medium">{item.brand}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-muted-foreground">
                      {item.count} pagos
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ${item.amount.toLocaleString()}
                    </span>
                    <Badge variant="outline">{item.percentage}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" />
            Tendencia de Ingresos (Últimos 6 Meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {last6MonthsIncome.map((monthData, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <span className="font-medium">{monthData.month}</span>
                <span className="text-lg font-bold text-green-600">
                  ${monthData.income.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Expirations Detail */}
      {upcomingExpirations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Próximos Vencimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Socio</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Días Restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingExpirations.map((member) => {
                  const baseDate =
                    member._next ?? parseDateSafe(member.next_payment)!;
                  const nextMid = toLocalMidnight(baseDate);
                  const daysUntilExpiration = Math.ceil(
                    (nextMid.getTime() - todayMid.getTime()) / 86400000
                  );
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.name}
                      </TableCell>
                      <TableCell>{member.plan}</TableCell>
                      <TableCell>{nextMid.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            daysUntilExpiration <= 3
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {daysUntilExpiration === 0
                            ? "Hoy"
                            : `${daysUntilExpiration} días`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
