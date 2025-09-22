"use client";

import { useState } from "react";
import { supabase, Member, CustomPlan, Payment } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  CalendarClock,
  Ban,
  PiggyBank,
} from "lucide-react";

interface CustomPlanManagementProps {
  customPlans: CustomPlan[];
  setCustomPlans: (plans: CustomPlan[]) => void;
  members: Member[];
  payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  gymId: string;
}

type StatusFilter = "all" | "active" | "expiring" | "expired" | "inactive";

export function CustomPlanManagement({
  customPlans,
  setCustomPlans,
  members,
  payments,
  setPayments,
  gymId,
}: CustomPlanManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [isMemberSelectOpen, setIsMemberSelectOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [newPlan, setNewPlan] = useState({
    member_id: "",
    name: "",
    description: "",
    price: 0,
    start_date: new Date().toLocaleDateString("en-CA"),
    end_date: "",
    payment_date: new Date().toLocaleDateString("en-CA"),
    payment_method: "",
    card_brand: "",
    card_installments: 1,
    payment_description: "",
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const getDaysUntil = (plan: CustomPlan) => {
    const endDate = parseDate(plan.end_date);
    if (!endDate) return null;
    const diff = Math.ceil(
      (endDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  const isPlanExpired = (plan: CustomPlan) => {
    const days = getDaysUntil(plan);
    return days !== null && days < 0;
  };

  const isPlanExpiringSoon = (plan: CustomPlan) => {
    const days = getDaysUntil(plan);
    return days !== null && days >= 0 && days <= 7;
  };

  const formatDate = (value?: string | null) => {
    const parsedDate = parseDate(value);
    if (!parsedDate) return "Sin definir";
    return parsedDate.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const currencyFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const totalPlans = customPlans.length;
  const activePlans = customPlans.filter(
    (plan) => plan.is_active && !isPlanExpired(plan)
  ).length;
  const expiringSoonCount = customPlans.filter(
    (plan) => plan.is_active && isPlanExpiringSoon(plan)
  ).length;
  const expiredPlans = customPlans.filter((plan) => isPlanExpired(plan)).length;
  const inactivePlans = customPlans.filter((plan) => !plan.is_active).length;
  const totalRevenue = customPlans.reduce(
    (sum, plan) => sum + (plan.price || 0),
    0
  );
  const formattedTotalRevenue = currencyFormatter.format(totalRevenue);

  const searchFilteredPlans = customPlans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.member_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

   const filteredPlans = searchFilteredPlans.filter((plan) => {
    switch (statusFilter) {
      case "active":
        return plan.is_active && !isPlanExpired(plan);
      case "expiring":
        return plan.is_active && isPlanExpiringSoon(plan);
      case "expired":
        return isPlanExpired(plan);
      case "inactive":
        return !plan.is_active;
      default:
        return true;
    }
  });

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    const dateA = parseDate(a.end_date);
    const dateB = parseDate(b.end_date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handleMemberSearchChange = (value: string) => {
    setMemberSearch(value);
    setIsMemberSelectOpen(value.trim().length > 0);
  };


  const filterDescriptionMap: Record<StatusFilter, string> = {
    all: "Listado completo de planes personalizados.",
    active: "Planes activos con fecha vigente.",
    expiring: "Planes que vencen en los próximos 7 días.",
    expired: "Planes con fecha de finalización vencida.",
    inactive: "Planes marcados como inactivos.",
  };

  const filterDescription = filterDescriptionMap[statusFilter];
  const hasActiveFilters =
    statusFilter !== "all" || searchTerm.trim().length > 0;
  const resultsLabel =
    filteredPlans.length === 1
      ? "1 plan"
      : `${filteredPlans.length} planes`;

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const renderStatusBadge = (plan: CustomPlan) => {
    if (!plan.is_active) {
      return (
        <Badge className="border-transparent bg-slate-200 text-slate-700">
          Inactivo
        </Badge>
      );
    }

    if (isPlanExpired(plan)) {
      return (
        <Badge className="border-transparent bg-red-500/10 text-red-600">
          Vencido
        </Badge>
      );
    }

    if (isPlanExpiringSoon(plan)) {
      return (
        <Badge className="border-transparent bg-amber-100 text-amber-800">
          Próximo a vencer
        </Badge>
      );
    }

    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700">
        Activo
      </Badge>
    );
  };

  const renderTimeLeft = (plan: CustomPlan) => {
    const days = getDaysUntil(plan);
    if (!plan.end_date) {
      return (
        <span className="text-xs text-muted-foreground">
          Sin fecha de finalización
        </span>
      );
    }

    if (days === null) {
      return (
        <span className="text-xs text-muted-foreground">
          Sin información disponible
        </span>
      );
    }

    if (days > 0) {
      return (
        <span className="text-xs text-emerald-600">
          Faltan {days} día{days === 1 ? "" : "s"}
        </span>
      );
    }

    if (days === 0) {
      return (
        <span className="text-xs font-medium text-amber-600">
          Vence hoy
        </span>
      );
    }

    return (
      <span className="text-xs text-red-600">
        Vencido hace {Math.abs(days)} día{Math.abs(days) === 1 ? "" : "s"}
      </span>
    );
  };

  const cardBrands = [
    "VISA",
    "OCA",
    "MASTER",
    "CABAL",
    "AMEX",
    "TARJETA D",
    "MERCADO PAGO",
  ];

  const handleAddPlan = async () => {
    const member = members.find((m) => m.id === newPlan.member_id);
    if (!member) return;

    const id = `${gymId}_custom_${Date.now()}`;
    const plan: CustomPlan = {
      id,
      gym_id: gymId,
      member_id: member.id,
      member_name: member.name,
      name: newPlan.name,
      description: newPlan.description,
      price: newPlan.price,
      start_date: newPlan.start_date,
      end_date: newPlan.end_date,
      is_active: true,
    };

    const { error } = await supabase.from("custom_plans").insert([plan]);
    if (error) {
      console.error("Error al guardar plan personalizado:", error);
      return;
    }

    const paymentId = `${gymId}_payment_${Date.now()}`;
    const payment: Payment = {
      id: paymentId,
      gym_id: gymId,
      member_id: member.id,
      member_name: member.name,
      amount: newPlan.price,
      date: newPlan.payment_date,
      start_date: newPlan.start_date,
      plan: newPlan.name,
      method: newPlan.payment_method || "Efectivo",
      card_brand: ["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
        newPlan.payment_method || ""
      )
        ? newPlan.card_brand
        : undefined,
      card_installments:
        newPlan.payment_method === "Tarjeta de Crédito"
          ? newPlan.card_installments
          : undefined,
      type: "plan",
      description: newPlan.payment_description || undefined,
      plan_id: id,
    };

    const { error: paymentError } = await supabase
      .from("payments")
      .insert([payment]);
    if (paymentError) {
      console.error("Error al registrar pago de personalizado:", paymentError);
    } else {
      setPayments([...payments, payment]);
    }


    setCustomPlans([...customPlans, plan]);
    setIsAddDialogOpen(false);
    setNewPlan({
      member_id: "",
      name: "",
      description: "",
      price: 0,
      start_date: new Date().toLocaleDateString("en-CA"),
      end_date: "",
      payment_date: new Date().toLocaleDateString("en-CA"),
      payment_method: "",
      card_brand: "",
      card_installments: 1,
      payment_description: "",
    });
    setMemberSearch("");
    setIsMemberSelectOpen(false);
  };

  const handleDeletePlan = async (id: string) => {
    const { error } = await supabase.from("custom_plans").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar plan personalizado:", error);
      return;
    }
    setCustomPlans(customPlans.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Planes Personalizados
          </h2>
          <p className="text-muted-foreground">
            Gestiona los planes personalizados de los socios
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Plan Personalizado</DialogTitle>
              <DialogDescription>
                Asocia un plan especial a un socio.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Buscar Socio</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar socio..."
                    className="pl-8"
                    value={memberSearch}
                    onFocus={() => setIsMemberSelectOpen(true)}
                    onChange={(e) => handleMemberSearchChange(e.target.value)}
                  />
                </div>
                <Select
                 open={isMemberSelectOpen}
                  onOpenChange={setIsMemberSelectOpen}
                  value={newPlan.member_id}
                   onValueChange={(v) => {
                    setNewPlan({ ...newPlan, member_id: v });
                    const selectedMember = members.find((m) => m.id === v);
                    if (selectedMember) {
                      setMemberSearch(selectedMember.name);
                    }
                    setIsMemberSelectOpen(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar socio" />
                  </SelectTrigger>
                  <SelectContent>
                     {filteredMembers.length === 0 ? (
                      <SelectItem value="no-results" disabled>
                        Sin resultados
                      </SelectItem>
                  ) : (
                      filteredMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Nombre del Plan</Label>
                <Input
                  value={newPlan.name}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Descripción</Label>
                <Input
                  value={newPlan.description}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, description: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Precio ($)</Label>
                <Input
                  type="number"
                  value={newPlan.price}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, price: Number(e.target.value) })
                  }
                />
              </div>
               <div className="grid gap-2">
                <Label>Fecha de inicio</Label>
                <Input
                  type="date"
                  value={newPlan.start_date}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, start_date: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de pago</Label>
                <Input
                  type="date"
                  value={newPlan.payment_date}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, payment_date: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Método de pago</Label>
                <Select
                  value={newPlan.payment_method}
                  onValueChange={(v) =>
                    setNewPlan({
                      ...newPlan,
                      payment_method: v,
                      card_brand: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="Tarjeta de Débito">Tarjeta de Débito</SelectItem>
                    <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

               {[
                "Tarjeta de Crédito",
                "Tarjeta de Débito",
              ].includes(newPlan.payment_method || "") && (
                <>
                  <div className="grid gap-2">
                    <Label>Tipo de Tarjeta</Label>
                    <Select
                      value={newPlan.card_brand}
                      onValueChange={(v) =>
                        setNewPlan({ ...newPlan, card_brand: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tarjeta" />
                      </SelectTrigger>
                      <SelectContent>
                        {cardBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cardInstallments">
                      Número de cuotas en la tarjeta
                    </Label>
                    <Input
                      id="cardInstallments"
                      type="number"
                      min={1}
                      value={newPlan.card_installments}
                      onChange={(e) =>
                        setNewPlan({
                          ...newPlan,
                          card_installments: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="payment_description">Descripción del pago</Label>
                <Input
                  id="payment_description"
                  value={newPlan.payment_description}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      payment_description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de finalización</Label>
                <Input
                  type="date"
                  value={newPlan.end_date}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, end_date: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddPlan}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500 text-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100/80">
              Planes activos
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{activePlans}</div>
            <p className="text-xs text-blue-100/80">
              de {totalPlans} plan{totalPlans === 1 ? "" : "es"} totales
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximos a vencer (7 días)
            </CardTitle>
            <CalendarClock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-amber-600">
              {expiringSoonCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Seguimiento recomendado
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Planes vencidos
            </CardTitle>
            <Ban className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-600">
              {expiredPlans}
            </div>
            <p className="text-xs text-muted-foreground">
              {inactivePlans} marcados como inactivos
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Facturación total
            </CardTitle>
            <PiggyBank className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-emerald-600">
              {formattedTotalRevenue}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos por planes personalizados
            </p>
          </CardContent>
        </Card>
      </div>

        {expiringSoonCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm shadow-sm">
          <div className="flex items-start gap-3 text-amber-800">
            <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">
                {expiringSoonCount} plan{expiringSoonCount === 1 ? "" : "es"} próximo
                {expiringSoonCount === 1 ? "" : "s"} a vencer
              </p>
              <p className="text-xs text-amber-700">
                Revisa estos planes para renovar o contactar a los socios.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative w-full md:w-72 lg:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por socio o plan"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Estado del plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Solo activos</SelectItem>
                <SelectItem value="expiring">Próximos a vencer</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="justify-start text-muted-foreground hover:text-foreground md:w-auto"
            >
              Limpiar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Planes Registrados
            </CardTitle>
            <p className="text-sm text-muted-foreground">{filterDescription}</p>
          </div>
          <Badge variant="outline" className="w-fit">
            {resultsLabel}
          </Badge>
        </CardHeader>
         <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[640px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Precio
                    </TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-muted/40">
                      <TableCell className="align-top">
                        <div className="font-medium text-sm text-foreground">
                          {plan.member_name}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {plan.name}
                            </span>
                            {renderStatusBadge(plan)}
                          </div>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground">
                              {plan.description}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground md:hidden">
                            {currencyFormatter.format(plan.price)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden align-top text-right font-medium md:table-cell">
                        {currencyFormatter.format(plan.price)}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium uppercase text-muted-foreground">
                              Inicio
                            </span>
                            <span className="text-sm font-medium">
                              {formatDate(plan.start_date)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium uppercase text-muted-foreground">
                              Fin
                            </span>
                            <span className="text-sm font-medium">
                              {formatDate(plan.end_date)}
                            </span>
                          </div>
                          {renderTimeLeft(plan)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePlan(plan.id)}
                          className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          aria-label={`Eliminar plan ${plan.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedPlans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                          <p className="text-sm font-medium text-muted-foreground">
                            No encontramos planes con los filtros actuales.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Crea un nuevo plan personalizado para comenzar.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddDialogOpen(true)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Crear plan
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}