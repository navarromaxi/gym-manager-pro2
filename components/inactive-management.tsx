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
import { Search, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import type { Member, Payment } from "@/lib/supabase"

interface InactiveManagementProps {
  members: Member[]
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>
  payments: Payment[]
}

export function InactiveManagement({ members, setMembers, payments }: InactiveManagementProps) {
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false)
  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterLevel, setFilterLevel] = useState("all")

  const inactiveMembers = members.filter((m) => m.status === "inactive")

  const handleEditMember = async () => {
    if (!currentMember) return

    try {
      const { data, error } = await supabase
        .from("members")
        .update(currentMember)
        .eq("id", currentMember.id)
        .select()
        .single()
      if (error) throw error
      setMembers((prev) => prev.map((m) => (m.id === data.id ? data : m)))
      setIsEditMemberDialogOpen(false)
      setCurrentMember(null)
    } catch (error) {
      console.error("Error editing member:", error)
      alert("Error al editar socio inactivo. Inténtalo de nuevo.")
    }
  }

  const filteredInactiveMembers = inactiveMembers.filter((member) => {
    const matchesSearch = searchTerm
      ? member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone.includes(searchTerm)
      : true
    const matchesLevel = filterLevel === "all" ? true : member.inactive_level === filterLevel

    return matchesSearch && matchesLevel
  })

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
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Socios Inactivos</h2>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar socio inactivo por nombre, email o teléfono..."
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
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-[180px] sm:w-[160px]">
            <SelectValue placeholder="Filtrar por nivel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Niveles</SelectItem>
            <SelectItem value="green">Verde</SelectItem>
            <SelectItem value="yellow">Amarillo</SelectItem>
            <SelectItem value="red">Rojo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inactive Members Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Último Pago</TableHead>
              <TableHead>Nivel Inactivo</TableHead>
              <TableHead>Comentario</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInactiveMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No se encontraron socios inactivos.
                </TableCell>
              </TableRow>
            ) : (
              filteredInactiveMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>{member.plan}</TableCell>
                  <TableCell>
                    {member.last_payment ? format(parseISO(member.last_payment), "dd/MM/yyyy", { locale: es }) : "N/A"}
                  </TableCell>
                  <TableCell>
                    {member.inactive_level && (
                      <Badge variant={getInactiveLevelBadgeVariant(member.inactive_level)}>
                        {member.inactive_level}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{member.inactive_comment || "N/A"}</TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Inactive Member Dialog */}
      <Dialog open={isEditMemberDialogOpen} onOpenChange={setIsEditMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Socio Inactivo</DialogTitle>
          </DialogHeader>
          {currentMember && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Nombre
                </Label>
                <Input id="edit-name" value={currentMember.name} className="col-span-3" disabled />
              </div>
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
