"use client";

import { useState } from "react";
import { supabase, Member, CustomPlan, Payment } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus, Trash2, Search } from "lucide-react";

interface CustomPlanManagementProps {
  customPlans: CustomPlan[];
  setCustomPlans: (plans: CustomPlan[]) => void;
  members: Member[];
   payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  gymId: string;
}

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
  const [newPlan, setNewPlan] = useState({
    member_id: "",
    name: "",
    description: "",
    price: 0,
    end_date: "",
    payment_date: new Date().toLocaleDateString("en-CA"),
    payment_method: "",
  });

  const filteredPlans = customPlans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.member_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

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
      end_date: newPlan.end_date,
      payment_date: newPlan.payment_date,
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
      plan: newPlan.name,
      method: newPlan.payment_method || "Efectivo",
      type: "custom",
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
      end_date: "",
      payment_date: new Date().toLocaleDateString("en-CA"),
      payment_method: "",
    });
    setMemberSearch("");
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
      <div className="flex justify-between items-center">
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
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <Select
                  value={newPlan.member_id}
                  onValueChange={(v) => setNewPlan({ ...newPlan, member_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar socio" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
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
                    setNewPlan({ ...newPlan, payment_method: v })
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

      <div className="flex justify-end">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar plan..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planes Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.member_name}</TableCell>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>${plan.price}</TableCell>
                  <TableCell>{plan.end_date}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePlan(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPlans.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No hay planes personalizados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}