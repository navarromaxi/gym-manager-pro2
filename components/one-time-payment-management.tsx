"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { OneTimePayment } from "@/lib/supabase";

interface OneTimePaymentManagementProps {
  records: OneTimePayment[];
  setRecords: Dispatch<SetStateAction<OneTimePayment[]>>;
  gymId: string;
}

type SourceOption = "TuPase" | "PaseLibre" | "Otro";

type TimeFilterOption =
  | "all"
  | "current_month"
  | "previous_month"
  | "last_3_months"
  | "last_6_months"
  | "current_year"
  | "previous_year";

type SourceTotals = Record<
  "TuPase" | "PaseLibre" | "Otros" | "total",
  { count: number; amount: number }
>;

const SOURCE_OPTIONS: { value: SourceOption; label: string }[] = [
  { value: "TuPase", label: "TuPase" },
  { value: "PaseLibre", label: "PaseLibre" },
  { value: "Otro", label: "Otro diferente" },
];

const ONE_TIME_PAGE_SIZE = 10;
const todayISO = () => new Date().toISOString().split("T")[0];

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatCurrency = (value?: number | null) =>
  currencyFormatter.format(value ?? 0);

const parseAmountInput = (value: string) => {
  if (!value) return Number.NaN;
  const normalized = value.replace(/\./g, "").replace(/,/g, ".").trim();
  if (!normalized) return Number.NaN;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const resolveSource = (option: SourceOption, other: string) => {
  if (option === "Otro") {
    const trimmed = other.trim();
    return trimmed.length > 0 ? trimmed : "Otro diferente";
  }
  return option;
};

const normalizeSourceOption = (
  source: string
): {
  option: SourceOption;
  other: string;
} => {
  if (source === "TuPase" || source === "PaseLibre") {
    return { option: source, other: "" };
  }
  return { option: "Otro", other: source };
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toComparableDate = (value: string) =>
  new Date(value + "T00:00:00").getTime();

export function OneTimePaymentManagement({
  records,
  setRecords,
  gymId,
}: OneTimePaymentManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceOption | "all">("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>("all");
  const [editingRecord, setEditingRecord] = useState<OneTimePayment | null>(
    null
  );
  const [visibleCount, setVisibleCount] = useState(ONE_TIME_PAGE_SIZE);
  const [newRecord, setNewRecord] = useState({
    fullName: "",
    phone: "",
    sourceOption: "TuPase" as SourceOption,
    otherSource: "",
    description: "",
    visitDate: todayISO(),
    estimatedPaymentDate: todayISO(),
    amount: "150",
  });

  const [editRecordData, setEditRecordData] = useState({
    fullName: "",
    phone: "",
    sourceOption: "TuPase" as SourceOption,
    otherSource: "",
    description: "",
    visitDate: todayISO(),
    estimatedPaymentDate: todayISO(),
    amount: "150",
  });

  const resetNewRecord = () => {
    setNewRecord({
      fullName: "",
      phone: "",
      sourceOption: "TuPase",
      otherSource: "",
      description: "",
      visitDate: todayISO(),
      estimatedPaymentDate: todayISO(),
      amount: "",
    });
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort(
      (a, b) => toComparableDate(b.visit_date) - toComparableDate(a.visit_date)
    );
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sortedRecords.filter((record) => {
      if (timeFilter !== "all") {
        const visitDate = new Date(record.visit_date + "T00:00:00");
        visitDate.setHours(0, 0, 0, 0);

        if (Number.isNaN(visitDate.getTime())) {
          return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfMonth = (date: Date) =>
          new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = (date: Date) =>
          new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

        const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);
        const endOfYear = (date: Date) =>
          new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

        let rangeStart: Date | null = null;
        let rangeEnd: Date | null = null;

        switch (timeFilter) {
          case "current_month":
            rangeStart = startOfMonth(today);
            rangeEnd = endOfMonth(today);
            break;
          case "previous_month": {
            const previousMonth = new Date(
              today.getFullYear(),
              today.getMonth() - 1,
              1
            );
            rangeStart = startOfMonth(previousMonth);
            rangeEnd = endOfMonth(previousMonth);
            break;
          }
          case "last_3_months": {
            const start = new Date(
              today.getFullYear(),
              today.getMonth() - 2,
              1
            );
            rangeStart = startOfMonth(start);
            rangeEnd = endOfMonth(today);
            break;
          }
          case "last_6_months": {
            const start = new Date(
              today.getFullYear(),
              today.getMonth() - 5,
              1
            );
            rangeStart = startOfMonth(start);
            rangeEnd = endOfMonth(today);
            break;
          }
          case "current_year":
            rangeStart = startOfYear(today);
            rangeEnd = endOfYear(today);
            break;
          case "previous_year": {
            const prevYear = new Date(
              today.getFullYear() - 1,
              today.getMonth(),
              1
            );
            rangeStart = startOfYear(prevYear);
            rangeEnd = endOfYear(prevYear);
            break;
          }
          default:
            break;
        }

        if (rangeStart && rangeEnd) {
          if (visitDate < rangeStart || visitDate > rangeEnd) {
            return false;
          }
        }
      }

      if (sourceFilter !== "all" && record.source !== sourceFilter) {
        if (
          !(
            sourceFilter === "Otro" &&
            record.source !== "TuPase" &&
            record.source !== "PaseLibre"
          )
        ) {
          return false;
        }
      }

      if (!normalizedSearch) return true;

      const haystack = [
        record.full_name,
        record.phone,
        record.source,
        record.description || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [sortedRecords, searchTerm, sourceFilter, timeFilter]);
  useEffect(() => {
    setVisibleCount(ONE_TIME_PAGE_SIZE);
  }, [searchTerm, sourceFilter, timeFilter]);

  const visibleRecords = useMemo(() => {
    return filteredRecords.slice(0, visibleCount);
  }, [filteredRecords, visibleCount]);

  const canLoadMore = visibleCount < filteredRecords.length;

  const handleLoadMoreRecords = () => {
    setVisibleCount((prev) =>
      Math.min(prev + ONE_TIME_PAGE_SIZE, filteredRecords.length)
    );
  };
  const upcomingSettlements = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...records]
      .filter((record) => {
        if (!record.estimated_payment_date) return false;
        const estimated = new Date(record.estimated_payment_date + "T00:00:00");
        estimated.setHours(0, 0, 0, 0);
        return estimated >= today;
      })
      .sort(
        (a, b) =>
          toComparableDate(a.estimated_payment_date) -
          toComparableDate(b.estimated_payment_date)
      )
      .slice(0, 5);
  }, [records]);

  const totalsBySource = useMemo<SourceTotals>(() => {
    return records.reduce<SourceTotals>(
      (acc, record) => {
        const source =
          record.source === "TuPase" || record.source === "PaseLibre"
            ? record.source
            : "Otros";
        const amount = record.amount ?? 0;
        acc[source].count += 1;
        acc[source].amount += amount;
        acc.total.count += 1;
        acc.total.amount += amount;
        return acc;
      },
      {
        TuPase: { count: 0, amount: 0 },
        PaseLibre: { count: 0, amount: 0 },
        Otros: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 },
      }
    );
  }, [records]);

  const handleCreateRecord = async () => {
    if (!gymId) return;

    const parsedAmount = parseAmountInput(newRecord.amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("El monto debe ser un número mayor a 0.");
      return;
    }

    const source = resolveSource(newRecord.sourceOption, newRecord.otherSource);
    const payload = {
      gym_id: gymId,
      full_name: newRecord.fullName.trim(),
      phone: newRecord.phone.trim(),
      source,
      amount: parsedAmount,
      description: newRecord.description.trim() || null,
      visit_date: newRecord.visitDate,
      estimated_payment_date: newRecord.estimatedPaymentDate,
    };

    if (!payload.full_name) {
      alert("El nombre completo es obligatorio.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("one_time_payments")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setRecords((prev) => [data as OneTimePayment, ...prev]);
        setIsAddDialogOpen(false);
        resetNewRecord();
      }
    } catch (error) {
      console.error("Error al registrar pago único:", error);
      alert("No se pudo registrar el pago único. Intenta nuevamente.");
    }
  };

  const handleEditRecord = (record: OneTimePayment) => {
    const normalized = normalizeSourceOption(record.source);
    setEditingRecord(record);
    setEditRecordData({
      fullName: record.full_name,
      phone: record.phone,
      sourceOption: normalized.option,
      otherSource: normalized.other,
      description: record.description || "",
      visitDate: record.visit_date,
      estimatedPaymentDate: record.estimated_payment_date,
      amount:
        record.amount !== null && record.amount !== undefined
          ? String(record.amount)
          : "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRecord = async () => {
    if (!gymId || !editingRecord) return;

    const source = resolveSource(
      editRecordData.sourceOption,
      editRecordData.otherSource
    );

    const parsedAmount = parseAmountInput(editRecordData.amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("El monto debe ser un número mayor a 0.");
      return;
    }

    const payload = {
      full_name: editRecordData.fullName.trim(),
      phone: editRecordData.phone.trim(),
      source,
      amount: parsedAmount,
      description: editRecordData.description.trim() || null,
      visit_date: editRecordData.visitDate,
      estimated_payment_date: editRecordData.estimatedPaymentDate,
    };

    if (!payload.full_name) {
      alert("El nombre completo es obligatorio.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("one_time_payments")
        .update(payload)
        .eq("id", editingRecord.id)
        .eq("gym_id", gymId)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setRecords((prev) =>
          prev.map((record) =>
            record.id === editingRecord.id ? (data as OneTimePayment) : record
          )
        );
        setIsEditDialogOpen(false);
        setEditingRecord(null);
      }
    } catch (error) {
      console.error("Error al actualizar pago único:", error);
      alert("No se pudo actualizar el pago único. Intenta nuevamente.");
    }
  };

  const handleDeleteRecord = async (record: OneTimePayment) => {
    if (!gymId) return;
    const confirmation = confirm(
      `¿Eliminar el registro de ${record.full_name}?`
    );
    if (!confirmation) return;

    try {
      const { error } = await supabase
        .from("one_time_payments")
        .delete()
        .eq("id", record.id)
        .eq("gym_id", gymId);

      if (error) throw error;

      setRecords((prev) => prev.filter((item) => item.id !== record.id));
    } catch (error) {
      console.error("Error al eliminar pago único:", error);
      alert("No se pudo eliminar el registro. Intenta nuevamente.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Pago Único</CardTitle>
            <p className="text-sm text-muted-foreground">
              Registra las visitas de personas no socias provenientes de
              agencias externas y lleva el control de los cobros pendientes.
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Registrar visita
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por nombre, teléfono u origen"
                  className="pl-8"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Filtrar por origen</Label>
              <Select
                value={sourceFilter}
                onValueChange={(value) =>
                  setSourceFilter(value as SourceOption | "all")
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filtrar por período</Label>
              <Select
                value={timeFilter}
                onValueChange={(value) =>
                  setTimeFilter(value as TimeFilterOption)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todo el historial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el historial</SelectItem>
                  <SelectItem value="current_month">Mes actual</SelectItem>
                  <SelectItem value="previous_month">Mes anterior</SelectItem>
                  <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
                  <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
                  <SelectItem value="current_year">Año actual</SelectItem>
                  <SelectItem value="previous_year">Año anterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-2 md:items-end">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Total: {totalsBySource.total.count} ·{" "}
                  {formatCurrency(totalsBySource.total.amount)}
                </Badge>
                <Badge variant="secondary">
                  TuPase: {totalsBySource.TuPase.count} ·{" "}
                  {formatCurrency(totalsBySource.TuPase.amount)}
                </Badge>
                <Badge variant="secondary">
                  PaseLibre: {totalsBySource.PaseLibre.count} ·{" "}
                  {formatCurrency(totalsBySource.PaseLibre.amount)}
                </Badge>
                <Badge variant="secondary">
                  Otros: {totalsBySource.Otros.count} ·{" "}
                  {formatCurrency(totalsBySource.Otros.amount)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próximos cobros estimados</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSettlements.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {upcomingSettlements.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{record.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.source}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Calendar className="h-3 w-3" />
                      {formatDate(record.estimated_payment_date)}
                    </Badge>
                    <p className="mt-2 text-sm font-semibold text-emerald-600">
                      {record.amount !== null && record.amount !== undefined
                        ? formatCurrency(record.amount)
                        : "-"}
                    </p>
                  </div>
                  {record.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {record.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay cobros estimados próximos.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de visitas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron registros que coincidan con los filtros
              seleccionados.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Uso del pase</TableHead>
                      <TableHead>Pago estimado</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRecords.map((record) => {
                      const amountDisplay =
                        record.amount !== null && record.amount !== undefined
                          ? formatCurrency(record.amount)
                          : "-";

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.full_name}
                          </TableCell>
                          <TableCell>{record.phone || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{record.source}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(record.visit_date)}</TableCell>
                          <TableCell>
                            {formatDate(record.estimated_payment_date)}
                          </TableCell>
                          <TableCell className="font-semibold text-emerald-600">
                            {amountDisplay}
                          </TableCell>
                          <TableCell className="max-w-[16rem] truncate">
                            {record.description || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEditRecord(record)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteRecord(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando <strong>{visibleRecords.length}</strong> de{" "}
                  <strong>{filteredRecords.length}</strong> visitas
                </div>
                {canLoadMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMoreRecords}
                  >
                    Cargar más visitas
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogo agregar */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar visita con pago único</DialogTitle>
            <DialogDescription>
              Guarda los datos de la persona y cuándo esperas recibir el pago de
              la agencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={newRecord.fullName}
                onChange={(event) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    fullName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Celular</Label>
              <Input
                id="phone"
                value={newRecord.phone}
                onChange={(event) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Origen</Label>
              <Select
                value={newRecord.sourceOption}
                onValueChange={(value) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    sourceOption: value as SourceOption,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un origen" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newRecord.sourceOption === "Otro" && (
                <Input
                  placeholder="Especifica el origen"
                  value={newRecord.otherSource}
                  onChange={(event) =>
                    setNewRecord((prev) => ({
                      ...prev,
                      otherSource: event.target.value,
                    }))
                  }
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visitDate">Fecha de uso del pase</Label>
              <Input
                id="visitDate"
                type="date"
                value={newRecord.visitDate}
                onChange={(event) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    visitDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estimatedPaymentDate">
                Fecha estimada de cobro
              </Label>
              <Input
                id="estimatedPaymentDate"
                type="date"
                value={newRecord.estimatedPaymentDate}
                onChange={(event) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    estimatedPaymentDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto a cobrar</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={newRecord.amount}
                onChange={(event) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={newRecord.description}
                onChange={(event) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Notas sobre la visita, clase, etc."
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateRecord}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo editar */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar visita</DialogTitle>
            <DialogDescription>
              Actualiza los datos del pago único seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="editFullName">Nombre completo</Label>
              <Input
                id="editFullName"
                value={editRecordData.fullName}
                onChange={(event) =>
                  setEditRecordData((prev) => ({
                    ...prev,
                    fullName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editPhone">Celular</Label>
              <Input
                id="editPhone"
                value={editRecordData.phone}
                onChange={(event) =>
                  setEditRecordData((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Origen</Label>
              <Select
                value={editRecordData.sourceOption}
                onValueChange={(value) =>
                  setEditRecordData((prev) => ({
                    ...prev,
                    sourceOption: value as SourceOption,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un origen" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editRecordData.sourceOption === "Otro" && (
                <Input
                  placeholder="Especifica el origen"
                  value={editRecordData.otherSource}
                  onChange={(event) =>
                    setEditRecordData((prev) => ({
                      ...prev,
                      otherSource: event.target.value,
                    }))
                  }
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editVisitDate">Fecha de uso del pase</Label>
              <Input
                id="editVisitDate"
                type="date"
                value={editRecordData.visitDate}
                onChange={(event) =>
                  setEditRecordData((prev) => ({
                    ...prev,
                    visitDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editEstimatedPaymentDate">
                Fecha estimada de cobro
              </Label>
              <Input
                id="editEstimatedPaymentDate"
                type="date"
                value={editRecordData.estimatedPaymentDate}
                onChange={(event) =>
                  setEditRecordData((prev) => ({
                    ...prev,
                    estimatedPaymentDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editAmount">Monto a cobrar</Label>
              <Input
                id="editAmount"
                type="number"
                min="0"
                step="0.01"
                value={editRecordData.amount}
                onChange={(event) =>
                  setEditRecordData((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editDescription">Descripción</Label>
              <Textarea
                id="editDescription"
                value={editRecordData.description}
                onChange={(event) =>
                  setEditRecordData((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdateRecord}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
