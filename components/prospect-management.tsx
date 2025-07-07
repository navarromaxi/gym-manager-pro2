"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Plus, Edit, Trash2, Search, UserPlus, Phone, Mail, UserCheck } from "lucide-react"

interface Prospect {
  id: string
  name: string
  email: string
  phone: string
  contactDate: string
  interest: string
  status: "new" | "contacted" | "waiting_response" | "waiting_info" | "not_interested" | "contact_later"
  notes: string
}

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

interface ProspectManagementProps {
  prospects: Prospect[]
  setProspects: (prospects: Prospect[]) => void
  members?: Member[]
  setMembers?: (members: Member[]) => void
  payments?: Payment[]
  setPayments?: (payments: Payment[]) => void
}

export function ProspectManagement({
  prospects,
  setProspects,
  members = [],
  setMembers,
  payments = [],
  setPayments,
}: ProspectManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false)
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  const [convertingProspect, setConvertingProspect] = useState<Prospect | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [newProspect, setNewProspect] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "",
    notes: "",
  })
  const [conversionData, setConversionData] = useState({
    plan: "",
    planPrice: 0,
  })

  const interests = [
    "Plan Mensual",
    "Plan Trimestral",
    "Plan Semestral",
    "Plan Anual",
    "Clases Grupales",
    "Entrenamiento Personal",
    "Solo Consulta",
  ]

  const plans = [
    { name: "Mensual", price: 2500 },
    { name: "Trimestral", price: 6500 },
    { name: "Semestral", price: 12000 },
    { name: "Anual", price: 22000 },
  ]

  const filteredProspects = prospects.filter((prospect) => {
    const matchesSearch =
      prospect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prospect.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || prospect.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAddProspect = () => {
    const prospect: Prospect = {
      id: Date.now().toString(),
      ...newProspect,
      contactDate: new Date().toISOString().split("T")[0],
      status: "new",
    }

    setProspects([...prospects, prospect])
    setNewProspect({ name: "", email: "", phone: "", interest: "", notes: "" })
    setIsAddDialogOpen(false)
  }

  const handleEditProspect = () => {
    if (!editingProspect) return

    setProspects(prospects.map((p) => (p.id === editingProspect.id ? editingProspect : p)))
    setIsEditDialogOpen(false)
    setEditingProspect(null)
  }

  const handleDeleteProspect = (id: string) => {
    setProspects(prospects.filter((p) => p.id !== id))
  }

  const handleConvertToMember = () => {
    if (!convertingProspect || !setMembers || !setPayments) return

    const today = new Date()
    const nextPayment = new Date(today)

    // Calculate next payment based on plan
    switch (conversionData.plan) {
      case "Mensual":
        nextPayment.setMonth(nextPayment.getMonth() + 1)
        break
      case "Trimestral":
        nextPayment.setMonth(nextPayment.getMonth() + 3)
        break
      case "Semestral":
        nextPayment.setMonth(nextPayment.getMonth() + 6)
        break
      case "Anual":
        nextPayment.setFullYear(nextPayment.getFullYear() + 1)
        break
    }

    const newMember: Member = {
      id: Date.now().toString(),
      name: convertingProspect.name,
      email: convertingProspect.email,
      phone: convertingProspect.phone,
      joinDate: today.toISOString().split("T")[0],
      plan: conversionData.plan,
      planPrice: conversionData.planPrice,
      lastPayment: today.toISOString().split("T")[0],
      nextPayment: nextPayment.toISOString().split("T")[0],
      status: "active",
    }

    const newPayment: Payment = {
      id: Date.now().toString(),
      memberId: newMember.id,
      memberName: newMember.name,
      amount: newMember.planPrice,
      date: today.toISOString().split("T")[0],
      plan: newMember.plan,
      method: "Efectivo",
    }

    // Add to members and payments
    setMembers([...members, newMember])
    setPayments([...payments, newPayment])

    // Remove from prospects
    setProspects(prospects.filter((p) => p.id !== convertingProspect.id))

    // Reset state
    setConvertingProspect(null)
    setConversionData({ plan: "", planPrice: 0 })
    setIsConvertDialogOpen(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="default">Sin contactar</Badge>
      case "contacted":
        return <Badge className="bg-blue-500 text-white">Contactado</Badge>
      case "waiting_response":
        return <Badge className="bg-yellow-500 text-white">Esperando respuesta</Badge>
      case "waiting_info":
        return <Badge className="bg-orange-500 text-white">Espera información</Badge>
      case "not_interested":
        return <Badge variant="destructive">Ya no le interesa</Badge>
      case "contact_later":
        return <Badge className="bg-purple-500 text-white">Contactar más adelante</Badge>
      default:
        return <Badge variant="secondary">Desconocido</Badge>
    }
  }

  const statusCounts = {
    new: prospects.filter((p) => p.status === "new").length,
    contacted: prospects.filter((p) => p.status === "contacted").length,
    converted: members.filter((m) => m.status === "active").length, // Este se calculará desde los miembros convertidos
    lost: prospects.filter((p) => p.status === "not_interested").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Interesados</h2>
          <p className="text-muted-foreground">Administra las personas interesadas en el gimnasio</p>
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
              <DialogDescription>Registra una persona interesada en el gimnasio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  value={newProspect.name}
                  onChange={(e) => setNewProspect({ ...newProspect, name: e.target.value })}
                  placeholder="Ana López"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newProspect.email}
                  onChange={(e) => setNewProspect({ ...newProspect, email: e.target.value })}
                  placeholder="ana@email.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newProspect.phone}
                  onChange={(e) => setNewProspect({ ...newProspect, phone: e.target.value })}
                  placeholder="099456789"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interest">Interés</Label>
                <Select
                  value={newProspect.interest}
                  onValueChange={(value) => setNewProspect({ ...newProspect, interest: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="¿Qué le interesa?" />
                  </SelectTrigger>
                  <SelectContent>
                    {interests.map((interest) => (
                      <SelectItem key={interest} value={interest}>
                        {interest}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={newProspect.notes}
                  onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })}
                  placeholder="Comentarios adicionales..."
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.new}</div>
            <p className="text-xs text-muted-foreground">Por contactar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contactados</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.contacted}</div>
            <p className="text-xs text-muted-foreground">En seguimiento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statusCounts.converted}</div>
            <p className="text-xs text-muted-foreground">Se hicieron socios</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Conversión</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {prospects.length > 0 ? Math.round((statusCounts.converted / prospects.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Éxito en conversión</p>
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
                <SelectItem value="new">Sin contactar</SelectItem>
                <SelectItem value="contacted">Contactado</SelectItem>
                <SelectItem value="waiting_response">Esperando respuesta</SelectItem>
                <SelectItem value="waiting_info">Espera información</SelectItem>
                <SelectItem value="not_interested">Ya no le interesa</SelectItem>
                <SelectItem value="contact_later">Contactar más adelante</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Prospects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Interesados ({filteredProspects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Interés</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Contacto</TableHead>
                <TableHead>Comentarios</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects
                .sort((a, b) => new Date(b.contactDate).getTime() - new Date(a.contactDate).getTime())
                .map((prospect) => (
                  <TableRow key={prospect.id}>
                    <TableCell className="font-medium">{prospect.name}</TableCell>
                    <TableCell>{prospect.email}</TableCell>
                    <TableCell>{prospect.phone}</TableCell>
                    <TableCell>{prospect.interest}</TableCell>
                    <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                    <TableCell>{new Date(prospect.contactDate).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate">{prospect.notes}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingProspect(prospect)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 bg-transparent"
                          onClick={() => {
                            setConvertingProspect(prospect)
                            setIsConvertDialogOpen(true)
                          }}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteProspect(prospect.id)}>
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
            <DialogDescription>Modifica los datos del interesado.</DialogDescription>
          </DialogHeader>
          {editingProspect && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre completo</Label>
                <Input
                  id="edit-name"
                  value={editingProspect.name}
                  onChange={(e) => setEditingProspect({ ...editingProspect, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingProspect.email}
                  onChange={(e) => setEditingProspect({ ...editingProspect, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={editingProspect.phone}
                  onChange={(e) => setEditingProspect({ ...editingProspect, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Estado</Label>
                <Select
                  value={editingProspect.status}
                  onValueChange={(
                    value:
                      | "new"
                      | "contacted"
                      | "waiting_response"
                      | "waiting_info"
                      | "not_interested"
                      | "contact_later",
                  ) => setEditingProspect({ ...editingProspect, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Sin contactar</SelectItem>
                    <SelectItem value="contacted">Contactado</SelectItem>
                    <SelectItem value="waiting_response">Esperando respuesta</SelectItem>
                    <SelectItem value="waiting_info">Espera información</SelectItem>
                    <SelectItem value="not_interested">Ya no le interesa</SelectItem>
                    <SelectItem value="contact_later">Contactar más adelante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notas</Label>
                <Textarea
                  id="edit-notes"
                  value={editingProspect.notes}
                  onChange={(e) => setEditingProspect({ ...editingProspect, notes: e.target.value })}
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
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Convertir a Socio</DialogTitle>
            <DialogDescription>Convierte a {convertingProspect?.name} en socio del gimnasio.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Información del Interesado</Label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p>
                  <strong>Nombre:</strong> {convertingProspect?.name}
                </p>
                <p>
                  <strong>Email:</strong> {convertingProspect?.email}
                </p>
                <p>
                  <strong>Teléfono:</strong> {convertingProspect?.phone}
                </p>
                <p>
                  <strong>Interés:</strong> {convertingProspect?.interest}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="convert-plan">Plan a Asignar</Label>
              <Select
                value={conversionData.plan}
                onValueChange={(value) => {
                  const selectedPlan = plans.find((p) => p.name === value)
                  setConversionData({
                    plan: value,
                    planPrice: selectedPlan?.price || 0,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.name} value={plan.name}>
                      {plan.name} - ${plan.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {conversionData.plan && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  Se creará un socio activo con plan {conversionData.plan} por ${conversionData.planPrice}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConvertToMember}
              disabled={!conversionData.plan}
              className="bg-green-600 hover:bg-green-700"
            >
              Convertir a Socio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
