"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Plus, Edit, Trash2, Search } from "lucide-react"

interface Member {
  id: string
  gymId: string
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
  gymId: string
  memberId: string
  memberName: string
  amount: number
  date: string
  plan: string
  method: string
}

interface Plan {
  id: string
  gymId: string
  name: string
  price: number
  duration: number
  durationType: "days" | "months" | "years"
  isActive: boolean
}

interface MemberManagementProps {
  members: Member[]
  setMembers: (members: Member[]) => void
  payments: Payment[]
  setPayments: (payments: Payment[]) => void
  plans: Plan[]
  gymId: string
  initialFilter?: string
  onFilterChange?: (filter: string) => void
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState(initialFilter)
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    phone: "",
    plan: "",
    planPrice: 0,
    joinDate: new Date().toISOString().split("T")[0], // FECHA PERSONALIZABLE
    paymentMethod: "Efectivo", // NUEVO CAMPO
  })

  const paymentMethods = ["Efectivo", "Transferencia", "Tarjeta de Débito", "Tarjeta de Crédito"]

  useEffect(() => {
    setStatusFilter(initialFilter)
  }, [initialFilter])

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(statusFilter)
    }
  }, [statusFilter, onFilterChange])

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())

    let matchesStatus = true
    if (statusFilter === "expiring_soon") {
      const nextPayment = new Date(member.nextPayment)
      const today = new Date()
      const diffTime = nextPayment.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      matchesStatus = diffDays <= 10 && diffDays >= 0 && member.status === "active"
    } else {
      matchesStatus = statusFilter === "all" || member.status === statusFilter
    }

    return matchesSearch && matchesStatus
  })

  const handleAddMember = () => {
    // USAR LA FECHA PERSONALIZADA EN LUGAR DE HOY
    const joinDate = new Date(newMember.joinDate)
    const nextPayment = new Date(joinDate)
    const selectedPlan = plans.find((p) => p.name === newMember.plan)

    if (selectedPlan) {
      // Calculate next payment based on plan FROM JOIN DATE
      if (selectedPlan.durationType === "days") {
        nextPayment.setDate(nextPayment.getDate() + selectedPlan.duration)
      } else if (selectedPlan.durationType === "months") {
        nextPayment.setMonth(nextPayment.getMonth() + selectedPlan.duration)
      } else if (selectedPlan.durationType === "years") {
        nextPayment.setFullYear(nextPayment.getFullYear() + selectedPlan.duration)
      }
    }

    // CALCULAR EL ESTADO CORRECTO BASADO EN LA FECHA ACTUAL
    const today = new Date()
    const diffTime = today.getTime() - nextPayment.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let memberStatus: "active" | "expired" | "inactive" = "active"
    let inactiveLevel: "green" | "yellow" | "red" | undefined = undefined

    // Si el próximo pago es en el futuro, está activo
    if (nextPayment > today) {
      memberStatus = "active"
    } else if (diffDays > 0) {
      // Si está vencido
      if (diffDays > 30) {
        // Más de 30 días vencido = inactivo
        memberStatus = "inactive"
        inactiveLevel = "yellow"
      } else {
        // Entre 1 y 30 días vencido = expired
        memberStatus = "expired"
      }
    } else {
      // Si es exactamente hoy
      memberStatus = "expired"
    }

    const member: Member = {
      id: Date.now().toString(),
      gymId: gymId,
      name: newMember.name,
      email: newMember.email,
      phone: newMember.phone,
      plan: newMember.plan,
      planPrice: newMember.planPrice,
      joinDate: newMember.joinDate,
      lastPayment: newMember.joinDate,
      nextPayment: nextPayment.toISOString().split("T")[0],
      status: memberStatus, // USAR EL ESTADO CALCULADO
      inactiveLevel: inactiveLevel, // AGREGAR NIVEL SI ES INACTIVO
    }

    // Add initial payment ON JOIN DATE
    const payment: Payment = {
      id: Date.now().toString(),
      gymId: gymId,
      memberId: member.id,
      memberName: member.name,
      amount: member.planPrice,
      date: newMember.joinDate,
      plan: member.plan,
      method: newMember.paymentMethod,
    }

    setMembers([...members, member])
    setPayments([...payments, payment])
    setNewMember({
      name: "",
      email: "",
      phone: "",
      plan: "",
      planPrice: 0,
      joinDate: new Date().toISOString().split("T")[0],
      paymentMethod: "Efectivo",
    })
    setIsAddDialogOpen(false)
  }

  const handleEditMember = () => {
    if (!editingMember) return

    setMembers(members.map((m) => (m.id === editingMember.id ? editingMember : m)))
    setIsEditDialogOpen(false)
    setEditingMember(null)
  }

  const handleDeleteMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id))
    setPayments(payments.filter((p) => p.memberId !== id))
  }

  const getStatusBadge = (member: Member) => {
    switch (member.status) {
      case "active":
        return <Badge variant="default">Activo</Badge>
      case "expired":
        return <Badge variant="destructive">Vencido</Badge>
      case "inactive":
        const color =
          member.inactiveLevel === "green"
            ? "bg-green-500"
            : member.inactiveLevel === "yellow"
              ? "bg-yellow-500"
              : "bg-red-500"
        return <Badge className={`${color} text-white`}>Inactivo</Badge>
      default:
        return <Badge variant="secondary">Desconocido</Badge>
    }
  }

  const getDaysUntilExpiration = (nextPayment: string) => {
    const today = new Date()
    const expiration = new Date(nextPayment)
    const diffTime = expiration.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Socios</h2>
          <p className="text-muted-foreground">Administra los miembros del gimnasio</p>
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
              <DialogDescription>Completa los datos del nuevo miembro del gimnasio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="juan@email.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newMember.phone}
                  onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                  placeholder="099123456"
                />
              </div>
              {/* FECHA DE INGRESO PERSONALIZABLE */}
              <div className="grid gap-2">
                <Label htmlFor="joinDate">Fecha de Ingreso</Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={newMember.joinDate}
                  onChange={(e) => setNewMember({ ...newMember, joinDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  El plan se calculará desde esta fecha (útil si se registra con atraso)
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan">Plan</Label>
                <Select
                  value={newMember.plan}
                  onValueChange={(value) => {
                    const selectedPlan = plans.find((p) => p.name === value)
                    setNewMember({
                      ...newMember,
                      plan: value,
                      planPrice: selectedPlan?.price || 0,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans
                      .filter((plan) => plan.isActive)
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
                  onValueChange={(value) => setNewMember({ ...newMember, paymentMethod: value })}
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
                <SelectItem value="expired">Vencidos (hasta 30 días)</SelectItem>
                <SelectItem value="inactive">Inactivos (+30 días)</SelectItem>
                <SelectItem value="expiring_soon">Próximo a vencerse (10 días)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Socios ({filteredMembers.length})</CardTitle>
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
                const daysUntilExpiration = getDaysUntilExpiration(member.nextPayment)
                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {member.plan} - ${member.planPrice}
                    </TableCell>
                    <TableCell>{getStatusBadge(member)}</TableCell>
                    <TableCell>{new Date(member.nextPayment).toLocaleDateString()}</TableCell>
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
                          onClick={() => {
                            setEditingMember(member)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteMember(member.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
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
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingMember.email}
                  onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={editingMember.phone}
                  onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
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
  )
}
