"use client"
import type React from "react"
import { useState } from "react"
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
import type { Prospect, Member, Payment } from "@/lib/supabase"

interface ProspectManagementProps {
  prospects: Prospect[]
  setProspects: React.Dispatch<React.SetStateAction<Prospect[]>>
  members: Member[]
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>
  payments: Payment[]
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>
  gymId: string
}

export function ProspectManagement({
  prospects,
  setProspects,
  members,
  setMembers,
  payments,
  setPayments,
  gymId,
}: ProspectManagementProps) {
  const [isAddProspectDialogOpen, setIsAddProspectDialogOpen] = useState(false)
  const [isEditProspectDialogOpen, setIsEditProspectDialogOpen] = useState(false)
  const [currentProspect, setCurrentProspect] = useState<Prospect | null>(null)
  const [newProspect, setNewProspect] = useState<Omit<Prospect, "id" | "gym_id">>({
    name: "",
    email: "",
    phone: "",
    contact_date: format(new Date(), "yyyy-MM-dd"),
    interest: "",
    status: "new",
    notes: "",
    prospect_level: "yellow", // Default level for new prospects
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterLevel, setFilterLevel] = useState("all")

  const handleAddProspect = async () => {
    if (!newProspect.name || !newProspect.email || !newProspect.contact_date) {
      alert("Por favor, completa todos los campos obligatorios.")
      return
    }

    const prospectToAdd: Omit<Prospect, "id"> = {
      ...newProspect,
      gym_id: gymId,
    }

    try {
      const { data, error } = await supabase.from("prospects").insert(prospectToAdd).select().single()
      if (error) throw error
      setProspects((prev) => [...prev, data])
      setIsAddProspectDialogOpen(false)
      setNewProspect({
        name: "",
        email: "",
        phone: "",
        contact_date: format(new Date(), "yyyy-MM-dd"),
        interest: "",
        status: "new",
        notes: "",
        prospect_level: "yellow",
      })
    } catch (error) {
      console.error("Error adding prospect:", error)
      alert("Error al agregar interesado. Inténtalo de nuevo.")
    }
  }

  const handleEditProspect = async () => {
    if (!currentProspect || !currentProspect.name || !currentProspect.email || !currentProspect.contact_date) {
      alert("Por favor, completa todos los campos obligatorios.")
      return
    }

    try {
      const { data, error } = await supabase
        .from("prospects")
        .update(currentProspect)
        .eq("id", currentProspect.id)
        .select()
        .single()
      if (error) throw error
      setProspects((prev) => prev.map((p) => (p.id === data.id ? data : p)))
      setIsEditProspectDialogOpen(false)
      setCurrentProspect(null)
    } catch (error) {
      console.error("Error editing prospect:", error)
      alert("Error al editar interesado. Inténtalo de nuevo.")
    }
  }

  const handleDeleteProspect = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este interesado?")) return
    try {
      const { error } = await supabase.from("prospects").delete().eq("id", id)
      if (error) throw error
      setProspects((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error("Error deleting prospect:", error)
      alert("Error al eliminar interesado. Inténtalo de nuevo.")
    }
  }

  const handleConvertProspectToMember = async (prospect: Prospect) => {
    if (!confirm(`¿Estás seguro de que quieres convertir a ${prospect.name} en socio?`)) return

    // Simulate adding a default plan for the new member
    const defaultPlanName = "Mensual" // Or prompt user to select a plan
    const defaultPlanPrice = 2500 // Or fetch from plans table

    const newMember: Omit<Member, "id"> = {
      gym_id: gymId,
      name: prospect.name,
      email: prospect.email,
      phone: prospect.phone,
      join_date: format(new Date(), "yyyy-MM-dd"),
      plan: defaultPlanName,
      plan_price: defaultPlanPrice,
      last_payment: format(new Date(), "yyyy-MM-dd"),
      next_payment: format(new Date().setMonth(new Date().getMonth() + 1), "yyyy-MM-dd"),
      status: "active",
    }

    try {
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .insert(newMember)
        .select()
        .single()
      if (memberError) throw memberError

      // Optionally, register an initial payment for the new member
      const initialPayment: Omit<Payment, "id"> = {
        gym_id: gymId,
        member_id: memberData.id,
        member_name: memberData.name,
        amount: memberData.plan_price,
        date: format(new Date(), "yyyy-MM-dd"),
        plan: memberData.plan,
        method: "Efectivo",
      }
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert(initialPayment)
        .select()
        .single()
      if (paymentError) console.error("Error registering initial payment for new member:", paymentError)
      else setPayments((prev) => [...prev, paymentData])

      // Delete prospect after conversion
      const { error: deleteError } = await supabase.from("prospects").delete().eq("id", prospect.id)
      if (deleteError) console.error("Error deleting prospect after conversion:", deleteError)

      setMembers((prev) => [...prev, memberData])
      setProspects((prev) => prev.filter((p) => p.id !== prospect.id))
      alert(`${prospect.name} ha sido convertido a socio exitosamente!`)
    } catch (error) {
      console.error("Error converting prospect to member:", error)
      alert("Error al convertir interesado a socio. Inténtalo de nuevo.")
    }
  }

  const handleUpdateProspectStatus = async (prospect: Prospect, newStatus: Prospect["status"]) => {
    try {
      const { data, error } = await supabase
        .from("prospects")
        .update({ status: newStatus })
        .eq("id", prospect.id)
        .select()
        .single()
      if (error) throw error
      setProspects((prev) => prev.map((p) => (p.id === data.id ? data : p)))
    } catch (error) {
      console.error("Error updating prospect status:", error)
      alert("Error al actualizar estado del interesado. Inténtalo de nuevo.")
    }
  }

  const handleUpdateProspectLevel = async (prospect: Prospect, newLevel: Prospect["prospect_level"]) => {
    try {
      const { data, error } = await supabase
        .from("prospects")
        .update({ prospect_level: newLevel })
        .eq("id", prospect.id)
        .select()
        .single()
      if (error) throw error
      setProspects((prev) => prev.map((p) => (p.id === data.id ? data : p)))
    } catch (error) {
      console.error("Error updating prospect level:", error)
      alert("Error al actualizar nivel del interesado. Inténtalo de nuevo.")
    }
  }

  const filteredProspects = prospects.filter((prospect) => {
    const matchesSearch = searchTerm
      ? prospect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prospect.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prospect.phone.includes(searchTerm) ||
        prospect.interest.toLowerCase().includes(searchTerm.toLowerCase())
      : true
    const matchesStatus = filterStatus === "all" ? true : prospect.status === filterStatus
    const matchesLevel = filterLevel === "all" ? true : prospect.prospect_level === filterLevel

    return matchesSearch && matchesStatus && matchesLevel
  })

  const getStatusBadgeVariant = (status: Prospect["status"]) => {
    switch (status) {
      case "new":
        return "default"
      case "contacted":
        return "outline"
      case "waiting_response":
        return "secondary"
      case "waiting_info":
        return "secondary"
      case "not_interested":
        return "destructive"
      case "contact_later":
        return "warning"
      default:
        return "outline"
    }
  }

  const getLevelBadgeVariant = (level?: Prospect["prospect_level"]) => {
    switch (level) {
      case "green":
        return "default"
      case "yellow":
        return "warning"
      case "red":
        return "destructive"
      default:
        return "outline"
    }
  }

  const hotProspects = prospects.filter((p) => p.prospect_level === "green").length
  const warmProspects = prospects.filter((p) => p.prospect_level === "yellow").length
  const coldProspects = prospects.filter((p) => p.prospect_level === "red").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Interesados</h2>
        <Button onClick={() => setIsAddProspectDialogOpen(true)}>Agregar Interesado</Button>
      </div>

      {/* Prospect Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded-lg shadow-sm bg-green-50">
          <h3 className="text-lg font-semibold text-green-800">Interesados Calientes</h3>
          <p className="text-2xl font-bold text-green-600">{hotProspects}</p>
        </div>
        <div className="p-4 border rounded-lg shadow-sm bg-yellow-50">
          <h3 className="text-lg font-semibold text-yellow-800">Interesados Tibios</h3>
          <p className="text-2xl font-bold text-yellow-600">{warmProspects}</p>
        </div>
        <div className="p-4 border rounded-lg shadow-sm bg-red-50">
          <h3 className="text-lg font-semibold text-red-800">Interesados Fríos</h3>
          <p className="text-2xl font-bold text-red-600">{coldProspects}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar interesado por nombre, email, teléfono o interés..."
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] sm:w-[160px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Estados</SelectItem>
            <SelectItem value="new">Nuevo</SelectItem>
            <SelectItem value="contacted">Contactado</SelectItem>
            <SelectItem value="waiting_response">Esperando Respuesta</SelectItem>
            <SelectItem value="waiting_info">Esperando Info</SelectItem>
            <SelectItem value="not_interested">No Interesado</SelectItem>
            <SelectItem value="contact_later">Contactar Después</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-[180px] sm:w-[160px]">
            <SelectValue placeholder="Filtrar por clasificación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Clasificaciones</SelectItem>
            <SelectItem value="green">Caliente</SelectItem>
            <SelectItem value="yellow">Tibio</SelectItem>
            <SelectItem value="red">Frío</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prospects Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Fecha Contacto</TableHead>
              <TableHead>Interés</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProspects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No se encontraron interesados.
                </TableCell>
              </TableRow>
            ) : (
              filteredProspects.map((prospect) => (
                <TableRow key={prospect.id}>
                  <TableCell className="font-medium">{prospect.name}</TableCell>
                  <TableCell>{prospect.email}</TableCell>
                  <TableCell>{prospect.phone}</TableCell>
                  <TableCell>{format(parseISO(prospect.contact_date), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell>{prospect.interest}</TableCell>
                  <TableCell>
                    <Select
                      value={prospect.status}
                      onValueChange={(value) => handleUpdateProspectStatus(prospect, value as Prospect["status"])}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue>
                          <Badge variant={getStatusBadgeVariant(prospect.status)}>{prospect.status}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Nuevo</SelectItem>
                        <SelectItem value="contacted">Contactado</SelectItem>
                        <SelectItem value="waiting_response">Esperando Respuesta</SelectItem>
                        <SelectItem value="waiting_info">Esperando Info</SelectItem>
                        <SelectItem value="not_interested">No Interesado</SelectItem>
                        <SelectItem value="contact_later">Contactar Después</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={prospect.prospect_level || "yellow"} // Default to yellow if null
                      onValueChange={(value) =>
                        handleUpdateProspectLevel(prospect, value as Prospect["prospect_level"])
                      }
                    >
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue>
                          <Badge variant={getLevelBadgeVariant(prospect.prospect_level)}>
                            {prospect.prospect_level || "yellow"}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">Caliente</SelectItem>
                        <SelectItem value="yellow">Tibio</SelectItem>
                        <SelectItem value="red">Frío</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleConvertProspectToMember(prospect)}>
                        Convertir a Socio
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentProspect(prospect)
                          setIsEditProspectDialogOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteProspect(prospect.id)}>
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

      {/* Add Prospect Dialog */}
      <Dialog open={isAddProspectDialogOpen} onOpenChange={setIsAddProspectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Interesado</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={newProspect.name}
                onChange={(e) => setNewProspect({ ...newProspect, name: e.target.value })}
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
                value={newProspect.email}
                onChange={(e) => setNewProspect({ ...newProspect, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Teléfono
              </Label>
              <Input
                id="phone"
                value={newProspect.phone}
                onChange={(e) => setNewProspect({ ...newProspect, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact_date" className="text-right">
                Fecha Contacto
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !newProspect.contact_date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newProspect.contact_date ? (
                      format(parseISO(newProspect.contact_date), "dd/MM/yyyy", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseISO(newProspect.contact_date)}
                    onSelect={(date) =>
                      date && setNewProspect({ ...newProspect, contact_date: format(date, "yyyy-MM-dd") })
                    }
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="interest" className="text-right">
                Interés
              </Label>
              <Input
                id="interest"
                value={newProspect.interest}
                onChange={(e) => setNewProspect({ ...newProspect, interest: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Estado
              </Label>
              <Select
                value={newProspect.status}
                onValueChange={(value) => setNewProspect({ ...newProspect, status: value as Prospect["status"] })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Nuevo</SelectItem>
                  <SelectItem value="contacted">Contactado</SelectItem>
                  <SelectItem value="waiting_response">Esperando Respuesta</SelectItem>
                  <SelectItem value="waiting_info">Esperando Info</SelectItem>
                  <SelectItem value="not_interested">No Interesado</SelectItem>
                  <SelectItem value="contact_later">Contactar Después</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="prospect_level" className="text-right">
                Clasificación
              </Label>
              <Select
                value={newProspect.prospect_level || "yellow"}
                onValueChange={(value) =>
                  setNewProspect({ ...newProspect, prospect_level: value as Prospect["prospect_level"] })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona una clasificación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Caliente</SelectItem>
                  <SelectItem value="yellow">Tibio</SelectItem>
                  <SelectItem value="red">Frío</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notas
              </Label>
              <Input
                id="notes"
                value={newProspect.notes}
                onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddProspect}>
              Guardar Interesado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Prospect Dialog */}
      <Dialog open={isEditProspectDialogOpen} onOpenChange={setIsEditProspectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Interesado</DialogTitle>
          </DialogHeader>
          {currentProspect && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="edit-name"
                  value={currentProspect.name}
                  onChange={(e) => setCurrentProspect({ ...currentProspect, name: e.target.value })}
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
                  value={currentProspect.email}
                  onChange={(e) => setCurrentProspect({ ...currentProspect, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-phone" className="text-right">
                  Teléfono
                </Label>
                <Input
                  id="edit-phone"
                  value={currentProspect.phone}
                  onChange={(e) => setCurrentProspect({ ...currentProspect, phone: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-contact_date" className="text-right">
                  Fecha Contacto
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !currentProspect.contact_date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {currentProspect.contact_date ? (
                        format(parseISO(currentProspect.contact_date), "dd/MM/yyyy", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parseISO(currentProspect.contact_date)}
                      onSelect={(date) =>
                        date && setCurrentProspect({ ...currentProspect, contact_date: format(date, "yyyy-MM-dd") })
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-interest" className="text-right">
                  Interés
                </Label>
                <Input
                  id="edit-interest"
                  value={currentProspect.interest}
                  onChange={(e) => setCurrentProspect({ ...currentProspect, interest: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  Estado
                </Label>
                <Select
                  value={currentProspect.status}
                  onValueChange={(value) =>
                    setCurrentProspect({ ...currentProspect, status: value as Prospect["status"] })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="contacted">Contactado</SelectItem>
                    <SelectItem value="waiting_response">Esperando Respuesta</SelectItem>
                    <SelectItem value="waiting_info">Esperando Info</SelectItem>
                    <SelectItem value="not_interested">No Interesado</SelectItem>
                    <SelectItem value="contact_later">Contactar Después</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-prospect_level" className="text-right">
                  Clasificación
                </Label>
                <Select
                  value={currentProspect.prospect_level || "yellow"}
                  onValueChange={(value) =>
                    setCurrentProspect({ ...currentProspect, prospect_level: value as Prospect["prospect_level"] })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona una clasificación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Caliente</SelectItem>
                    <SelectItem value="yellow">Tibio</SelectItem>
                    <SelectItem value="red">Frío</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-notes" className="text-right">
                  Notas
                </Label>
                <Input
                  id="edit-notes"
                  value={currentProspect.notes}
                  onChange={(e) => setCurrentProspect({ ...currentProspect, notes: e.target.value })}
                  className="col-span-3"
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
    </div>
  )
}
