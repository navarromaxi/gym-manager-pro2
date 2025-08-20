"use client";

import { useState, useEffect } from "react";
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

// Normaliza "YYYY-MM-DD" a medianoche local (evita desfase por UTC)
const toLocalDate = (isoDate: string) => new Date(`${isoDate}T00:00:00`);

const getRealStatus = (member: Member): "active" | "expired" | "inactive" => {
    const today = new Date();
    //const next = new Date(member.next_payment);
    //const diffMs = today.getTime() - next.getTime();
    //const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const next = toLocalDate(member.next_payment);
    const diffDays = Math.ceil((today.getTime() - next.getTime()) / 86400000);

    if (diffDays <= 0) return "active";
    if (diffDays <= 30) return "expired";
    return "inactive";
  };

interface MemberManagementProps {
  members: Member[];
  setMembers: (members: Member[]) => void;
  payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  plans: Plan[];
  gymId: string;
  initialFilter?: string;
  onFilterChange?: (filter: string) => void;
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
    joinDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Efectivo",
  });

  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
  ];

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(statusFilter);
    }
  }, [statusFilter, onFilterChange]);

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    const today = new Date();

    /*  if (statusFilter === "expiring_soon") {
      const nextPayment = new Date(member.next_payment);
      const diffTime = nextPayment.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      matchesStatus =
        diffDays <= 10 && diffDays >= 0 && member.status === "active";
    } else if (statusFilter === "follow_up") {
      const joinDate = new Date(member.join_date);
      const diffDays = Math.floor(
        (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      matchesStatus = !member.followed_up && diffDays >= 5 && diffDays <= 10;
    } else {
      matchesStatus = statusFilter === "all" || member.status === statusFilter;
    } */
    const realStatus = getRealStatus(member);

    if (statusFilter === "expiring_soon") {
      const nextPayment = toLocalDate(member.next_payment);
      const diffTime = nextPayment.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / 86400000);
      matchesStatus =
        diffDays <= 10 && diffDays >= 0 && realStatus === "active";
    } else if (statusFilter === "follow_up") {
      const joinDate = toLocalDate(member.join_date);
      const diffDays = Math.floor((Date.now() - joinDate.getTime()) / 86400000);
      matchesStatus = !member.followed_up && diffDays >= 5 && diffDays <= 10;
    } else {
      matchesStatus = statusFilter === "all" || realStatus === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const handleAddMember = async () => {
    try {
      const joinDate = new Date(newMember.joinDate);
      const nextPayment = new Date(joinDate);
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
        join_date: newMember.joinDate,
        last_payment: newMember.joinDate,
        next_payment: nextPayment.toISOString().split("T")[0],
        status: memberStatus,
        inactive_level: inactiveLevel,
      };

      // Guardar en Supabase
      const { error: memberError } = await supabase
        .from("members")
        .insert([member]);

      if (memberError) throw memberError;

      // Crear pago inicial
      const payment: Payment = {
        id: `${gymId}_payment_${Date.now()}`,
        gym_id: gymId,
        member_id: memberId,
        member_name: member.name,
        amount: member.plan_price,
        date: newMember.joinDate,
        plan: member.plan,
        method: newMember.paymentMethod,
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
        joinDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Efectivo",
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
      const { error } = await supabase
        .from("members")
        .update({
          name: editingMember.name,
          email: editingMember.email,
          phone: editingMember.phone,
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      setMembers(
        members.map((m) => (m.id === editingMember.id ? editingMember : m))
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
      case "inactive":
        const color =
          level === "green"
            ? "bg-green-500"
            : level === "yellow"
            ? "bg-yellow-500"
            : "bg-red-500";
        return <Badge className={`${color} text-white`}>Inactivo</Badge>;
    }
  };

  const getDaysUntilExpiration = (nextPayment: string) => {
    const today = new Date();
    const expiration = new Date(nextPayment);
    const diffTime = expiration.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  //Funcion para crear alerta de socios proximo a vencerse
  /* const getExpiringMembers = () => {
    const today = new Date();

    return members.filter((member) => {
      const nextPayment = new Date(member.next_payment);
      const diffTime = nextPayment.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays <= 10 && diffDays >= 0 && member.status === "active";
    });
  }; */
  const getExpiringMembers = () => {
    const today = new Date();
    return members.filter((member) => {
      const nextPayment = toLocalDate(member.next_payment);
      const diffDays = Math.ceil(
        (nextPayment.getTime() - today.getTime()) / 86400000
      );
      return (
        diffDays <= 10 && diffDays >= 0 && getRealStatus(member) === "active"
      );
    });
  };

  //Función para marcar como contactado
  const handleMarkAsFollowedUp = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("members")
        .update({ followed_up: true })
        .eq("id", memberId);

      if (error) throw error;

      const updatedMembers = members.map((m) =>
        m.id === memberId ? { ...m, followed_up: true } : m
      );
      setMembers(updatedMembers);
      setRefreshKey((prev) => prev + 1); // Forzar rerender
    } catch (error) {
      console.error("Error al marcar como contactado:", error);
      alert("No se pudo marcar como contactado.");
    }
  };
  //ACAA PEGO
  const getMembersToFollowUp = () => {
    const today = new Date();
    return members.filter((member) => {
      const joinDate = new Date(member.join_date);
      const diffDays = Math.floor(
        (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return !member.followed_up && diffDays >= 5 && diffDays <= 12;
    });
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
            <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto">
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
                <Label htmlFor="joinDate">Fecha de Ingreso</Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={newMember.joinDate}
                  onChange={(e) =>
                    setNewMember({ ...newMember, joinDate: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  El plan se calculará desde esta fecha (útil si se registra con
                  atraso)
                </p>
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
                    setNewMember({ ...newMember, paymentMethod: value })
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
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddMember}>
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
                <SelectItem value="follow_up">Seguimiento pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Próximo Pago</TableHead>
                <TableHead>Días Restantes</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const daysUntilExpiration = getDaysUntilExpiration(
                  member.next_payment
                );
                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {member.plan} - ${member.plan_price}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(getRealStatus(member))}
                    </TableCell>
                    <TableCell>
                      {new Date(member.next_payment).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
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
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMember(member.id)}
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
