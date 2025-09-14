"use client";

import { useState, useEffect } from "react";
import { getRealStatus } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Member, Payment, Plan } from "@/lib/supabase";
import { TableVirtuoso } from "react-virtuoso";

//Agrego para la paginacion
import { fetchMembersPage } from "@/lib/queries";

// FIN DE CODIGO PARA LA PAGINACION

interface MemberManagementProps {
  members: Member[];
  setMembers: (members: Member[]) => void;
  payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  plans: Plan[];
  gymId: string;
  initialFilter?: string;
  onFilterChange?: (filter: string) => void;

  serverPaging?: boolean; // si true, ignora "members" y trae por páginas
}

export function MemberManagement({
  members,
  setMembers,
  payments,
  setPayments,
  plans,
  gymId,
  initialFilter = "all",
  onFilterChange,
  serverPaging = false,
}: MemberManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    phone: "",
    plan: "",
    planPrice: 0,
    planStartDate: new Date().toISOString().split("T")[0],
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Efectivo",
    cardBrand: "",
    cardInstallments: 1,
    description: "",
  });

  // Estados de paginación (solo se usan si serverPaging=true)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pagedMembers, setPagedMembers] = useState<Member[]>([]);

  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
  ];

  const cardBrands = ["Visa", "Mastercard", "American Express", "Otra"];

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  // avisa al padre si cambia el filtro elegido
  useEffect(() => {
    if (onFilterChange) onFilterChange(statusFilter);
  }, [statusFilter, onFilterChange]);

  // carga de página desde Supabase cuando está activo server paging
  useEffect(() => {
    if (!serverPaging || !gymId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingPage(true);
        const { rows, total } = await fetchMembersPage({
          gymId,
          page,
          pageSize,
          search: searchTerm,
          orderBy: "last_payment",
          ascending: false,
        });
        if (cancelled) return;
        setPagedMembers(rows);
        setTotalRows(total);
        // opcional: reflejar la página en el estado externo
        setMembers(rows);
      } catch (e) {
        console.error("Error trayendo página de miembros:", e);
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverPaging, gymId, page, pageSize, searchTerm, setMembers]);

  // cuando cambia el término de búsqueda, volvemos a la página 1
  useEffect(() => {
    setPage(1);
  }, [searchTerm, serverPaging]);

  // fuente base: si serverPaging=true uso la página; si no, lo que vino por props
  const baseMembers = serverPaging ? pagedMembers : members;

  const filteredMembers = baseMembers.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;

    if (statusFilter === "expiring_soon") {
      const nextPayment = toLocalDate(member.next_payment);
      const diffDays = Math.ceil(
        (nextPayment.getTime() - Date.now()) / 86400000
      );
      matchesStatus =
        diffDays <= 10 && diffDays >= 0 && getRealStatus(member) === "active";
    } else if (statusFilter === "balance_due") {
      matchesStatus = (member.balance_due || 0) > 0;
    } else {
      matchesStatus =
        statusFilter === "all" || getRealStatus(member) === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const handleAddMember = async () => {
    try {
      const startDate = new Date(newMember.planStartDate);
      const nextPayment = new Date(startDate);
      const selectedPlan = plans.find((p) => p.name === newMember.plan);

      if (selectedPlan) {
        if (selectedPlan.duration_type === "days") {
          nextPayment.setDate(nextPayment.getDate() + selectedPlan.duration);
        } else if (selectedPlan.duration_type === "months") {
          nextPayment.setMonth(nextPayment.getMonth() + selectedPlan.duration);
        } else if (selectedPlan.duration_type === "years") {
          nextPayment.setFullYear(
            nextPayment.getFullYear() + selectedPlan.duration
          );
        }
      }

      const today = new Date();
      const diffTime = today.getTime() - nextPayment.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let memberStatus: "active" | "expired" | "inactive" = "active";
      let inactiveLevel: "green" | "yellow" | "red" | undefined = undefined;

      if (nextPayment > today) {
        memberStatus = "active";
      } else if (diffDays > 0) {
        if (diffDays > 30) {
          memberStatus = "inactive";
          inactiveLevel = "yellow";
        } else {
          memberStatus = "expired";
        }
      } else {
        memberStatus = "expired";
      }

      const memberId = `${gymId}_member_${Date.now()}`;

      const member: Member = {
        id: memberId,
        gym_id: gymId,
        name: newMember.name,
        email: newMember.email,
        phone: newMember.phone,
        plan: newMember.plan,
        plan_price: newMember.planPrice,
        join_date: newMember.paymentDate,
        last_payment: newMember.planStartDate,
        next_payment: nextPayment.toISOString().split("T")[0],
        balance_due: 0,
        status: memberStatus,
        inactive_level: inactiveLevel,
        followed_up: false,
      };

      // Guardar en Supabase
      const { error: memberError } = await supabase
        .from("members")
        .insert([member]);

      if (memberError) throw memberError;

      // Crear pago inicial
      const contractId = `${memberId}_contract_${Date.now()}`;
      const payment: Payment = {
        id: `${gymId}_payment_${Date.now()}`,
        gym_id: gymId,
        member_id: memberId,
        member_name: member.name,
        amount: member.plan_price,
        date: newMember.paymentDate,
        start_date: newMember.planStartDate,
        plan: member.plan,
        method: newMember.paymentMethod,
        card_brand:
          newMember.paymentMethod === "Tarjeta de Crédito"
            ? newMember.cardBrand
            : undefined,
        card_installments:
          newMember.paymentMethod === "Tarjeta de Crédito"
            ? newMember.cardInstallments
            : undefined,
        type: "plan",
        description: newMember.description || undefined,
        plan_id: selectedPlan?.id,
      };

      const { error: paymentError } = await supabase
        .from("payments")
        .insert([payment]);

      if (paymentError) throw paymentError;

      // Actualizar estados locales
      setMembers([...members, member]);
      setPayments([...payments, payment]);

      setNewMember({
        name: "",
        email: "",
        phone: "",
        plan: "",
        planPrice: 0,
        planStartDate: new Date().toISOString().split("T")[0],
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Efectivo",
        cardBrand: "",
        cardInstallments: 1,
        description: "",
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error agregando miembro:", error);
      alert("Error al agregar el miembro. Inténtalo de nuevo.");
    }
  };

  const handleEditMember = async () => {
    if (!editingMember) return;

    try {
      const nextPaymentDate = new Date(editingMember.next_payment);
      const today = new Date();
      const diffDays = Math.ceil(
        (today.getTime() - nextPaymentDate.getTime()) / 86400000
      );
      let newStatus: "active" | "expired" | "inactive" = "active";
      let newInactive: "green" | "yellow" | "red" | undefined;
      if (diffDays > 0) {
        if (diffDays <= 30) {
          newStatus = "expired";
        } else {
          newStatus = "inactive";
          newInactive = "yellow";
        }
      }
      const { error } = await supabase
        .from("members")
        .update({
          name: editingMember.name,
          email: editingMember.email,
          phone: editingMember.phone,
          next_payment: editingMember.next_payment,
          status: newStatus,
          inactive_level: newInactive,
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      setMembers(
        members.map((m) =>
          m.id === editingMember.id
            ? {
                ...editingMember,
                status: newStatus,
                inactive_level: newInactive,
              }
            : m
        )
      );
      setIsEditDialogOpen(false);
      setEditingMember(null);
    } catch (error) {
      console.error("Error editando miembro:", error);
      alert("Error al editar el miembro. Inténtalo de nuevo.");
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este miembro?")) return;

    try {
      // Eliminar pagos relacionados
      const { error: paymentsError } = await supabase
        .from("payments")
        .delete()
        .eq("member_id", id);

      if (paymentsError) throw paymentsError;

      // Eliminar miembro
      const { error: memberError } = await supabase
        .from("members")
        .delete()
        .eq("id", id);

      if (memberError) throw memberError;

      // Actualizar estados locales
      setMembers(members.filter((m) => m.id !== id));
      setPayments(payments.filter((p) => p.member_id !== id));
    } catch (error) {
      console.error("Error eliminando miembro:", error);
      alert("Error al eliminar el miembro. Inténtalo de nuevo.");
    }
  };


  const getStatusBadge = (
    status: "active" | "expired" | "inactive",
    level?: "green" | "yellow" | "red"
  ) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Activo</Badge>;
      case "expired":
        return <Badge variant="destructive">Vencido</Badge>;
      case "inactive": {
        const color =
          level === "green"
            ? "bg-green-500"
            : level === "yellow"
            ? "bg-yellow-500"
            : "bg-red-500";
        return <Badge className={`${color} text-white`}>Inactivo</Badge>;
      }
    }
  };

  const getDaysUntilExpiration = (nextPayment: string) => {
    const today = new Date();
    const expiration = toLocalDate(nextPayment);
    const diffTime = expiration.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // 👇 Si no lo tenés ya:
  const toLocalDate = (iso: string) => new Date(`${iso}T00:00:00`);

  // Estado para forzar rerender en algunos updates (ej. marcar seguido)
  const [refreshKey, setRefreshKey] = useState(0);

  // ⛳ Socios por vencer (10 días)
  const getExpiringMembers = () => {
    const today = new Date();
    return members.filter((member) => {
      const nextPayment = toLocalDate(member.next_payment);
      const diffDays = Math.ceil(
        (nextPayment.getTime() - today.getTime()) / 86400000
      );
      // usamos estado real
      return (
        diffDays <= 10 && diffDays >= 0 && getRealStatus(member) === "active"
      );
    });
  };

  // ⛳ Socios a contactar (ingresaron hace 5–12 días y no follow-up)
  const getMembersToFollowUp = () => {
    const today = new Date();
    return members.filter((member) => {
      const joinDate = toLocalDate(member.join_date);
      const diffDays = Math.floor(
        (today.getTime() - joinDate.getTime()) / 86400000
      );
      // @ts-ignore (si tu tipo Member aún no declara followed_up)
      return !member.followed_up && diffDays >= 5 && diffDays <= 12;
    });
  };

  // ⛳ Socios con saldo pendiente
  const getMembersWithBalanceDue = () => {
    return members.filter((member) => (member.balance_due || 0) > 0);
  };

  const getMonthlyPaymentSummary = (member: Member) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const memberPayments = payments.filter((p) => p.member_id === member.id);
    const paymentsThisMonth = memberPayments.filter((p) => {
      const d = new Date(p.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const totalAmount = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);
    const extras = paymentsThisMonth
      .map((p) => p.plan)
      .filter((name) => name && name !== member.plan);
    return `${member.plan}${
      extras.length ? " + " + extras.join(" + ") : ""
    } = $${totalAmount}`;
  };

  // ⛳ Marcar como contactado
  const handleMarkAsFollowedUp = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("members")
        .update({ followed_up: true })
        .eq("id", memberId);

      if (error) throw error;

      // @ts-ignore (si tu tipo Member aún no declara followed_up)
      setMembers(
        members.map((m) =>
          m.id === memberId ? { ...m, followed_up: true } : m
        )
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Error al marcar como contactado:", err);
      alert("No se pudo marcar como contactado.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Socios
          </h2>
          <p className="text-muted-foreground">
            Administra los miembros del gimnasio
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Socio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Socio</DialogTitle>
              <DialogDescription>
                Completa los datos del nuevo miembro del gimnasio.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  value={newMember.name}
                  onChange={(e) =>
                    setNewMember({ ...newMember, name: e.target.value })
                  }
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) =>
                    setNewMember({ ...newMember, email: e.target.value })
                  }
                  placeholder="juan@email.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newMember.phone}
                  onChange={(e) =>
                    setNewMember({ ...newMember, phone: e.target.value })
                  }
                  placeholder="099123456"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planStartDate">Fecha de inicio del plan</Label>
                <Input
                  id="planStartDate"
                  type="date"
                  value={newMember.planStartDate}
                  onChange={(e) =>
                    setNewMember({
                      ...newMember,
                      planStartDate: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  El plan se calculará desde esta fecha (útil si se registra con
                  atraso)
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentDate">Fecha de pago</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={newMember.paymentDate}
                  onChange={(e) =>
                    setNewMember({ ...newMember, paymentDate: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan">Plan</Label>
                <Select
                  value={newMember.plan}
                  onValueChange={(value) => {
                    const selectedPlan = plans.find((p) => p.name === value);
                    setNewMember({
                      ...newMember,
                      plan: value,
                      planPrice: selectedPlan?.price || 0,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans
                      .filter((plan) => plan.is_active)
                      .map((plan) => (
                        <SelectItem key={plan.id} value={plan.name}>
                          {plan.name} - ${plan.price}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Select
                  value={newMember.paymentMethod}
                  onValueChange={(value) =>
                    setNewMember({
                      ...newMember,
                      paymentMethod: value,
                      cardBrand: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newMember.paymentMethod === "Tarjeta de Crédito" && (
                 <>
                  <div className="grid gap-2">
                    <Label>Tipo de Tarjeta</Label>
                    <Select
                      value={newMember.cardBrand}
                      onValueChange={(value) =>
                        setNewMember({ ...newMember, cardBrand: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tarjeta" />
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
                      value={newMember.cardInstallments}
                      onChange={(e) =>
                        setNewMember({
                          ...newMember,
                          cardInstallments: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={newMember.description}
                  onChange={(e) =>
                    setNewMember({
                      ...newMember,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddMember}
                disabled={
                  newMember.paymentMethod === "Tarjeta de Crédito" &&
                  !newMember.cardBrand
                }
              >
                Agregar Socio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="expired">
                  Vencidos (hasta 30 días)
                </SelectItem>
                <SelectItem value="inactive">Inactivos (+30 días)</SelectItem>
                <SelectItem value="expiring_soon">
                  Próximo a vencerse (10 días)
                </SelectItem>
                <SelectItem value="balance_due">Saldo pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table (Virtualizada) */}
      <Card key={refreshKey}>
        <CardHeader>
          <CardTitle>Lista de Socios ({filteredMembers.length})</CardTitle>

          {getExpiringMembers().length > 0 && (
            <div className="mt-2 text-sm text-orange-700 bg-orange-100 border-l-4 border-orange-500 p-3 rounded flex justify-between items-center">
              ⚠️ Tienes {getExpiringMembers().length} socios con vencimiento
              próximo (menos de 10 días).
              <Button
                variant="ghost"
                className="text-orange-700 hover:underline"
                onClick={() => setStatusFilter("expiring_soon")}
              >
                Ver socios por vencer
              </Button>
            </div>
          )}

          {getMembersToFollowUp().length > 0 && (
            <div className="mt-2 text-sm text-yellow-700 bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded flex items-center justify-between">
              <span>
                ⚠️ Tienes socios que ingresaron hace entre 5 y 12 días y aún no
                fueron contactados.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-4"
                onClick={() => setStatusFilter("follow_up")}
              >
                Ver socios pendientes
              </Button>
            </div>
          )}

          {getMembersWithBalanceDue().length > 0 && (
            <div className="mt-2 text-sm text-red-700 bg-red-100 border-l-4 border-red-500 p-3 rounded flex items-center justify-between">
              <span>
                ⚠️ Tienes {getMembersWithBalanceDue().length} socios con saldo pendiente.
              </span>
              <Button
                variant="ghost"
                className="text-red-700 hover:underline"
                onClick={() => setStatusFilter("balance_due")}
              >
                Ver socios con saldo
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Alto fijo para que Virtuoso tenga viewport */}
          <div
            className="border rounded-md overflow-hidden"
            style={{ height: "60vh" }}
          >
            <TableVirtuoso
              data={filteredMembers}
              fixedHeaderContent={() => (
                <tr className="text-sm">
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Nombre
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Email
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Pagos
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Estado
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Próximo Pago
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Días Restantes
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Saldo Pendiente
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium">
                    Acciones
                  </th>
                </tr>
              )}
              itemContent={(_, member) => {
                const daysUntilExpiration = getDaysUntilExpiration(
                  member.next_payment
                );
                return (
                  <>
                    <td className="p-2 align-middle font-medium">
                      {member.name}
                    </td>
                    <td className="p-2 align-middle">{member.email}</td>
                    <td className="p-2 align-middle">
                      {getMonthlyPaymentSummary(member)}
                    </td>
                    <td className="p-2 align-middle">
                      {getStatusBadge(
                        getRealStatus(member),
                        member.inactive_level
                      )}
                    </td>
                    <td className="p-2 align-middle">
                      {new Date(
                        `${member.next_payment}T00:00:00`
                      ).toLocaleDateString()}
                    </td>
                    <td className="p-2 align-middle">
                      <span
                        className={`font-medium ${
                          daysUntilExpiration < 0
                            ? Math.abs(daysUntilExpiration) > 30
                              ? "text-gray-600"
                              : "text-red-600"
                            : daysUntilExpiration <= 7
                            ? "text-orange-600"
                            : "text-green-600"
                        }`}
                      >
                        {daysUntilExpiration < 0
                          ? Math.abs(daysUntilExpiration) > 30
                            ? `${Math.abs(daysUntilExpiration)} días inactivo`
                            : `${Math.abs(daysUntilExpiration)} días vencido`
                          : daysUntilExpiration === 0
                          ? "Vence hoy"
                          : `${daysUntilExpiration} días`}
                      </span>
                    </td>
                     <td className="p-2 align-middle">
                      {(member.balance_due ?? 0) > 0 ? (
                        <span className="text-red-600 font-semibold">
                          {`$${(member.balance_due ?? 0).toFixed(2)}`}
                        </span>
                      ) : (
                        "$0.00"
                      )}
                    </td>
                    <td className="p-2 align-middle">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsFollowedUp(member.id)}
                        >
                          <span role="img" aria-label="check">
                            ✅
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingMember(member);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <span className="sr-only">Editar</span>✏️
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMember(member.id)}
                        >
                          <span className="sr-only">Eliminar</span>🗑️
                        </Button>
                      </div>
                    </td>
                  </>
                );
              }}
              components={{
                // Usamos elementos nativos <table>, <thead>, <tbody>, <tr>, <td>
                Table: (props) => (
                  <table {...props} className="w-full text-sm" />
                ),
                TableHead: (props) => (
                  <thead {...props} className="bg-muted/50" />
                ),
                TableRow: (props) => <tr {...props} className="border-b" />,
                TableBody: (props) => <tbody {...props} />,
                // scroller por defecto ya maneja el scroll
              }}
            />
          </div>
          {/* Footer de paginación (solo visible con serverPaging) */}
          {serverPaging && (
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {loadingPage ? (
                  <>Cargando página…</>
                ) : (
                  <>
                    Mostrando{" "}
                    <strong>
                      {Math.min((page - 1) * pageSize + 1, totalRows)}–
                      {Math.min(page * pageSize, totalRows)}
                    </strong>{" "}
                    de <strong>{totalRows}</strong>
                  </>
                )}
                {statusFilter !== "all" && (
                  <>
                    {" "}
                    · Coinciden con el filtro:{" "}
                    <strong>{filteredMembers.length}</strong>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={loadingPage || page === 1}
                >
                  ← Anterior
                </Button>
                <span className="text-sm">
                  Página <strong>{page}</strong> /{" "}
                  <strong>
                    {Math.max(1, Math.ceil(totalRows / pageSize))}
                  </strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) =>
                      Math.min(
                        p + 1,
                        Math.max(1, Math.ceil(totalRows / pageSize))
                      )
                    )
                  }
                  disabled={
                    loadingPage || page >= Math.ceil(totalRows / pageSize)
                  }
                >
                  Siguiente →
                </Button>

                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Tamaño" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 / pág.</SelectItem>
                    <SelectItem value="50">50 / pág.</SelectItem>
                    <SelectItem value="100">100 / pág.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Socio</DialogTitle>
            <DialogDescription>Modifica los datos del socio.</DialogDescription>
          </DialogHeader>
          {editingMember && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre completo</Label>
                <Input
                  id="edit-name"
                  value={editingMember.name}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingMember.email}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      email: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={editingMember.phone}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      phone: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-next-payment">Fin del plan</Label>
                <Input
                  id="edit-next-payment"
                  type="date"
                  value={editingMember.next_payment}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      next_payment: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleEditMember}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
