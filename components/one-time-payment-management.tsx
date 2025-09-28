"use client";

import { useMemo, useState } from "react";
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

const SOURCE_OPTIONS: { value: SourceOption; label: string }[] = [
  { value: "TuPase", label: "TuPase" },
  { value: "PaseLibre", label: "PaseLibre" },
  { value: "Otro", label: "Otro diferente" },
];

const todayISO = () => new Date().toISOString().split("T")[0];

const resolveSource = (option: SourceOption, other: string) => {
  if (option === "Otro") {
    const trimmed = other.trim();
    return trimmed.length > 0 ? trimmed : "Otro diferente";
  }
  return option;
};

const normalizeSourceOption = (source: string): {
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

const toComparableDate = (value: string) => new Date(value + "T00:00:00").getTime();

export function OneTimePaymentManagement({
  records,
  setRecords,
  gymId,
}: OneTimePaymentManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceOption | "all">(
    "all"
  );
  const [editingRecord, setEditingRecord] = useState<OneTimePayment | null>(
    null
  );

  const [newRecord, setNewRecord] = useState({
    fullName: "",
    phone: "",
    sourceOption: "TuPase" as SourceOption,
    otherSource: "",
    description: "",
    visitDate: todayISO(),
    estimatedPaymentDate: todayISO(),
  });

  const [editRecordData, setEditRecordData] = useState({
    fullName: "",
    phone: "",
    sourceOption: "TuPase" as SourceOption,
    otherSource: "",
    description: "",
    visitDate: todayISO(),
    estimatedPaymentDate: todayISO(),
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
    });
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) =>
      toComparableDate(b.visit_date) - toComparableDate(a.visit_date)
    );
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sortedRecords.filter((record) => {
      if (sourceFilter !== "all" && record.source !== sourceFilter) {
        if (!(sourceFilter === "Otro" && record.source !== "TuPase" && record.source !== "PaseLibre")) {
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
  }, [sortedRecords, searchTerm, sourceFilter]);

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
      .sort((a, b) =>
        toComparableDate(a.estimated_payment_date) -
        toComparableDate(b.estimated_payment_date)
      )
      .slice(0, 5);
  }, [records]);

  const totalsBySource = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        const source =
          record.source === "TuPase" || record.source === "PaseLibre"
            ? record.source
            : "Otros";
        acc[source] = (acc[source] || 0) + 1;
        acc.total += 1;
        return acc;
      },
      { TuPase: 0, PaseLibre: 0, Otros: 0, total: 0 } as Record<
        "TuPase" | "PaseLibre" | "Otros" | "total",
        number
      >
    );
  }, [records]);

  const handleCreateRecord = async () => {
    if (!gymId) return;

    const source = resolveSource(newRecord.sourceOption, newRecord.otherSource);
    const payload = {
      gym_id: gymId,
      full_name: newRecord.fullName.trim(),
      phone: newRecord.phone.trim(),
      source,
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
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRecord = async () => {
    if (!gymId || !editingRecord) return;

    const source = resolveSource(
      editRecordData.sourceOption,
      editRecordData.otherSource
    );

    const payload = {
      full_name: editRecordData.fullName.trim(),
      phone: editRecordData.phone.trim(),
      source,
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
            record.id === editingRecord.id
              ? (data as OneTimePayment)
              : record
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
              Registra las visitas de personas no socias provenientes de agencias
              externas y lleva el control de los cobros pendientes.
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
            <div className="flex flex-col justify-end gap-2 md:items-end">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Total: {totalsBySource.total}
                </Badge>
                <Badge variant="secondary">TuPase: {totalsBySource.TuPase}</Badge>
                <Badge variant="secondary">
                  PaseLibre: {totalsBySource.PaseLibre}
                </Badge>
                <Badge variant="secondary">Otros: {totalsBySource.Otros}</Badge>
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
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(record.estimated_payment_date)}
                    </Badge>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Uso del pase</TableHead>
                    <TableHead>Pago estimado</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
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
                  ))}
                </TableBody>
              </Table>
            </div>
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateRecord}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}