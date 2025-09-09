"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Search, DollarSign } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Member, Payment, Plan } from "@/lib/supabase";

interface PaymentManagementProps {
  payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  members: Member[];
  setMembers: (members: Member[]) => void;
  plans: Plan[];
  gymId: string;
}

export function PaymentManagement({
  payments = [],
  setPayments,
  members = [],
  setMembers,
  plans = [],
  gymId,
}: PaymentManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [newPayment, setNewPayment] = useState({
    memberId: "",
    planId: "",
    method: "",
    cardBrand: "",
    date: new Date().toLocaleDateString("en-CA"),
    type: "plan" as "plan" | "product",
    description: "",
    amount: 0,
  });
  const [methodFilter, setMethodFilter] = useState("all");

  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
  ];

  const cardBrands = [
    "Visa",
    "Mastercard",
    "American Express",
    "Otra",
  ];

  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Filtrar miembros para el buscador
  const filteredMembersForSearch = members.filter((member) =>
    member.name.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  // Función para obtener pagos filtrados actualizada
  const getFilteredPayments = () => {
    let filtered = (payments || []).filter((payment) =>
      payment.member_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filtro por método de pago
    if (methodFilter !== "all") {
      filtered = filtered.filter((payment) => payment.method === methodFilter);
    }

    if (periodFilter !== "all") {
      const currentDate = new Date();

      filtered = filtered.filter((payment) => {
        const paymentDate = parseLocalDate(payment.date);

        switch (periodFilter) {
          case "current_month":
            return (
              paymentDate.getMonth() === currentDate.getMonth() &&
              paymentDate.getFullYear() === currentDate.getFullYear()
            );
          case "previous_month":
            const previousMonth =
              currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
            const previousYear =
              currentDate.getMonth() === 0
                ? currentDate.getFullYear() - 1
                : currentDate.getFullYear();
            return (
              paymentDate.getMonth() === previousMonth &&
              paymentDate.getFullYear() === previousYear
            );
          case "last_6_months":
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return paymentDate >= sixMonthsAgo;
          case "current_year":
            return paymentDate.getFullYear() === currentDate.getFullYear();
          default:
            return true;
        }
      });
    }

    return filtered.sort(
      (a, b) =>
        parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
    );
  };

  const filteredPayments = getFilteredPayments();

  // FUNCIÓN ACTUALIZADA PARA REGISTRAR PAGO Y RENOVAR SOCIO
  const handleAddPayment = async () => {
    try {
      const selectedMember = members.find((m) => m.id === newPayment.memberId);
      if (!selectedMember) return;

       const paymentId = `${gymId}_payment_${Date.now()}`;

      if (newPayment.type === "plan") {
        const selectedPlan = plans.find((p) => p.id === newPayment.planId)
        if (!selectedPlan) return

        const payment: Payment = {
          id: paymentId,
          gym_id: gymId,
          member_id: newPayment.memberId,
          member_name: selectedMember.name,
          amount: selectedPlan.price,
          date: newPayment.date,
          plan: selectedPlan.name,
          method: newPayment.method,
          card_brand:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardBrand
              : undefined,
          type: "plan",
        }

        const { error: paymentError } = await supabase
          .from("payments")
          .insert([payment]);
        if (paymentError) throw paymentError;

        // Actualizar el socio con el nuevo plan
        const paymentDate = parseLocalDate(newPayment.date);
        const nextPayment = new Date(paymentDate);

        if (selectedPlan.duration_type === "days") {
          nextPayment.setDate(nextPayment.getDate() + selectedPlan.duration);
        } else if (selectedPlan.duration_type === "months") {
          nextPayment.setMonth(nextPayment.getMonth() + selectedPlan.duration);
        } else if (selectedPlan.duration_type === "years") {
          nextPayment.setFullYear(
            nextPayment.getFullYear() + selectedPlan.duration
          );
        }

        const { error: memberError } = await supabase
          .from("members")
          .update({
            plan: selectedPlan.name,
            plan_price: selectedPlan.price,
            last_payment: newPayment.date,
            next_payment: nextPayment.toISOString().split("T")[0],
            status: "active",
          })
          .eq("id", selectedMember.id);
        if (memberError) throw memberError;

        const updatedMember = {
          ...selectedMember,
          plan: selectedPlan.name,
          plan_price: selectedPlan.price,
          last_payment: newPayment.date,
          next_payment: nextPayment.toISOString().split("T")[0],
          status: "active" as const,
        };

        setPayments([...payments, payment]);
        setMembers(
          members.map((m) => (m.id === selectedMember.id ? updatedMember : m))
        );
      } else {
        const payment: Payment = {
          id: paymentId,
          gym_id: gymId,
          member_id: newPayment.memberId,
          member_name: selectedMember.name,
          amount: newPayment.amount,
          date: newPayment.date,
          method: newPayment.method,
           card_brand:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardBrand
              : undefined,
          type: "product",
          description: newPayment.description,
          plan: newPayment.description,
        };

        const { error: paymentError } = await supabase
          .from("payments")
          .insert([payment]);
        if (paymentError) throw paymentError;

        setPayments([...payments, payment]);
      }

      // Limpiar formulario
      setNewPayment({
        memberId: "",
        planId: "",
        method: "",
        cardBrand: "",
        date: new Date().toLocaleDateString("en-CA"),
        type: "plan",
        description: "",
        amount: 0,
      });
      setMemberSearchTerm("");
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error registrando pago:", error);
      alert("Error al registrar el pago. Inténtalo de nuevo.");
    }
  };

  const totalPayments = filteredPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
  const currentMonthPayments = payments.filter((payment) => {
    const paymentDate = parseLocalDate(payment.date);
    const currentDate = new Date();
    return (
      paymentDate.getMonth() === currentDate.getMonth() &&
      paymentDate.getFullYear() === currentDate.getFullYear()
    );
  });

  // Calcular estadísticas por método de pago del mes actual
  const currentMonthPaymentsByMethod = currentMonthPayments.reduce(
    (acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthlyTotal = currentMonthPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Pagos
          </h2>
          <p className="text-muted-foreground">
            Registra pagos y renueva planes de socios existentes
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Registrar Pago de Socio</DialogTitle>
              <DialogDescription>
                Registra el pago de un socio existente. Si es un plan, se
                renovará automáticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto">
              {/* BUSCADOR DE SOCIOS */}
              <div className="grid gap-2">
                <Label htmlFor="member-search">Buscar Socio</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="member-search"
                    placeholder="Buscar por nombre..."
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {memberSearchTerm && (
                  <div className="max-h-32 overflow-y-auto border rounded-md">
                    {filteredMembersForSearch.length > 0 ? (
                      filteredMembersForSearch.map((member) => (
                        <div
                          key={member.id}
                          className={`p-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                            newPayment.memberId === member.id
                              ? "bg-blue-50"
                              : ""
                          }`}
                          onClick={() => {
                            setNewPayment({
                              ...newPayment,
                              memberId: member.id,
                            });
                            setMemberSearchTerm(member.name);
                          }}
                        >
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Plan actual: {member.plan} - Estado: {member.status}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">
                        No se encontraron socios
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TIPO DE PAGO */}
              <div className="grid gap-2">
                <Label htmlFor="plan">Nuevo Plan</Label>
                <Label htmlFor="type">Tipo de Pago</Label>
                <Select
                  value={newPayment.type}
                  onValueChange={(value) =>
                    setNewPayment({
                      ...newPayment,
                      type: value as "plan" | "product",
                      planId: "",
                      description: "",
                      amount: 0,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plan">Plan</SelectItem>
                    <SelectItem value="product">Producto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SELECCIÓN DE PLAN */}
              {newPayment.type === "plan" && (
                <div className="grid gap-2">
                  <Label htmlFor="plan">Nuevo Plan</Label>
                  <Select
                    value={newPayment.planId}
                    onValueChange={(value) =>
                      setNewPayment({ ...newPayment, planId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el plan a renovar" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans
                        .filter((plan) => plan.is_active)
                        .map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} - ${plan.price.toLocaleString()}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* CAMPOS DE PRODUCTO */}
              {newPayment.type === "product" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Input
                      id="description"
                      value={newPayment.description}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Monto</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={newPayment.amount}
                      onChange={(e) =>
                        setNewPayment({
                      ...newPayment,
                      method: value,
                      cardBrand: "",
                    })
                      }
                    />
                  </div>
                </>
              )}

              {/* MÉTODO DE PAGO */}
              <div className="grid gap-2">
                <Label htmlFor="method">Método de Pago</Label>
                <Select
                  value={newPayment.method}
                  onValueChange={(value) =>
                    setNewPayment({ ...newPayment, method: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método" />
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

               {newPayment.method === "Tarjeta de Crédito" && (
                <div className="grid gap-2">
                  <Label htmlFor="cardBrand">Tipo de Tarjeta</Label>
                  <Select
                    value={newPayment.cardBrand}
                    onValueChange={(value) =>
                      setNewPayment({ ...newPayment, cardBrand: value })
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
              )}

              {/* FECHA */}
              <div className="grid gap-2">
                <Label htmlFor="date">Fecha del Pago</Label>
                <Input
                  id="date"
                  type="date"
                  value={newPayment.date}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, date: e.target.value })
                  }
                />
              </div>

              {/* RESUMEN */}
              {newPayment.type === "plan" &&
                newPayment.memberId &&
                newPayment.planId && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">
                      Resumen de Renovación
                    </h4>
                    <div className="text-sm text-green-700">
                      <p>
                        <strong>Socio:</strong>{" "}
                        {
                          members.find((m) => m.id === newPayment.memberId)
                            ?.name
                        }
                      </p>
                      <p>
                        <strong>Plan:</strong>{" "}
                        {plans.find((p) => p.id === newPayment.planId)?.name}
                      </p>
                      <p>
                        <strong>Monto:</strong> $
                        {plans
                          .find((p) => p.id === newPayment.planId)
                          ?.price.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs">
                        ✅ El socio se activará y se actualizará su próximo
                        vencimiento
                      </p>
                    </div>
                  </div>
                )}
              {newPayment.type === "product" &&
                newPayment.memberId &&
                newPayment.description &&
                newPayment.amount > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">
                      Resumen de Venta
                    </h4>
                    <div className="text-sm text-green-700">
                      <p>
                        <strong>Socio:</strong>{" "}
                        {
                          members.find((m) => m.id === newPayment.memberId)
                            ?.name
                        }
                      </p>
                      <p>
                        <strong>Descripción:</strong> {newPayment.description}
                      </p>
                      <p>
                        <strong>Monto:</strong> $
                        {newPayment.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddPayment}
                disabled={
                  !newPayment.memberId ||
                  !newPayment.method ||
                   (newPayment.method === "Tarjeta de Crédito" &&
                    !newPayment.cardBrand) ||
                  (newPayment.type === "plan"
                    ? !newPayment.planId
                    : !newPayment.description || !newPayment.amount)
                }
              >
                Registrar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards - AGREGAR TARJETAS DE MÉTODOS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pagos (Filtrado)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPayments.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredPayments.length} pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mes Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonthPayments.length} pagos este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Efectivo (Mes)
            </CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currentMonthPaymentsByMethod["Efectivo"] || 0}
            </div>
            <p className="text-xs text-muted-foreground">pagos en efectivo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Débito (Mes)</CardTitle>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {currentMonthPaymentsByMethod["Tarjeta de Débito"] || 0}
            </div>
            <p className="text-xs text-muted-foreground">pagos con débito</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crédito (Mes)</CardTitle>
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {currentMonthPaymentsByMethod["Tarjeta de Crédito"] || 0}
            </div>
            <p className="text-xs text-muted-foreground">pagos con crédito</p>
          </CardContent>
        </Card>
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
                  placeholder="Buscar por nombre del socio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
                <SelectItem value="Efectivo">Efectivo</SelectItem>
                <SelectItem value="Transferencia">Transferencia</SelectItem>
                <SelectItem value="Tarjeta de Débito">
                  Tarjeta de Débito
                </SelectItem>
                <SelectItem value="Tarjeta de Crédito">
                  Tarjeta de Crédito
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los períodos</SelectItem>
                <SelectItem value="current_month">Mes actual</SelectItem>
                <SelectItem value="previous_month">Mes anterior</SelectItem>
                <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
                <SelectItem value="current_year">Año actual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {parseLocalDate(payment.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {payment.member_name}
                  </TableCell>
                  <TableCell>
                   {payment.type === "plan" ? payment.plan : payment.description}
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    ${payment.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {payment.method}
                    {payment.card_brand ? ` - ${payment.card_brand}` : ""}
                  </TableCell>
                  <TableCell className="capitalize">{payment.type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
