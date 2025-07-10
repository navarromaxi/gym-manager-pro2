"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Search, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import type { Member, Payment, Plan } from "@/lib/supabase"

interface MemberManagementProps {
  members: Member[]
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>
  payments: Payment[]
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>
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
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false)
  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [newMember, setNewMember] = useState<Omit<Member, "id" | "gym_id">>({
    name: "",
    email: "",
    phone: "",
    join_date: format(new Date(), "yyyy-MM-dd"),
    plan: "",
    plan_price: 0,
    last_payment: format(new Date(), "yyyy-MM-dd"),
    next_payment: format(new Date(), "yyyy-MM-dd"),
    status: "active",
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState(initialFilter)

  useEffect(() => {
    setFilterStatus(initialFilter)
  }, [initialFilter])

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email || !newMember.plan) {
      alert("Por favor, completa todos los campos obligatorios.")
      return
    }

    const selectedPlan = plans.find((p) => p.name === newMember.plan)
    if (!selectedPlan) {
      alert("Plan seleccionado no válido.")
      return
    }

    const memberToAdd: Omit<Member, "id"> = {
      ...newMember,
      gym_id: gymId,
      plan_price: selectedPlan.price,
      join_date: newMember.join_date || format(new Date(), "yyyy-MM-dd"),
      last_payment: newMember.last_payment || format(new Date(), "yyyy-MM-dd"),
      next_payment: newMember.next_payment || format(new Date(), "yyyy-MM-dd"),
      status: "active", // Default status for new members
    }

    try {
      const { data, error } = await supabase.from("members").insert(memberToAdd).select().single()
      if (error) throw error
      setMembers((prev) => [...prev, data])
      setIsAddMemberDialogOpen(false)
      setNewMember({
        name: "",
        email: "",
        phone: "",
        join_date: format(new Date(), "yyyy-MM-dd"),
        plan: "",
        plan_price: 0,
        last_payment: format(new Date(), "yyyy-MM-dd"),
        next_payment: format(new Date(), "yyyy-MM-dd"),
        status: "active",
      })
    } catch (error) {
      console.error("Error adding member:", error)
      alert("Error al agregar socio. Inténtalo de nuevo.")
    }
  }

  const handleEditMember = async () => {
    if (!currentMember || !currentMember.name || !currentMember.email || !currentMember.plan) {
      alert("Por favor, completa todos los campos obligatorios.")
      return
    }

    const selectedPlan = plans.find((p) => p.name === currentMember.plan)
    if (!selectedPlan) {
      alert("Plan seleccionado no válido.")
      return
    }

    const memberToUpdate: Member = {
      ...currentMember,
      plan_price: selectedPlan.price,
    }

    try {
      const { data, error } = await supabase
        .from("members")
        .update(memberToUpdate)
        .eq("id", memberToUpdate.id)
        .select()
        .single()
      if (error) throw error
      setMembers((prev) => prev.map((m) => (m.id === data.id ? data : m)))
      setIsEditMemberDialogOpen(false)
      setCurrentMember(null)
    } catch (error) {
      console.error("Error editing member:", error)
      alert("Error al editar socio. Inténtalo de nuevo.")
    }
  }

  const handleDeleteMember = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este socio?")) return
    try {
      const { error } = await supabase.from("members").delete().eq("id", id)
      if (error) throw error
      setMembers((prev) => prev.filter((m) => m.id !== id))
    } catch (error) {
      console.error("Error deleting member:", error)
      alert("Error al eliminar socio. Inténtalo de nuevo.")
    }
  }

  const handleRegisterPayment = async (member: Member) => {
    const selectedPlan = plans.find((p) => p.name === member.plan)
    if (!selectedPlan) {
      alert("Plan del socio no encontrado.")
      return
    }

    const newPayment: Omit<Payment, "id"> = {
      gym_id: gymId,
      member_id: member.id,
      member_name: member.name,
      amount: selectedPlan.price,
      date: format(new Date(), "yyyy-MM-dd"),
      plan: member.plan,
      method: "Efectivo", // Default method, could be a dialog input
    }

    // Calculate next payment date based on plan duration
    const nextPaymentDate = parseISO(member.next_payment || member.last_payment || member.join_date)
    if (selectedPlan.duration_type === "months") {
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + selectedPlan.duration)
    } else if (selectedPlan.duration_type === "years") {
      nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + selectedPlan.duration)
    } else {
      nextPaymentDate.setDate(nextPaymentDate.getDate() + selectedPlan.duration)
    }

    const updatedMember: Member = {
      ...member,
      last_payment: newPayment.date,
      next_payment: format(nextPaymentDate, "yyyy-MM-dd"),
      status: "active",
    }

    try {
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert(newPayment)
        .select()
        .single()
      if (paymentError) throw paymentError

      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .update(updatedMember)
        .eq("id", updatedMember.id)
        .select()
        .single()
      if (memberError) throw memberError

      setPayments((prev) => [...prev, paymentData])
      setMembers((prev) => prev.map((m) => (m.id === memberData.id ? memberData : m)))
      alert(
        `Pago de $${newPayment.amount} registrado para ${member.name}. Próximo pago: ${format(nextPaymentDate, "dd/MM/yyyy")}`,
      )
    } catch (error) {
      console.error("Error registering payment:", error)
      alert("Error al registrar pago. Inténtalo de nuevo.")
    }
  }

  const filteredMembers = members.filter((member) => {
    const matchesSearch = searchTerm
      ? member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone.includes(searchTerm)
      : true
    const matchesStatus = filterStatus === "all" ? true : member.status === filterStatus

    return matchesSearch && matchesStatus
  })

  const getStatusBadgeVariant = (status: Member["status"]) => {
    switch (status) {
      case "active":
        return "default"
      case "expired":
        return "destructive"
      case "inactive":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getInactiveLevelBadgeVariant = (level?: Member["inactive_level"]) => {
    switch (level) {
      case "green":
        return "default" // Or a specific green variant
      case "yellow":
        return "warning" // Assuming a warning variant exists or can be defined
      case "red":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Socios</h2>
        <Button onClick={() => setIsAddMemberDialogOpen(true)}>Agregar Socio</Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar socio por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select
          value={filterStatus}
          onValueChange={(value) => {
            setFilterStatus(value as Member["status"] | "all")
            onFilterChange?.(value)
          }}
        >
          <SelectTrigger className="w-[180px] sm:w-[160px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="expired">Vencidos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Próximo Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Nivel Inactivo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No se encontraron socios.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>{member.plan}</TableCell>
                  <TableCell>
                    {member.next_payment ? format(parseISO(member.next_payment), "dd/MM/yyyy", { locale: es }) : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(member.status)}>{member.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {member.status === "inactive" && member.inactive_level && (
                      <Badge variant={getInactiveLevelBadgeVariant(member.inactive_level)}>
                        {member.inactive_level}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleRegisterPayment(member)}>
                        Registrar Pago
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentMember(member)
                          setIsEditMemberDialogOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteMember(member.id)}>
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Socio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Teléfono
              </Label>
              <Input
                id="phone"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="join_date" className="text-right">
                Fecha Ingreso
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !newMember.join_date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newMember.join_date ? (
                      format(parseISO(newMember.join_date), "dd/MM/yyyy", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseISO(newMember.join_date)}
                    onSelect={(date) => date && setNewMember({ ...newMember, join_date: format(date, "yyyy-MM-dd") })}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="plan" className="text-right">
                Plan
              </Label>
              <Select
                value={newMember.plan}
                onValueChange={(value) => {
                  const selectedPlan = plans.find((p) => p.name === value)
                  setNewMember({
                    ...newMember,
                    plan: value,
                    plan_price: selectedPlan ? selectedPlan.price : 0,
                  })
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name} (${plan.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="last_payment" className="text-right">
                Último Pago
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !newMember.last_payment && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newMember.last_payment ? (
                      format(parseISO(newMember.last_payment), "dd/MM/yyyy", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseISO(newMember.last_payment)}
                    onSelect={(date) =>
                      date && setNewMember({ ...newMember, last_payment: format(date, "yyyy-MM-dd") })
                    }
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="next_payment" className="text-right">
                Próximo Pago
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !newMember.next_payment && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newMember.next_payment ? (
                      format(parseISO(newMember.next_payment), "dd/MM/yyyy", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseISO(newMember.next_payment)}
                    onSelect={(date) =>
                      date && setNewMember({ ...newMember, next_payment: format(date, "yyyy-MM-dd") })
                    }
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddMember}>
              Guardar Socio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberDialogOpen} onOpenChange={setIsEditMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Socio</DialogTitle>
          </DialogHeader>
          {currentMember && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="edit-name"
                  value={currentMember.name}
                  onChange={(e) => setCurrentMember({ ...currentMember, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-email" className="text-right">
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={currentMember.email}
                  onChange={(e) => setCurrentMember({ ...currentMember, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-phone" className="text-right">
                  Teléfono
                </Label>
                <Input
                  id="edit-phone"
                  value={currentMember.phone}
                  onChange={(e) => setCurrentMember({ ...currentMember, phone: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-join_date" className="text-right">
                  Fecha Ingreso
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !currentMember.join_date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {currentMember.join_date ? (
                        format(parseISO(currentMember.join_date), "dd/MM/yyyy", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parseISO(currentMember.join_date)}
                      onSelect={(date) =>
                        date && setCurrentMember({ ...currentMember, join_date: format(date, "yyyy-MM-dd") })
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-plan" className="text-right">
                  Plan
                </Label>
                <Select
                  value={currentMember.plan}
                  onValueChange={(value) => {
                    const selectedPlan = plans.find((p) => p.name === value)
                    setCurrentMember({
                      ...currentMember,
                      plan: value,
                      plan_price: selectedPlan ? selectedPlan.price : 0,
                    })
                  }}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.name}>
                        {plan.name} (${plan.price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-last_payment" className="text-right">
                  Último Pago
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !currentMember.last_payment && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {currentMember.last_payment ? (
                        format(parseISO(currentMember.last_payment), "dd/MM/yyyy", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parseISO(currentMember.last_payment)}
                      onSelect={(date) =>
                        date && setCurrentMember({ ...currentMember, last_payment: format(date, "yyyy-MM-dd") })
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-next_payment" className="text-right">
                  Próximo Pago
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !currentMember.next_payment && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {currentMember.next_payment ? (
                        format(parseISO(currentMember.next_payment), "dd/MM/yyyy", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parseISO(currentMember.next_payment)}
                      onSelect={(date) =>
                        date && setCurrentMember({ ...currentMember, next_payment: format(date, "yyyy-MM-dd") })
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  Estado
                </Label>
                <Select
                  value={currentMember.status}
                  onValueChange={(value) => setCurrentMember({ ...currentMember, status: value as Member["status"] })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="expired">Vencido</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {currentMember.status === "inactive" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-inactive_level" className="text-right">
                      Nivel Inactivo
                    </Label>
                    <Select
                      value={currentMember.inactive_level || ""}
                      onValueChange={(value) =>
                        setCurrentMember({
                          ...currentMember,
                          inactive_level: value as Member["inactive_level"],
                        })
                      }
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecciona un nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">Verde</SelectItem>
                        <SelectItem value="yellow">Amarillo</SelectItem>
                        <SelectItem value="red">Rojo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-inactive_comment" className="text-right">
                      Comentario
                    </Label>
                    <Input
                      id="edit-inactive_comment"
                      value={currentMember.inactive_comment || ""}
                      onChange={(e) => setCurrentMember({ ...currentMember, inactive_comment: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                </>
              )}
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
