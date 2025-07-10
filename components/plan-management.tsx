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
import { supabase } from "@/lib/supabase"
import type { Plan, Activity } from "@/lib/supabase"

interface PlanManagementProps {
  plans: Plan[]
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>
  activities: Activity[]
  gymId: string
}

export function PlanManagement({ plans, setPlans, activities, gymId }: PlanManagementProps) {
  const [isAddPlanDialogOpen, setIsAddPlanDialogOpen] = useState(false)
  const [isEditPlanDialogOpen, setIsEditPlanDialogOpen] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [newPlan, setNewPlan] = useState<Omit<Plan, "id" | "gym_id">>({
    name: "",
    description: "",
    price: 0,
    duration: 0,
    duration_type: "months",
    activities: [],
    is_active: true,
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [filterActive, setFilterActive] = useState("all")

  const handleAddPlan = async () => {
    if (!newPlan.name || newPlan.price <= 0 || newPlan.duration <= 0) {
      alert("Por favor, completa todos los campos obligatorios y asegúrate que precio y duración sean mayores a 0.")
      return
    }

    const planToAdd: Omit<Plan, "id"> = {
      ...newPlan,
      gym_id: gymId,
    }

    try {
      const { data, error } = await supabase.from("plans").insert(planToAdd).select().single()
      if (error) throw error
      setPlans((prev) => [...prev, data])
      setIsAddPlanDialogOpen(false)
      setNewPlan({
        name: "",
        description: "",
        price: 0,
        duration: 0,
        duration_type: "months",
        activities: [],
        is_active: true,
      })
    } catch (error) {
      console.error("Error adding plan:", error)
      alert("Error al agregar plan. Inténtalo de nuevo.")
    }
  }

  const handleEditPlan = async () => {
    if (!currentPlan || !currentPlan.name || currentPlan.price <= 0 || currentPlan.duration <= 0) {
      alert("Por favor, completa todos los campos obligatorios y asegúrate que precio y duración sean mayores a 0.")
      return
    }

    try {
      const { data, error } = await supabase
        .from("plans")
        .update(currentPlan)
        .eq("id", currentPlan.id)
        .select()
        .single()
      if (error) throw error
      setPlans((prev) => prev.map((p) => (p.id === data.id ? data : p)))
      setIsEditPlanDialogOpen(false)
      setCurrentPlan(null)
    } catch (error) {
      console.error("Error editing plan:", error)
      alert("Error al editar plan. Inténtalo de nuevo.")
    }
  }

  const handleDeletePlan = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este plan?")) return
    try {
      const { error } = await supabase.from("plans").delete().eq("id", id)
      if (error) throw error
      setPlans((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error("Error deleting plan:", error)
      alert("Error al eliminar plan. Inténtalo de nuevo.")
    }
  }

  const handleActivityToggle = (activityName: string, type: "new" | "edit") => {
    if (type === "new") {
      setNewPlan((prev) => {
        const updatedActivities = prev.activities.includes(activityName)
          ? prev.activities.filter((a) => a !== activityName)
          : [...prev.activities, activityName]
        return { ...prev, activities: updatedActivities }
      })
    } else if (type === "edit" && currentPlan) {
      setCurrentPlan((prev) => {
        if (!prev) return null
        const updatedActivities = prev.activities.includes(activityName)
          ? prev.activities.filter((a) => a !== activityName)
          : [...prev.activities, activityName]
        return { ...prev, activities: updatedActivities }
      })
    }
  }

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch = searchTerm
      ? plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.description.toLowerCase().includes(searchTerm.toLowerCase())
      : true
    const matchesActive = filterActive === "all" ? true : plan.is_active === (filterActive === "true")

    return matchesSearch && matchesActive
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Planes</h2>
        <Button onClick={() => setIsAddPlanDialogOpen(true)}>Agregar Plan</Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar plan por nombre o descripción..."
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
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[180px] sm:w-[160px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Plans Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Actividades</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron planes.
                </TableCell>
              </TableRow>
            ) : (
              filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{plan.description}</TableCell>
                  <TableCell>${plan.price.toLocaleString()}</TableCell>
                  <TableCell>
                    {plan.duration} {plan.duration_type}
                  </TableCell>
                  <TableCell>
                    {plan.activities && plan.activities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {plan.activities.map((activity, idx) => (
                          <Badge key={idx} variant="outline">
                            {activity}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPlan(plan)
                          setIsEditPlanDialogOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeletePlan(plan.id)}>
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

      {/* Add Plan Dialog */}
      <Dialog open={isAddPlanDialogOpen} onOpenChange={setIsAddPlanDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Plan</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Descripción
              </Label>
              <Input
                id="description"
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Precio
              </Label>
              <Input
                id="price"
                type="number"
                value={newPlan.price}
                onChange={(e) => setNewPlan({ ...newPlan, price: Number.parseFloat(e.target.value) || 0 })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="duration" className="text-right">
                Duración
              </Label>
              <Input
                id="duration"
                type="number"
                value={newPlan.duration}
                onChange={(e) => setNewPlan({ ...newPlan, duration: Number.parseInt(e.target.value) || 0 })}
                className="col-span-2"
              />
              <Select
                value={newPlan.duration_type}
                onValueChange={(value) => setNewPlan({ ...newPlan, duration_type: value as Plan["duration_type"] })}
              >
                <SelectTrigger className="col-span-1">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Días</SelectItem>
                  <SelectItem value="months">Meses</SelectItem>
                  <SelectItem value="years">Años</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right">
                Activo
              </Label>
              <Select
                value={newPlan.is_active ? "true" : "false"}
                onValueChange={(value) => setNewPlan({ ...newPlan, is_active: value === "true" })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Actividades</Label>
              <div className="col-span-3 flex flex-wrap gap-2">
                {activities.map((activity) => (
                  <Button
                    key={activity.id}
                    variant={newPlan.activities.includes(activity.name) ? "default" : "outline"}
                    onClick={() => handleActivityToggle(activity.name, "new")}
                    type="button"
                  >
                    {activity.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddPlan}>
              Guardar Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={isEditPlanDialogOpen} onOpenChange={setIsEditPlanDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Plan</DialogTitle>
          </DialogHeader>
          {currentPlan && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="edit-name"
                  value={currentPlan.name}
                  onChange={(e) => setCurrentPlan({ ...currentPlan, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Descripción
                </Label>
                <Input
                  id="edit-description"
                  value={currentPlan.description}
                  onChange={(e) => setCurrentPlan({ ...currentPlan, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-price" className="text-right">
                  Precio
                </Label>
                <Input
                  id="edit-price"
                  type="number"
                  value={currentPlan.price}
                  onChange={(e) => setCurrentPlan({ ...currentPlan, price: Number.parseFloat(e.target.value) || 0 })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-duration" className="text-right">
                  Duración
                </Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={currentPlan.duration}
                  onChange={(e) => setCurrentPlan({ ...currentPlan, duration: Number.parseInt(e.target.value) || 0 })}
                  className="col-span-2"
                />
                <Select
                  value={currentPlan.duration_type}
                  onValueChange={(value) =>
                    setCurrentPlan({ ...currentPlan, duration_type: value as Plan["duration_type"] })
                  }
                >
                  <SelectTrigger className="col-span-1">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Días</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                    <SelectItem value="years">Años</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-is_active" className="text-right">
                  Activo
                </Label>
                <Select
                  value={currentPlan.is_active ? "true" : "false"}
                  onValueChange={(value) => setCurrentPlan({ ...currentPlan, is_active: value === "true" })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Actividades</Label>
                <div className="col-span-3 flex flex-wrap gap-2">
                  {activities.map((activity) => (
                    <Button
                      key={activity.id}
                      variant={currentPlan.activities.includes(activity.name) ? "default" : "outline"}
                      onClick={() => handleActivityToggle(activity.name, "edit")}
                      type="button"
                    >
                      {activity.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleEditPlan}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
