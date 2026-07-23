"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  DoorOpen,
  Download,
  ExternalLink,
  RefreshCcw,
} from "lucide-react";

import type { MemberAccessLog } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
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
type StatusFilter = MemberAccessLog["result"] | "all";

interface SummaryPayload {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  notFound: number;
  unique: number;
}

interface TopHourPayload {
  hour: number;
  count: number;
}

interface TopMemberPayload {
  memberId: string | null;
  name: string | null;
  count: number;
  lastAccess: string | null;
}

interface AdminPayload {
  history: {
    items: MemberAccessLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  todaySummary: SummaryPayload;
  rangeSummary: SummaryPayload;
  topHoursToday: TopHourPayload[];
  topMembersThisMonth: TopMemberPayload[];
  meta: {
    reportRange: ReportRange;
    rangeStart: string;
    rangeEnd: string;
  };
}

const PAGE_SIZE = 20;

const parseDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

export function IncomeManagement({
  gymId,
  gymName,
}: IncomeManagementProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reportRange, setReportRange] = useState<ReportRange>("week");
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    status: "all" as StatusFilter,
    startDate: "",
    endDate: "",
  });
  const [data, setData] = useState<AdminPayload | null>(null);

  const accessUrl = useMemo(() => {
    if (!gymId) return "";
    if (typeof window === "undefined") {
      return `/acceso/${gymId}`;
    }
    return `${window.location.origin}/acceso/${gymId}`;
  }, [gymId]);

  const loadDashboard = async () => {
    if (!gymId) return;

    setLoading(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        gymId,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        reportRange,
        status: appliedFilters.status,
        search: appliedFilters.search,
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
      });

      const response = await authenticatedFetch(`/api/member-access/admin?${params}`, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | (AdminPayload & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ??
            "No se pudieron cargar los reportes de ingresos."
        );
      }

      setData(payload as AdminPayload);
    } catch (error) {
      console.error("Error loading income dashboard", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los ingresos."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [gymId, page, reportRange, appliedFilters]);

  const handleCopy = async (value: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Error copying access URL", error);
    }
  };

  const handleOpenAccess = (value: string) => {
    if (!value) return;
    window.open(value, "_blank", "noopener,noreferrer");
  };

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({
      search: searchTerm.trim(),
      status: statusFilter,
      startDate,
      endDate,
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
    setAppliedFilters({
      search: "",
      status: "all",
      startDate: "",
      endDate: "",
    });
  };

  const exportCurrentPageCsv = () => {
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
      ...((data?.history.items ?? []).map((log) => [
        log.created_at ?? "",
        log.member_name ?? "",
        log.cedula_entered,
        log.result,
        log.message,
        log.days_remaining ?? "",
        log.days_expired ?? "",
      ]) as string[][]),
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
    anchor.download = `ingresos-${gymId}-pagina-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const rangeStartLabel = useMemo(() => {
    const raw = data?.meta.rangeStart;
    if (!raw) return "-";
    return new Date(raw).toLocaleDateString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, [data?.meta.rangeStart]);

  const pageStart = data?.history.total
    ? (data.history.page - 1) * data.history.pageSize + 1
    : 0;
  const pageEnd = data?.history.total
    ? Math.min(data.history.page * data.history.pageSize, data.history.total)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ingresos</h2>
        <p className="text-muted-foreground">
          Gestiona el acceso de socios, copia la ruta pública del teclado de
          ingreso y analiza los registros sin cargar historiales eternos.
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
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCopy(accessUrl)}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button type="button" onClick={() => handleOpenAccess(accessUrl)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir
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
            <div className="text-2xl font-bold">{data?.todaySummary.total ?? 0}</div>
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
            <div className="text-2xl font-bold">{data?.todaySummary.unique ?? 0}</div>
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
              {data?.todaySummary.active ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Accesos en verde</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Por vencer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {data?.todaySummary.expiring ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Accesos en amarillo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rojos hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {(data?.todaySummary.expired ?? 0) +
                (data?.todaySummary.notFound ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Vencidos y no encontrados
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Filtros e historial</CardTitle>
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
                    setStatusFilter(event.target.value as StatusFilter)
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
              <Button type="button" variant="outline" onClick={loadDashboard} disabled={loading}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {loading ? "Actualizando..." : "Actualizar"}
              </Button>
              <Button type="button" onClick={applyFilters}>
                Aplicar filtros
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={exportCurrentPageCsv}
                disabled={!data?.history.items.length}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar página
              </Button>
            </div>

            {loadError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {loadError}
              </div>
            ) : null}

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
                  {data?.history.items.length ? (
                    data.history.items.map((log) => (
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {pageStart} a {pageEnd} de {data?.history.total ?? 0} ingresos.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Anterior
                </Button>
                <Badge variant="secondary">
                  Página {data?.history.page ?? page} de {data?.history.totalPages ?? 1}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(data?.history.totalPages ?? current, current + 1)
                    )
                  }
                  disabled={
                    loading ||
                    page >= (data?.history.totalPages ?? 1)
                  }
                >
                  Siguiente
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-950 text-slate-100">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-700" />
                Reportes por rango
              </CardTitle>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-medium text-slate-400">Total del período</p>
                  <p className="mt-2 text-3xl font-bold">{data?.rangeSummary.total ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-medium text-slate-400">Socios únicos</p>
                  <p className="mt-2 text-3xl font-bold">{data?.rangeSummary.unique ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-medium text-slate-400">Activos</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600">
                    {data?.rangeSummary.active ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-medium text-slate-400">Por vencer</p>
                  <p className="mt-2 text-3xl font-bold text-amber-600">
                    {data?.rangeSummary.expiring ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-medium text-slate-400">Vencidos</p>
                  <p className="mt-2 text-3xl font-bold text-rose-600">
                    {data?.rangeSummary.expired ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-medium text-slate-400">No encontrados</p>
                  <p className="mt-2 text-3xl font-bold text-slate-200">
                    {data?.rangeSummary.notFound ?? 0}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Mostrando datos desde {rangeStartLabel} hasta hoy.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-cyan-700" />
                Horas pico de hoy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.topHoursToday.length ? (
                data.topHoursToday.map((bucket) => (
                  <div
                    key={bucket.hour}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"
                  >
                    <span className="text-slate-100">
                      {String(bucket.hour).padStart(2, "0")}:00 hs
                    </span>
                    <Badge variant="secondary">{bucket.count} ingresos</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-300">
                  Aún no hay ingresos registrados hoy.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-cyan-700" />
                Socios que más vinieron este mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.topMembersThisMonth.length ? (
                  data.topMembersThisMonth.map((member, index) => (
                    <div
                      key={`${member.memberId ?? "unknown"}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-800">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {member.name ?? "Socio sin nombre"}
                          </p>
                          <p className="text-xs text-slate-300">
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
                  <p className="text-sm text-slate-300">
                    Aún no hay ingresos registrados este mes para construir el ranking.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
