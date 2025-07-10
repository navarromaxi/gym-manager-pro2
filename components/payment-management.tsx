"use client"
import type React from "react"
import { useState } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Search, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import type { Payment, Member, Plan } from "@/lib/supabase"

interface PaymentManagementProps {
  payments: Payment[]
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>
  members: Member[]
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>
  plans: Plan[]
  gymId: string
}

export function PaymentManagement({
  payments,
  setPayments,
  members,
  setMembers,
  plans,
  gymId,
}: PaymentManagementProps) {
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false)
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false)
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(null)
  const [newPayment, setNewPayment] = useState<Omit<Payment, "id" | "gym_id">>({
    member_id: "",
    member_name: "",
    amount: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    plan: "",
    method: "Efectivo",
  })
  const [searchTerm, setSearchTerm] = useState("")

  const handleAddPayment = async () => {
    if (!newPayment.member_id || !newPayment.amount || !newPayment.date || !newPayment.plan) {
      alert("Por favor, completa todos los campos obligatorios.")
      return
    }

    const member = members.find((m) => m.id === newPayment.member_id)
    if (!member) {
      alert("Socio no encontrado.")
      return
    }

    const paymentToAdd: Omit<Payment, "id"> = {
      ...newPayment,
      gym_id: gymId,
      member_name: member.name, // Ensure member_name is set
    }

    // Calculate next payment date for the member
    const selectedPlan = plans.find((p) => p.name === newPayment.plan)
    const nextPaymentDate = parseISO(member.next_payment || member.last_payment || member.join_date)

    if (selectedPlan) {
      if (selectedPlan.duration_type === "months") {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + selectedPlan.duration)
      } else if (selectedPlan.duration_type === "years") {
        nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + selectedPlan.duration)
      } else {
        nextPaymentDate.setDate(nextPaymentDate.getDate() + selectedPlan.duration)
      }
    } else {
      // Fallback if plan not found, e.g., add 1 month
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1)
    }

    const updatedMember: Member = {
      ...member,
      last_payment: paymentToAdd.date,
      next_payment: format(nextPaymentDate, "yyyy-MM-dd"),
      status: "active", // Set member to active after payment
    }

    try {
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert(paymentToAdd)
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
      setIsAddPaymentDialogOpen(false)
      setNewPayment({
        member_id: "",
        member_name: "",
        amount: 0,
        date: format(new Date(), "yyyy-MM-dd"),
        plan: "",
        method: "Efectivo",
      })
    } catch (error) {
      console.error("Error adding payment:", error)
      alert("Error al agregar pago. Inténtalo de nuevo.")
    }
  }

  const handleEditPayment = async () => {
    if (!currentPayment || !currentPayment.member_id || !currentPayment.amount || !currentPayment.date) {
      alert("Por favor, completa todos los campos obligatorios.")
      return
    }

    try {
      const { data, error } = await supabase
        .from("payments")
        .update(currentPayment)
        .eq("id", currentPayment.id)
        .select()
        .single()
      if (error) throw error
      setPayments((prev) => prev.map((p) => (p.id === data.id ? data : p)))
      setIsEditPaymentDialogOpen(false)
      setCurrentPayment(null)
    } catch (error) {
      console.error("Error editing payment:", error)
      alert("Error al editar pago. Inténtalo de nuevo.")
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este pago?")) return
    try {
      const { error } = await supabase.from("payments").delete().eq("id", id)
      if (error) throw error
      setPayments((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error("Error deleting payment:", error)
      alert("Error al eliminar pago. Inténtalo de nuevo.")
    }
  }

  const filteredPayments = payments.filter((payment) =>
    searchTerm
      ? payment.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.plan.toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Pagos</h2>
        <Button onClick={() => setIsAddPaymentDialogOpen(true)}>Registrar Pago</Button>
      </div>

      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar pago por nombre de socio o plan..."
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

      {/* Payments Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Socio</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron pagos.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.member_name}</TableCell>
                  <TableCell>{payment.plan}</TableCell>
                  <TableCell>${payment.amount.toLocaleString()}</TableCell>
                  <TableCell>{format(parseISO(payment.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell>{payment.method}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPayment(payment)
                          setIsEditPaymentDialogOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeletePayment(payment.id)}>
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

      {/* Add Payment Dialog */}
      <Dialog open={isAddPaymentDialogOpen} onOpenChange={setIsAddPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Pago</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="member" className="text-right">
                Socio
              </Label>
              <Select
                value={newPayment.member_id}
                onValueChange={(value) => {
                  const selectedMember = members.find((m) => m.id === value)
                  const memberPlan = selectedMember ? plans.find((p) => p.name === selectedMember.plan) : null
                  setNewPayment({
                    ...newPayment,
                    member_id: value,
                    member_name: selectedMember ? selectedMember.name : "",
                    amount: memberPlan ? memberPlan.price : 0,
                    plan: selectedMember ? selectedMember.plan : "",
                  })
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona un socio" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.plan})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Monto
              </Label>
              <Input
                id="amount"
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: Number.parseFloat(e.target.value) })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="plan" className="text-right">
                Plan
              </Label>
              <Input
                id="plan"
                value={newPayment.plan}
                onChange={(e) => setNewPayment({ ...newPayment, plan: e.target.value })}
                className="col-span-3"
                disabled // Usually derived from member's current plan
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Fecha
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !newPayment.date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newPayment.date ? (
                      format(parseISO(newPayment.date), "dd/MM/yyyy", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseISO(newPayment.date)}
                    onSelect={(date) => date && setNewPayment({ ...newPayment, date: format(date, "yyyy-MM-dd") })}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="method" className="text-right">
                Método
              </Label>
              <Select
                value={newPayment.method}
                onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona un método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddPayment}>
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditPaymentDialogOpen} onOpenChange={setIsEditPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Pago</DialogTitle>
          </DialogHeader>
          {currentPayment && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-member" className="text-right">
                  Socio
                </Label>
                <Input
                  id="edit-member"
                  value={currentPayment.member_name}
                  className="col-span-3"
                  disabled // Member name should not be editable directly here
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-amount" className="text-right">
                  Monto
                </Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={currentPayment.amount}
                  onChange={(e) => setCurrentPayment({ ...currentPayment, amount: Number.parseFloat(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-plan" className="text-right">
                  Plan
                </Label>
                <Input
                  id="edit-plan"
                  value={currentPayment.plan}
                  onChange={(e) => setCurrentPayment({ ...currentPayment, plan: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-date" className="text-right">
                  Fecha
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !currentPayment.date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {currentPayment.date ? (
                        format(parseISO(currentPayment.date), "dd/MM/yyyy", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parseISO(currentPayment.date)}
                      onSelect={(date) =>
                        date && setCurrentPayment({ ...currentPayment, date: format(date, "yyyy-MM-dd") })
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-method" className="text-right">
                  Método
                </Label>
                <Select
                  value={currentPayment.method}
                  onValueChange={(value) => setCurrentPayment({ ...currentPayment, method: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleEditPayment}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
