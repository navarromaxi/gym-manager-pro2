"use client";

import { useState } from "react";
import { useEffect } from "react";
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
import { Plus, Edit, Trash2, Search, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Prospect, Member, Payment, Plan } from "@/lib/supabase";

interface ProspectManagementProps {
  prospects: Prospect[];
  setProspects: (updater: (prev: Prospect[]) => Prospect[]) => void;
  members: Member[];
  setMembers: (updater: (prev: Member[]) => Member[]) => void;
  payments: Payment[];
  setPayments: (updater: (prev: Payment[]) => Payment[]) => void;
  plans: Plan[];
  gymId: string;
}

export function ProspectManagement({
  prospects,
  setProspects,
  members,
  setMembers,
  payments,
  setPayments,
  plans,
  gymId,
}: ProspectManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [convertingProspect, setConvertingProspect] = useState<Prospect | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all"); // Nuevo estado para el filtro de prioridad
  const [newProspect, setNewProspect] = useState({
    name: "",
    email: "",
    phone: "",
    contact_date: new Date().toISOString().split("T")[0],
    interest: "",
    status: "new" as Prospect["status"],
    notes: "",
    priority_level: "green" as "green" | "yellow" | "red", // Nuevo campo con valor por defecto
  });
  const [conversionPlan, setConversionPlan] = useState<string | undefined>(
    undefined
  );
  const [conversionPaymentMethod, setConversionPaymentMethod] =
    useState("Efectivo");
  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
  ];

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const filteredProspects = prospects.filter((prospect) => {
    const matchesSearch =
      prospect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prospect.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prospect.notes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || prospect.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || prospect.priority_level === priorityFilter; // Nuevo filtro
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleAddProspect = async () => {
    try {
      const prospectId = `${gymId}_prospect_${Date.now()}`;

      const prospectToAdd: Prospect = {
        id: prospectId,
        gym_id: gymId,
        name: newProspect.name,
        email: newProspect.email,
        phone: newProspect.phone,
        contact_date: newProspect.contact_date,
        interest: newProspect.interest,
        status: newProspect.status,
        notes: newProspect.notes,
        priority_level: newProspect.priority_level,
      };

      const { data, error } = await supabase
        .from("prospects")
        .insert([prospectToAdd])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const addedProspect = data[0] as Prospect;
        setProspects((prev) => [...prev, addedProspect]);
        setNewProspect({
          name: "",
          email: "",
          phone: "",
          contact_date: new Date().toISOString().split("T")[0],
          interest: "",
          status: "new",
          notes: "",
          priority_level: "green", // Resetear a verde por defecto
        });
        setIsAddDialogOpen(false);
      }
    } catch (error: any) {
      // Usar 'any' para acceder a 'message'
      console.error("Error agregando interesado:", error.message || error);
      alert(
        `Error al agregar el interesado: ${
          error.message || "Error desconocido"
        }. Revisa la consola para más detalles.`
      );
    }
  };

  const handleEditProspect = async () => {
    if (!editingProspect) return;
    try {
      const { error } = await supabase
        .from("prospects")
        .update({
          name: editingProspect.name,
          email: editingProspect.email,
          phone: editingProspect.phone,
          contact_date: editingProspect.contact_date,
          interest: editingProspect.interest,
          status: editingProspect.status,
          notes: editingProspect.notes,
          priority_level: editingProspect.priority_level, // Incluir el nuevo campo
        })
        .eq("id", editingProspect.id)
        .eq("gym_id", gymId);

      if (error) throw error;

      setProspects((prev) =>
        prev.map((p) => (p.id === editingProspect.id ? editingProspect : p))
      );
      setIsEditDialogOpen(false);
      setEditingProspect(null);
    } catch (error) {
      console.error("Error editando interesado:", error);
      alert("Error al editar el interesado. Inténtalo de nuevo.");
    }
  };

  const handleDeleteProspect = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este interesado?"))
      return;
    try {
      const { error } = await supabase
        .from("prospects")
        .delete()
        .eq("id", id)
        .eq("gym_id", gymId);
      if (error) throw error;

      setProspects((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error eliminando interesado:", error);
      alert("Error al eliminar el interesado. Inténtalo de nuevo.");
    }
  };

  const handleConvertProspectToMember = async () => {
    if (!convertingProspect || !conversionPlan) return;
    try {
      const selectedPlan = plans.find((p) => p.id === conversionPlan);
      if (!selectedPlan) {
        alert("Plan seleccionado no válido.");
        return;
      }

      // 1. Crear el nuevo miembro
      const joinDate = new Date().toISOString().split("T")[0];
      const nextPayment = new Date(joinDate);

      if (selectedPlan.duration_type === "days") {
        nextPayment.setDate(nextPayment.getDate() + selectedPlan.duration);
      } else if (selectedPlan.duration_type === "months") {
        nextPayment.setMonth(nextPayment.getMonth() + selectedPlan.duration);
      } else if (selectedPlan.duration_type === "years") {
        nextPayment.setFullYear(
          nextPayment.getFullYear() + selectedPlan.duration
        );
      }

      const memberId = `${gymId}_member_${Date.now()}`;
      const newMember: Member = {
        id: memberId,
        gym_id: gymId,
        name: convertingProspect.name,
        email: convertingProspect.email || "",
        phone: convertingProspect.phone || "",
        join_date: joinDate,
        plan: selectedPlan.name,
        plan_price: selectedPlan.price,
        last_payment: joinDate,
        next_payment: nextPayment.toISOString().split("T")[0],
        status: "active",
      };

      const { error: memberError } = await supabase
        .from("members")
        .insert([newMember]);
      if (memberError) throw memberError;

      // 2. Crear el pago inicial
      const newPayment: Payment = {
        id: `${gymId}_payment_${Date.now()}`,
        gym_id: gymId,
        member_id: memberId,
        member_name: newMember.name,
        amount: newMember.plan_price,
        date: joinDate,
        plan: newMember.plan,
        method: conversionPaymentMethod,
      };

      const { error: paymentError } = await supabase
        .from("payments")
        .insert([newPayment]);
      if (paymentError) throw paymentError;

      // 3. Eliminar el interesado
      const { error: prospectDeleteError } = await supabase
        .from("prospects")
        .delete()
        .eq("id", convertingProspect.id)
        .eq("gym_id", gymId);
      if (prospectDeleteError) throw prospectDeleteError;

      // 4. Actualizar estados locales
      setMembers((prevMembers) => [...prevMembers, newMember]);
      setPayments((prevPayments) => [...prevPayments, newPayment]);
      setProspects((prevProspects) =>
        prevProspects.filter((p) => p.id !== convertingProspect.id)
      );

      // Limpiar y cerrar diálogos
      setIsConvertDialogOpen(false);
      setConvertingProspect(null);
      setConversionPlan("");
      setConversionPaymentMethod("Efectivo");
      alert("Interesado convertido a socio exitosamente!");
    } catch (error) {
      console.error("Error convirtiendo interesado a miembro:", error);
      alert("Error al convertir el interesado a socio. Inténtalo de nuevo.");
    }
  };

  const getStatusBadge = (status: Prospect["status"]) => {
    switch (status) {
      case "new":
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-500">
            Nuevo
          </Badge>
        );
      case "contacted":
        return <Badge variant="secondary">Contactado</Badge>;
      case "waiting_response":
        return (
          <Badge
            variant="outline"
            className="border-orange-500 text-orange-500"
          >
            Esperando Respuesta
          </Badge>
        );
      case "waiting_info":
        return (
          <Badge
            variant="outline"
            className="border-purple-500 text-purple-500"
          >
            Esperando Info
          </Badge>
        );
      case "trial_scheduled":
        return (
          <Badge variant="outline" className="border-cyan-500 text-cyan-500">
            Coordinamos Clase
          </Badge>
        );
      case "trial_completed":
        return (
          <Badge
            variant="outline"
            className="border-emerald-600 text-emerald-600"
          >
            Clase Realizada
          </Badge>
        );
      case "not_interested":
        return <Badge variant="destructive">No Interesado</Badge>;
      case "contact_later":
        return <Badge variant="outline">Contactar Después</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  // Nueva función para obtener el badge de prioridad
  const getPriorityBadge = (priority: Prospect["priority_level"]) => {
    switch (priority) {
      case "red":
        return (
          <Badge className="bg-red-500 hover:bg-red-500 text-white">Rojo</Badge>
        );
      case "yellow":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black">
            Amarillo
          </Badge>
        );
      case "green":
        return (
          <Badge className="bg-green-500 hover:bg-green-500 text-white">
            Verde
          </Badge>
        );
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Interesados
          </h2>
          <p className="text-muted-foreground">
            Administra los prospectos y conviértelos en socios.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Interesado
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Interesado</DialogTitle>
              <DialogDescription>
                Registra los datos de un nuevo prospecto.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  value={newProspect.name}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, name: e.target.value })
                  }
                  placeholder="Ana García"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newProspect.email}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, email: e.target.value })
                  }
                  placeholder="ana@email.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newProspect.phone}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, phone: e.target.value })
                  }
                  placeholder="098765432"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_date">Fecha de Contacto</Label>
                <Input
                  id="contact_date"
                  type="date"
                  value={newProspect.contact_date}
                  onChange={(e) =>
                    setNewProspect({
                      ...newProspect,
                      contact_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interest">Interés</Label>
                <Input
                  id="interest"
                  value={newProspect.interest}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, interest: e.target.value })
                  }
                  placeholder="Clases de spinning, Musculación"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={newProspect.status}
                  onValueChange={(value: Prospect["status"]) =>
                    setNewProspect({ ...newProspect, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="contacted">Contactado</SelectItem>
                    <SelectItem value="waiting_response">
                      Esperando Respuesta
                    </SelectItem>
                    <SelectItem value="waiting_info">Esperando Info</SelectItem>
                    <SelectItem value="trial_scheduled">
                      Coordinamos clase de prueba
                    </SelectItem>
                    <SelectItem value="trial_completed">
                      Ya hizo clase de prueba
                    </SelectItem>
                    <SelectItem value="not_interested">
                      No Interesado
                    </SelectItem>
                    <SelectItem value="contact_later">
                      Contactar Después
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Nuevo campo para la prioridad */}
              <div className="grid gap-2">
                <Label htmlFor="priority_level">Prioridad</Label>
                <Select
                  value={newProspect.priority_level}
                  onValueChange={(value: "green" | "yellow" | "red") =>
                    setNewProspect({ ...newProspect, priority_level: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Rojo (Alta)</SelectItem>
                    <SelectItem value="yellow">Amarillo (Media)</SelectItem>
                    <SelectItem value="green">Verde (Baja)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={newProspect.notes}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, notes: e.target.value })
                  }
                  placeholder="Notas adicionales sobre el interesado..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddProspect}>
                Agregar Interesado
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
                  placeholder="Buscar por nombre, email o notas..."
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
                <SelectItem value="new">Nuevo</SelectItem>
                <SelectItem value="contacted">Contactado</SelectItem>
                <SelectItem value="waiting_response">
                  Esperando Respuesta
                </SelectItem>
                <SelectItem value="waiting_info">Esperando Info</SelectItem>
                <SelectItem value="not_interested">No Interesado</SelectItem>
                <SelectItem value="contact_later">Contactar Después</SelectItem>
              </SelectContent>
            </Select>
            {/* Nuevo filtro por prioridad */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Prioridades</SelectItem>
                <SelectItem value="red">Rojo (Alta)</SelectItem>
                <SelectItem value="yellow">Amarillo (Media)</SelectItem>
                <SelectItem value="green">Verde (Baja)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {/* Prospects Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Interesados ({filteredProspects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Fecha Contacto</TableHead>
                <TableHead>Interés</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                {/* Nueva columna en la tabla */}
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.map((prospect) => (
                <TableRow key={prospect.id}>
                  <TableCell className="font-medium">{prospect.name}</TableCell>
                  <TableCell>{prospect.email}</TableCell>
                  <TableCell>{prospect.phone}</TableCell>
                  <TableCell>
                    {new Date(prospect.contact_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {prospect.interest}
                  </TableCell>
                  <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                  <TableCell>
                    {getPriorityBadge(prospect.priority_level)}
                  </TableCell>
                  {/* Mostrar prioridad */}
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingProspect(prospect);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConvertingProspect(prospect);
                          setIsConvertDialogOpen(true);
                        }}
                        title="Convertir a Socio"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProspect(prospect.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Interesado</DialogTitle>
            <DialogDescription>
              Modifica los datos del interesado.
            </DialogDescription>
          </DialogHeader>

          {editingProspect && (
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre completo</Label>
                <Input
                  id="edit-name"
                  value={editingProspect.name}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingProspect.email || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      email: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={editingProspect.phone || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      phone: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-contact_date">Fecha de Contacto</Label>
                <Input
                  id="edit-contact_date"
                  type="date"
                  value={editingProspect.contact_date}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      contact_date: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-interest">Interés</Label>
                <Input
                  id="edit-interest"
                  value={editingProspect.interest || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      interest: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-status">Estado</Label>
                <Select
                  value={editingProspect.status}
                  onValueChange={(value: Prospect["status"]) =>
                    setEditingProspect({ ...editingProspect, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="contacted">Contactado</SelectItem>
                    <SelectItem value="waiting_response">
                      Esperando Respuesta
                    </SelectItem>
                    <SelectItem value="waiting_info">Esperando Info</SelectItem>
                    <SelectItem value="trial_scheduled">
                      Coordinamos clase de prueba
                    </SelectItem>
                    <SelectItem value="trial_completed">
                      Ya hizo clase de prueba
                    </SelectItem>
                    <SelectItem value="not_interested">
                      No Interesado
                    </SelectItem>
                    <SelectItem value="contact_later">
                      Contactar Después
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-priority_level">Prioridad</Label>
                <Select
                  value={editingProspect.priority_level}
                  onValueChange={(value: "green" | "yellow" | "red") =>
                    setEditingProspect({
                      ...editingProspect,
                      priority_level: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Rojo (Alta)</SelectItem>
                    <SelectItem value="yellow">Amarillo (Media)</SelectItem>
                    <SelectItem value="green">Verde (Baja)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notas</Label>
                <Textarea
                  id="edit-notes"
                  value={editingProspect.notes || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      notes: e.target.value,
                    })
                  }
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" onClick={handleEditProspect}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Convert to Member Dialog */}
      {isClient && (
        <Dialog
          open={isConvertDialogOpen}
          onOpenChange={setIsConvertDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Convertir a Socio</DialogTitle>
              <DialogDescription>
                Convierte a {convertingProspect?.name} en un nuevo socio.
              </DialogDescription>
            </DialogHeader>
            {convertingProspect && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="convert-plan">Seleccionar Plan</Label>
                  <Select
                    value={conversionPlan}
                    onValueChange={setConversionPlan}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un plan para el nuevo socio" />
                    </SelectTrigger>
                    <SelectContent>
                      console.log("Planes disponibles", plans);
                      {(plans ?? [])
                        .filter((plan) => plan.is_active)
                        .map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} - ${plan.price.toLocaleString()} (
                            {plan.duration} {plan.duration_type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="convert-method">Método de Pago Inicial</Label>
                  <Select
                    value={conversionPaymentMethod}
                    onValueChange={setConversionPaymentMethod}
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
                <p className="text-sm text-muted-foreground">
                  Se creará un nuevo socio y un pago inicial, y el interesado
                  será eliminado.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleConvertProspectToMember}
                disabled={!conversionPlan || !conversionPaymentMethod}
              >
                Convertir a Socio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
