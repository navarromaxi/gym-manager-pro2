"use client"

import { useState, useEffect } from "react"
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
import { Plus, Edit, Trash2, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plan, Activity } from "@/lib/supabase"

interface PlanManagementProps {
  gymId: string
  initialPlans: Plan[]
  activities: Activity[]
  onPlansUpdate: (plans: Plan[]) => void
}

export function PlanManagement({ gymId, initialPlans, activities, onPlansUpdate }: PlanManagementProps) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: 0,
    duration: 1,
    duration_type: "months" as "days" | "months" | "years",
    activities: [] as string[],
  })

  useEffect(() => {
    setPlans(initialPlans)
  }, [initialPlans])

  const availableActivities = activities.filter((activity) => activity.is_active).map((activity) => activity.name)

  const filteredPlans = plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleAddPlan = async () => {
    try {
      const planToAdd: Omit<Plan, "id"> = {
        gym_id: gymId,
        name: newPlan.name,
        description: newPlan.description,
        price: newPlan.price,
        duration: newPlan.duration,
        duration_type: newPlan.duration_type,
        activities: newPlan.activities,
        is_active: true,
      }

      const { data, error } = await supabase.from("plans").insert([planToAdd]).select()

      if (error) throw error

      if (data && data.length > 0) {
        const addedPlan = data[0] as Plan
        const updatedPlans = [...plans, addedPlan]
        setPlans(updatedPlans)
        onPlansUpdate(updatedPlans)
        setNewPlan({
          name: "",
          description: "",
          price: 0,
          duration: 1,
          duration_type: "months",
          activities: [],
        })
        setIsAddDialogOpen(false)
      }
    } catch (error) {
      console.error("Error agregando plan:", error)
      alert("Error al agregar el plan. Inténtalo de nuevo.")
    }
  }

  const handleEditPlan = async () => {
    if (!editingPlan) return
    try {
      const { error } = await supabase
        .from("plans")
        .update({
          name: editingPlan.name,
          description: editingPlan.description,
          price: editingPlan.price,
          duration: editingPlan.duration,
          duration_type: editingPlan.duration_type,
          activities: editingPlan.activities,
          is_active: editingPlan.is_active,
        })
        .eq("id", editingPlan.id)
        .eq("gym_id", gymId)

      if (error) throw error

      const updatedPlans = plans.map((p) => (p.id === editingPlan.id ? editingPlan : p))
      setPlans(updatedPlans)
      onPlansUpdate(updatedPlans)
      setIsEditDialogOpen(false)
      setEditingPlan(null)
    } catch (error) {
      console.error("Error editando plan:", error)
      alert("Error al editar el plan. Inténtalo de nuevo.")
    }
  }

  const handleDeletePlan = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este plan?")) return
    try {
      const { error } = await supabase.from("plans").delete().eq("id", id).eq("gym_id", gymId)
      if (error) throw error

      const updatedPlans = plans.filter((p) => p.id !== id)
      setPlans(updatedPlans)
      onPlansUpdate(updatedPlans)
    } catch (error) {
      console.error("Error eliminando plan:", error)
      alert("Error al eliminar el plan. Inténtalo de nuevo.")
    }
  }

  const togglePlanStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("plans")
        .update({ is_active: !currentStatus })
        .eq("id", id)
        .eq("gym_id", gymId)

      if (error) throw error

      const updatedPlans = plans.map((p) => (p.id === id ? { ...p, is_active: !currentStatus } : p))
      setPlans(updatedPlans)
      onPlansUpdate(updatedPlans)
    } catch (error) {
      console.error("Error cambiando estado del plan:", error)
      alert("Error al cambiar el estado del plan. Inténtalo de nuevo.")
    }
  }

  const getDurationText = (duration: number, type: string) => {
    const typeText = type === "days" ? "día(s)" : type === "months" ? "mes(es)" : "año(s)"
    return `${duration} ${typeText}`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Planes</h2>
          <p className="text-muted-foreground">Administra los planes de suscripción del gimnasio</p>
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
              <DialogTitle>Crear Nuevo Plan</DialogTitle>
              <DialogDescription>Define un nuevo plan de suscripción para el gimnasio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre del Plan</Label>
                <Input
                  id="name"
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="Plan Mensual Completo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  placeholder="Describe qué incluye este plan..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Precio ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({ ...newPlan, price: Number(e.target.value) })}
                    placeholder="2500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duración</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={newPlan.duration}
                      onChange={(e) => setNewPlan({ ...newPlan, duration: Number(e.target.value) })}
                      className="w-20"
                    />
                    <Select
                      value={newPlan.duration_type}
                      onValueChange={(value: "days" | "months" | "years") =>
                        setNewPlan({ ...newPlan, duration_type: value })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Días</SelectItem>
                        <SelectItem value="months">Meses</SelectItem>
                        <SelectItem value="years">Años</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Actividades Incluidas</Label>
                {availableActivities.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {availableActivities.map((activity) => (
                      <label key={activity} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={newPlan.activities.includes(activity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewPlan({ ...newPlan, activities: [...newPlan.activities, activity] })
                            } else {
                              setNewPlan({
                                ...newPlan,
                                activities: newPlan.activities.filter((a) => a !== activity),
                              })
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{activity}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground bg-gray-50 rounded-lg">
                    <p>No hay actividades disponibles.</p>
                    <p className="text-sm">Ve a la sección "Actividades" para crear algunas primero.</p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddPlan} disabled={availableActivities.length === 0}>
                Crear Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Planes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>
      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Planes ({filteredPlans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Actividades</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{plan.description}</TableCell>
                  <TableCell className="font-bold text-green-600">${plan.price.toLocaleString()}</TableCell>
                  <TableCell>{getDurationText(plan.duration, plan.duration_type)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {plan.activities.slice(0, 2).map((activity) => (
                        <Badge key={activity} variant="outline" className="text-xs">
                          {activity}
                        </Badge>
                      ))}
                      {plan.activities.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{plan.activities.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePlanStatus(plan.id, plan.is_active)}
                      className={plan.is_active ? "text-green-600" : "text-red-600"}
                    >
                      {plan.is_active ? "Activo" : "Inactivo"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPlan(plan)
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeletePlan(plan.id)}>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Plan</DialogTitle>
            <DialogDescription>Modifica los datos del plan.</DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre del Plan</Label>
                <Input
                  id="edit-name"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-price">Precio ($)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-duration">Duración</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={editingPlan.duration}
                      onChange={(e) => setEditingPlan({ ...editingPlan, duration: Number(e.target.value) })}
                      className="w-20"
                    />
                    <Select
                      value={editingPlan.duration_type}
                      onValueChange={(value: "days" | "months" | "years") =>
                        setEditingPlan({ ...editingPlan, duration_type: value })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Días</SelectItem>
                        <SelectItem value="months">Meses</SelectItem>
                        <SelectItem value="years">Años</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Actividades Incluidas</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {availableActivities.map((activity) => (
                    <label key={activity} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingPlan.activities.includes(activity)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingPlan({ ...editingPlan, activities: [...editingPlan.activities, activity] })
                          } else {
                            setEditingPlan({
                              ...editingPlan,
                              activities: editingPlan.activities.filter((a) => a !== activity),
                            })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{activity}</span>
                    </label>
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
