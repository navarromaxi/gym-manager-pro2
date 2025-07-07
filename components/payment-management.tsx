"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, DollarSign } from "lucide-react"

interface Member {
  id: string
  name: string
  email: string
  phone: string
  joinDate: string
  plan: string
  planPrice: number
  lastPayment: string
  nextPayment: string
  status: "active" | "expired" | "inactive"
  inactiveLevel?: "green" | "yellow" | "red"
}

interface Payment {
  id: string
  memberId: string
  memberName: string
  amount: number
  date: string
  plan: string
  method: string
}

interface Plan {
  id: string
  name: string
  price: number
  duration: number
  durationType: "days" | "months" | "years"
  isActive: boolean
}

interface PaymentManagementProps {
  payments: Payment[]
  setPayments: (payments: Payment[]) => void
  members: Member[]
  setMembers: (members: Member[]) => void
  plans: Plan[]
  gymId: string
}

export function PaymentManagement({
  payments = [],
  setPayments,
  members = [],
  setMembers,
  plans = [],
  gymId,
}: PaymentManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [newPayment, setNewPayment] = useState({
    memberId: "",
    planId: "",
    method: "",
    date: new Date().toISOString().split("T")[0],
  })
  const [methodFilter, setMethodFilter] = useState("all")

  const paymentMethods = ["Efectivo", "Transferencia", "Tarjeta de Débito", "Tarjeta de Crédito"]

  // Filtrar miembros para el buscador
  const filteredMembersForSearch = members.filter((member) =>
    member.name.toLowerCase().includes(memberSearchTerm.toLowerCase()),
  )

  // Función para obtener pagos filtrados actualizada
  const getFilteredPayments = () => {
    let filtered = (payments || []).filter((payment) =>
      payment.memberName.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    // Filtro por método de pago
    if (methodFilter !== "all") {
      filtered = filtered.filter((payment) => payment.method === methodFilter)
    }

    if (periodFilter !== "all") {
      const currentDate = new Date()

      filtered = filtered.filter((payment) => {
        const paymentDate = new Date(payment.date)

        switch (periodFilter) {
          case "current_month":
            return (
              paymentDate.getMonth() === currentDate.getMonth() &&
              paymentDate.getFullYear() === currentDate.getFullYear()
            )
          case "previous_month":
            const previousMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1
            const previousYear =
              currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
            return paymentDate.getMonth() === previousMonth && paymentDate.getFullYear() === previousYear
          case "last_6_months":
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            return paymentDate >= sixMonthsAgo
          case "current_year":
            return paymentDate.getFullYear() === currentDate.getFullYear()
          default:
            return true
        }
      })
    }

    return filtered
  }

  const filteredPayments = getFilteredPayments()

  // FUNCIÓN ACTUALIZADA PARA REGISTRAR PAGO Y RENOVAR SOCIO
  const handleAddPayment = () => {
    const selectedMember = members.find((m) => m.id === newPayment.memberId)
    const selectedPlan = plans.find((p) => p.id === newPayment.planId)

    if (!selectedMember || !selectedPlan) return

    // Crear el pago
    const payment: Payment = {
      id: Date.now().toString(),
      memberId: newPayment.memberId,
      memberName: selectedMember.name,
      amount: selectedPlan.price,
      date: newPayment.date,
      plan: selectedPlan.name,
      method: newPayment.method,
    }

    // ACTUALIZAR EL SOCIO CON EL NUEVO PLAN
    const paymentDate = new Date(newPayment.date)
    const nextPayment = new Date(paymentDate)

    // Calcular próximo vencimiento según el plan
    if (selectedPlan.durationType === "days") {
      nextPayment.setDate(nextPayment.getDate() + selectedPlan.duration)
    } else if (selectedPlan.durationType === "months") {
      nextPayment.setMonth(nextPayment.getMonth() + selectedPlan.duration)
    } else if (selectedPlan.durationType === "years") {
      nextPayment.setFullYear(nextPayment.getFullYear() + selectedPlan.duration)
    }

    // Actualizar el socio
    const updatedMember = {
      ...selectedMember,
      plan: selectedPlan.name,
      planPrice: selectedPlan.price,
      lastPayment: newPayment.date,
      nextPayment: nextPayment.toISOString().split("T")[0],
      status: "active" as const, // Al pagar se vuelve activo
    }

    // Actualizar estados
    setPayments([...payments, payment])
    setMembers(members.map((m) => (m.id === selectedMember.id ? updatedMember : m)))

    // Limpiar formulario
    setNewPayment({
      memberId: "",
      planId: "",
      method: "",
      date: new Date().toISOString().split("T")[0],
    })
    setMemberSearchTerm("")
    setIsAddDialogOpen(false)
  }

  const totalPayments = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const currentMonthPayments = payments.filter((payment) => {
    const paymentDate = new Date(payment.date)
    const currentDate = new Date()
    return paymentDate.getMonth() === currentDate.getMonth() && paymentDate.getFullYear() === currentDate.getFullYear()
  })

  // Calcular estadísticas por método de pago del mes actual
  const currentMonthPaymentsByMethod = currentMonthPayments.reduce(
    (acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const monthlyTotal = currentMonthPayments.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Pagos</h2>
          <p className="text-muted-foreground">Registra pagos y renueva planes de socios existentes</p>
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
              <DialogDescription>Registra el pago de un socio existente y renueva su plan.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
                            newPayment.memberId === member.id ? "bg-blue-50" : ""
                          }`}
                          onClick={() => {
                            setNewPayment({ ...newPayment, memberId: member.id })
                            setMemberSearchTerm(member.name)
                          }}
                        >
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Plan actual: {member.plan} - Estado: {member.status}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">No se encontraron socios</div>
                    )}
                  </div>
                )}
              </div>

              {/* SELECCIÓN DE PLAN */}
              <div className="grid gap-2">
                <Label htmlFor="plan">Nuevo Plan</Label>
                <Select
                  value={newPayment.planId}
                  onValueChange={(value) => setNewPayment({ ...newPayment, planId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el plan a renovar" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans
                      .filter((plan) => plan.isActive)
                      .map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - ${plan.price.toLocaleString()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* MÉTODO DE PAGO */}
              <div className="grid gap-2">
                <Label htmlFor="method">Método de Pago</Label>
                <Select
                  value={newPayment.method}
                  onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
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

              {/* FECHA */}
              <div className="grid gap-2">
                <Label htmlFor="date">Fecha del Pago</Label>
                <Input
                  id="date"
                  type="date"
                  value={newPayment.date}
                  onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                />
              </div>

              {/* RESUMEN */}
              {newPayment.memberId && newPayment.planId && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Resumen de Renovación</h4>
                  <div className="text-sm text-green-700">
                    <p>
                      <strong>Socio:</strong> {members.find((m) => m.id === newPayment.memberId)?.name}
                    </p>
                    <p>
                      <strong>Plan:</strong> {plans.find((p) => p.id === newPayment.planId)?.name}
                    </p>
                    <p>
                      <strong>Monto:</strong> ${plans.find((p) => p.id === newPayment.planId)?.price.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs">✅ El socio se activará y se actualizará su próximo vencimiento</p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddPayment}
                disabled={!newPayment.memberId || !newPayment.planId || !newPayment.method}
              >
                Registrar Pago y Renovar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards - AGREGAR TARJETAS DE MÉTODOS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagos (Filtrado)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPayments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{filteredPayments.length} pagos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mes Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{currentMonthPayments.length} pagos este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efectivo (Mes)</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currentMonthPaymentsByMethod["Efectivo"] || 0}</div>
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
                <SelectItem value="Tarjeta de Débito">Tarjeta de Débito</SelectItem>
                <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
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
                <TableHead>Plan</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{payment.memberName}</TableCell>
                    <TableCell>{payment.plan}</TableCell>
                    <TableCell className="font-medium text-green-600">${payment.amount.toLocaleString()}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
