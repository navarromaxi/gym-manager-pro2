"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  RefreshCcw,
  DoorOpen,
  UserCheck,
  AlertTriangle,
  SearchX,
  Download,
  Clock3,
  MonitorSmartphone,
  BarChart3,
  CalendarDays,
} from "lucide-react";

import { supabase, type MemberAccessLog } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface IncomeManagementProps {
  gymId: string;
  gymName: string;
}

type ReportRange = "week" | "month";

const parseDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value?: string | null) => {
  const parsed = parseDateTime(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("es-UY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isSameDay = (value: Date, day: Date) =>
  value.getFullYear() === day.getFullYear() &&
  value.getMonth() === day.getMonth() &&
  value.getDate() === day.getDate();

const maskCedula = (value: string) => {
  const normalized = value.replace(/\D+/g, "");
  if (normalized.length <= 4) return normalized;
  return `${"*".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(
    -4
  )}`;
};

const statusLabelMap: Record<MemberAccessLog["result"], string> = {
  active: "Activo",
  expiring: "Por vencer",
  expired: "Vencido",
  not_found: "No encontrado",
};

const statusBadgeClassMap: Record<MemberAccessLog["result"], string> = {
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  expiring: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  expired: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  not_found: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};

const setupHint =
  "Si no aparecen ingresos, revisa que la tabla member_access_logs exista y tenga permisos RLS para el gimnasio.";

export function IncomeManagement({
  gymId,
  gymName,
}: IncomeManagementProps) {
  const [logs, setLogs] = useState<MemberAccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    MemberAccessLog["result"] | "all"
  >("all");
  const [reportRange, setReportRange] = useState<ReportRange>("week");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const accessUrl = useMemo(() => {
    if (!gymId) return "";
    if (typeof window === "undefined") {
      return `/acceso/${gymId}`;
    }
    return `${window.location.origin}/acceso/${gymId}`;
  }, [gymId]);

  const kioskUrl = useMemo(() => {
    if (!accessUrl) return "";
    return `${accessUrl}?kiosco=1`;
  }, [accessUrl]);

  const loadLogs = async () => {
    if (!gymId) return;

    setLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from("member_access_logs")
        .select(
          "id, gym_id, member_id, member_name, cedula_entered, normalized_cedula, result, status_color, message, days_remaining, days_expired, created_at"
        )
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        throw error;
      }

      setLogs((data ?? []) as MemberAccessLog[]);
    } catch (error: any) {
      console.error("Error loading member access logs", error);
      const normalizedMessage = error?.message?.toLowerCase?.() ?? "";
      if (
        normalizedMessage.includes("does not exist") ||
        normalizedMessage.includes("schema cache") ||
        normalizedMessage.includes("permission denied")
      ) {
        setLoadError(setupHint);
      } else {
        setLoadError(
          "No se pudieron cargar los ingresos. Intenta nuevamente en unos segundos."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [gymId]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const fromDate = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const toDate = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return logs.filter((log) => {
      if (statusFilter !== "all" && log.result !== statusFilter) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = [
          log.member_name ?? "",
          log.cedula_entered,
          log.message,
          statusLabelMap[log.result],
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      const createdAt = parseDateTime(log.created_at);
      if (!createdAt) return false;
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;

      return true;
    });
  }, [logs, searchTerm, statusFilter, startDate, endDate]);

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const startOfWeek = useMemo(() => {
    const date = new Date(today);
    const day = date.getDay();
    const offset = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - offset);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [today]);

  const startOfMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today]
  );

  const reportStart = reportRange === "week" ? startOfWeek : startOfMonth;

  const rangeLogs = useMemo(
    () =>
      logs.filter((log) => {
        const createdAt = parseDateTime(log.created_at);
        return createdAt ? createdAt >= reportStart : false;
      }),
    [logs, reportStart]
  );

  const todayLogs = useMemo(
    () =>
      logs.filter((log) => {
        const createdAt = parseDateTime(log.created_at);
        return createdAt ? isSameDay(createdAt, today) : false;
      }),
    [logs, today]
  );

  const todayActiveCount = todayLogs.filter((log) => log.result === "active").length;
  const todayExpiringCount = todayLogs.filter((log) => log.result === "expiring").length;
  const todayExpiredCount = todayLogs.filter((log) => log.result === "expired").length;
  const todayNotFoundCount = todayLogs.filter((log) => log.result === "not_found").length;

  const uniqueMembersToday = useMemo(
    () =>
      new Set(
        todayLogs
          .map((log) => log.member_id)
          .filter((memberId): memberId is string => Boolean(memberId))
      ).size,
    [todayLogs]
  );

  const accessesByHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
    }));

    for (const log of todayLogs) {
      const createdAt = parseDateTime(log.created_at);
      if (!createdAt) continue;
      buckets[createdAt.getHours()].count += 1;
    }

    return buckets
      .filter((bucket) => bucket.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [todayLogs]);

  const topMembers = useMemo(() => {
    const counts = new Map<
      string,
      { name: string; count: number; lastAccess: string | null }
    >();

    for (const log of filteredLogs) {
      if (!log.member_id || !log.member_name) continue;
      const existing = counts.get(log.member_id);
      if (existing) {
        existing.count += 1;
        if (
          log.created_at &&
          (!existing.lastAccess || log.created_at > existing.lastAccess)
        ) {
          existing.lastAccess = log.created_at;
        }
      } else {
        counts.set(log.member_id, {
          name: log.member_name,
          count: 1,
          lastAccess: log.created_at ?? null,
        });
      }
    }

    return Array.from(counts.entries())
      .map(([memberId, value]) => ({
        memberId,
        ...value,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredLogs]);

  const topMembersThisMonth = useMemo(() => {
    const counts = new Map<
      string,
      { name: string; count: number; lastAccess: string | null }
    >();

    for (const log of logs) {
      const createdAt = parseDateTime(log.created_at);
      if (!createdAt || createdAt < startOfMonth) continue;
      if (!log.member_id || !log.member_name) continue;

      const existing = counts.get(log.member_id);
      if (existing) {
        existing.count += 1;
        if (
          log.created_at &&
          (!existing.lastAccess || log.created_at > existing.lastAccess)
        ) {
          existing.lastAccess = log.created_at;
        }
      } else {
        counts.set(log.member_id, {
          name: log.member_name,
          count: 1,
          lastAccess: log.created_at ?? null,
        });
      }
    }

    return Array.from(counts.entries())
      .map(([memberId, value]) => ({
        memberId,
        ...value,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [logs, startOfMonth]);

  const rangeSummary = useMemo(() => {
    const total = rangeLogs.length;
    const active = rangeLogs.filter((log) => log.result === "active").length;
    const expiring = rangeLogs.filter((log) => log.result === "expiring").length;
    const expired = rangeLogs.filter((log) => log.result === "expired").length;
    const notFound = rangeLogs.filter((log) => log.result === "not_found").length;
    const unique = new Set(
      rangeLogs
        .map((log) => log.member_id)
        .filter((memberId): memberId is string => Boolean(memberId))
    ).size;

    return {
      total,
      active,
      expiring,
      expired,
      notFound,
      unique,
    };
  }, [rangeLogs]);

  const exportCsv = () => {
    const rows = [
      [
        "fecha_hora",
        "nombre",
        "cedula",
        "resultado",
        "mensaje",
        "dias_restantes",
        "dias_vencido",
      ],
      ...filteredLogs.map((log) => [
        log.created_at ?? "",
        log.member_name ?? "",
        log.cedula_entered,
        log.result,
        log.message,
        log.days_remaining ?? "",
        log.days_expired ?? "",
      ]),
    ];

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ingresos-${gymId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!accessUrl) return;

    try {
      await navigator.clipboard.writeText(accessUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Error copying access URL", error);
    }
  };

  const handleOpenAccess = () => {
    if (!accessUrl) return;
    window.open(accessUrl, "_blank", "noopener,noreferrer");
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ingresos</h2>
        <p className="text-muted-foreground">
          Gestiona el acceso de socios, copia la ruta pública del teclado de
          ingreso y analiza los registros del gimnasio.
        </p>
      </div>

      <Card className="border-cyan-200 bg-[linear-gradient(135deg,rgba(6,182,212,0.08),rgba(255,255,255,0.95))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-cyan-700" />
            Link público de acceso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <Input value={accessUrl} readOnly className="font-mono text-sm" />
            <Button type="button" variant="outline" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button type="button" onClick={handleOpenAccess}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <Input value={kioskUrl} readOnly className="font-mono text-sm" />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!kioskUrl) return;
                try {
                  await navigator.clipboard.writeText(kioskUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                } catch (error) {
                  console.error("Error copying kiosk URL", error);
                }
              }}
            >
              <MonitorSmartphone className="mr-2 h-4 w-4" />
              Copiar kiosco
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                kioskUrl &&
                window.open(kioskUrl, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir kiosco
            </Button>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-white/80 p-4 text-sm text-slate-600">
            Usa este link en una tablet, notebook o pantalla táctil en la
            entrada de <span className="font-semibold">{gymName || "tu gimnasio"}</span>.
            El socio ingresa su cédula y el sistema devuelve el estado del plan
            con la lógica de acceso ya configurada.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ingresos hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              Total de consultas del día
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Socios únicos hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueMembersToday}</div>
            <p className="text-xs text-muted-foreground">
              Sin contar repeticiones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activos hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {todayActiveCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Accesos en verde
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Por vencer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {todayExpiringCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Accesos en amarillo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rojos hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {todayExpiredCount + todayNotFoundCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Vencidos y no encontrados
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Filtros y acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="income-search">Buscar</Label>
                <Input
                  id="income-search"
                  placeholder="Nombre, cédula o mensaje"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="income-status">Estado</Label>
                <select
                  id="income-status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as MemberAccessLog["result"] | "all"
                    )
                  }
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="expiring">Por vencer</option>
                  <option value="expired">Vencidos</option>
                  <option value="not_found">No encontrados</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="income-start-date">Desde</Label>
                <Input
                  id="income-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="income-end-date">Hasta</Label>
                <Input
                  id="income-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={loadLogs} disabled={loading}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {loading ? "Actualizando..." : "Actualizar"}
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={exportCsv}
                disabled={filteredLogs.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>

            {loadError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {loadError}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Clock3 className="h-4 w-4" />
                Horas pico de hoy
              </div>
              <div className="mt-3 space-y-2">
                {accessesByHour.length > 0 ? (
                  accessesByHour.map((bucket) => (
                    <div
                      key={bucket.hour}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{String(bucket.hour).padStart(2, "0")}:00 hs</span>
                      <Badge variant="secondary">{bucket.count} ingresos</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay ingresos registrados hoy.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Activos
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-600">
                  {filteredLogs.filter((log) => log.result === "active").length}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Por vencer
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600">
                  {filteredLogs.filter((log) => log.result === "expiring").length}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Vencidos
                </div>
                <div className="mt-2 text-2xl font-bold text-rose-600">
                  {filteredLogs.filter((log) => log.result === "expired").length}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <SearchX className="h-4 w-4 text-slate-600" />
                  No encontrados
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-700">
                  {filteredLogs.filter((log) => log.result === "not_found").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-700" />
                Reportes por rango
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={reportRange === "week" ? "default" : "outline"}
                onClick={() => setReportRange("week")}
              >
                Semanal
              </Button>
              <Button
                type="button"
                variant={reportRange === "month" ? "default" : "outline"}
                onClick={() => setReportRange("month")}
              >
                Mensual
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-slate-500">
                  Total del período
                </p>
                <p className="mt-2 text-3xl font-bold">{rangeSummary.total}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-slate-500">
                  Socios únicos
                </p>
                <p className="mt-2 text-3xl font-bold">{rangeSummary.unique}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-slate-500">
                  Verdes del período
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-600">
                  {rangeSummary.active}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-slate-500">
                  Amarillos del período
                </p>
                <p className="mt-2 text-3xl font-bold text-amber-600">
                  {rangeSummary.expiring}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-slate-500">
                  Rojos vencidos
                </p>
                <p className="mt-2 text-3xl font-bold text-rose-600">
                  {rangeSummary.expired}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-slate-500">
                  No encontrados
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-700">
                  {rangeSummary.notFound}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Mostrando datos desde{" "}
              {reportStart.toLocaleDateString("es-UY", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}{" "}
              hasta hoy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-cyan-700" />
              Socios que más vinieron este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMembersThisMonth.length > 0 ? (
                topMembersThisMonth.map((member, index) => (
                  <div
                    key={member.memberId}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-800">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Último ingreso: {formatDateTime(member.lastAccess)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {member.count} ingreso{member.count === 1 ? "" : "s"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aún no hay ingresos registrados este mes para construir el ranking.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Socios con más ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMembers.length > 0 ? (
                topMembers.map((member) => (
                  <div
                    key={member.memberId}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Último ingreso: {formatDateTime(member.lastAccess)}
                      </p>
                    </div>
                    <Badge variant="secondary">{member.count} ingresos</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aún no hay suficientes datos para mostrar un ranking de socios.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Socio</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length > 0 ? (
                    filteredLogs.slice(0, 120).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell>{log.member_name ?? "No encontrado"}</TableCell>
                        <TableCell>{maskCedula(log.cedula_entered)}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClassMap[log.result]}>
                            {statusLabelMap[log.result]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate">
                          {log.message}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No hay ingresos para mostrar con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
