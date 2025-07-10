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
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import type { Activity } from "@/lib/supabase"

interface ActivityManagementProps {
  activities: Activity[]
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>
  gymId: string
}

export function ActivityManagement({ activities, setActivities, gymId }: ActivityManagementProps) {
  const [isAddActivityDialogOpen, setIsAddActivityDialogOpen] = useState(false)
  const [isEditActivityDialogOpen, setIsEditActivityDialogOpen] = useState(false)
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null)
  const [newActivity, setNewActivity] = useState<Omit<Activity, "id" | "gym_id">>({
    name: "",
    description: "",
    instructor: "",
    capacity: 0,
    duration: 0,
    schedule: [],
    is_active: true,
    created_date: format(new Date(), "yyyy-MM-dd"),
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [newScheduleEntry, setNewScheduleEntry] = useState({
    day: "",
    startTime: "",
    endTime: "",
  })

  const handleAddActivity = async () => {
    if (!newActivity.name || !newActivity.instructor || newActivity.capacity <= 0) {
      alert("Por favor, completa todos los campos obligatorios y asegúrate que la capacidad sea mayor a 0.")
      return
    }

    const activityToAdd: Omit<Activity, "id"> = {
      ...newActivity,
      gym_id: gymId,
      created_date: newActivity.created_date || format(new Date(), "yyyy-MM-dd"),
    }

    try {
      const { data, error } = await supabase.from("activities").insert(activityToAdd).select().single()
      if (error) throw error
      setActivities((prev) => [...prev, data])
      setIsAddActivityDialogOpen(false)
      setNewActivity({
        name: "",
        description: "",
        instructor: "",
        capacity: 0,
        duration: 0,
        schedule: [],
        is_active: true,
        created_date: format(new Date(), "yyyy-MM-dd"),
      })
      setNewScheduleEntry({ day: "", startTime: "", endTime: "" })
    } catch (error) {
      console.error("Error adding activity:", error)
      alert("Error al agregar actividad. Inténtalo de nuevo.")
    }
  }

  const handleEditActivity = async () => {
    if (!currentActivity || !currentActivity.name || !currentActivity.instructor || currentActivity.capacity <= 0) {
      alert("Por favor, completa todos los campos obligatorios y asegúrate que la capacidad sea mayor a 0.")
      return
    }

    try {
      const { data, error } = await supabase
        .from("activities")
        .update(currentActivity)
        .eq("id", currentActivity.id)
        .select()
        .single()
      if (error) throw error
      setActivities((prev) => prev.map((a) => (a.id === data.id ? data : a)))
      setIsEditActivityDialogOpen(false)
      setCurrentActivity(null)
    } catch (error) {
      console.error("Error editing activity:", error)
      alert("Error al editar actividad. Inténtalo de nuevo.")
    }
  }

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta actividad?")) return
    try {
      const { error } = await supabase.from("activities").delete().eq("id", id)
      if (error) throw error
      setActivities((prev) => prev.filter((a) => a.id !== id))
    } catch (error) {
      console.error("Error deleting activity:", error)
      alert("Error al eliminar actividad. Inténtalo de nuevo.")
    }
  }

  const handleAddSchedule = (type: "new" | "edit") => {
    if (!newScheduleEntry.day || !newScheduleEntry.startTime || !newScheduleEntry.endTime) {
      alert("Por favor, completa todos los campos del horario.")
      return
    }

    if (type === "new") {
      setNewActivity((prev) => ({
        ...prev,
        schedule: [...prev.schedule, newScheduleEntry],
      }))
    } else if (type === "edit" && currentActivity) {
      setCurrentActivity((prev) =>
        prev
          ? {
              ...prev,
              schedule: [...prev.schedule, newScheduleEntry],
            }
          : null,
      )
    }
    setNewScheduleEntry({ day: "", startTime: "", endTime: "" })
  }

  const handleRemoveSchedule = (index: number, type: "new" | "edit") => {
    if (type === "new") {
      setNewActivity((prev) => ({
        ...prev,
        schedule: prev.schedule.filter((_, i) => i !== index),
      }))
    } else if (type === "edit" && currentActivity) {
      setCurrentActivity((prev) =>
        prev
          ? {
              ...prev,
              schedule: prev.schedule.filter((_, i) => i !== index),
            }
          : null,
      )
    }
  }

  const filteredActivities = activities.filter((activity) =>
    searchTerm
      ? activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.instructor.toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Actividades</h2>
        <Button onClick={() => setIsAddActivityDialogOpen(true)}>Agregar Actividad</Button>
      </div>

      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar actividad por nombre o instructor..."
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

      {/* Activities Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead>Capacidad</TableHead>
              <TableHead>Duración (min)</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActivities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron actividades.
                </TableCell>
              </TableRow>
            ) : (
              filteredActivities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="font-medium">{activity.name}</TableCell>
                  <TableCell>{activity.instructor}</TableCell>
                  <TableCell>{activity.capacity}</TableCell>
                  <TableCell>{activity.duration}</TableCell>
                  <TableCell>
                    {activity.schedule && activity.schedule.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {activity.schedule.map((s, idx) => (
                          <li key={idx}>
                            {s.day}: {s.startTime} - {s.endTime}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={activity.is_active ? "default" : "secondary"}>
                      {activity.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentActivity(activity)
                          setIsEditActivityDialogOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteActivity(activity.id)}>
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

      {/* Add Activity Dialog */}
      <Dialog open={isAddActivityDialogOpen} onOpenChange={setIsAddActivityDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Agregar Nueva Actividad</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={newActivity.name}
                onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Descripción
              </Label>
              <Input
                id="description"
                value={newActivity.description}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="instructor" className="text-right">
                Instructor
              </Label>
              <Input
                id="instructor"
                value={newActivity.instructor}
                onChange={(e) => setNewActivity({ ...newActivity, instructor: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="capacity" className="text-right">
                Capacidad
              </Label>
              <Input
                id="capacity"
                type="number"
                value={newActivity.capacity}
                onChange={(e) => setNewActivity({ ...newActivity, capacity: Number.parseInt(e.target.value) || 0 })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="duration" className="text-right">
                Duración (min)
              </Label>
              <Input
                id="duration"
                type="number"
                value={newActivity.duration}
                onChange={(e) => setNewActivity({ ...newActivity, duration: Number.parseInt(e.target.value) || 0 })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right">
                Activa
              </Label>
              <Select
                value={newActivity.is_active ? "true" : "false"}
                onValueChange={(value) => setNewActivity({ ...newActivity, is_active: value === "true" })}
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
              <Label className="text-right pt-2">Horario</Label>
              <div className="col-span-3 space-y-2">
                {newActivity.schedule.map((s, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="outline">
                      {s.day}: {s.startTime} - {s.endTime}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSchedule(index, "new")}
                      className="h-6 w-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Select
                    value={newScheduleEntry.day}
                    onValueChange={(value) => setNewScheduleEntry({ ...newScheduleEntry, day: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Día" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={newScheduleEntry.startTime}
                    onChange={(e) => setNewScheduleEntry({ ...newScheduleEntry, startTime: e.target.value })}
                    className="w-24"
                  />
                  <Input
                    type="time"
                    value={newScheduleEntry.endTime}
                    onChange={(e) => setNewScheduleEntry({ ...newScheduleEntry, endTime: e.target.value })}
                    className="w-24"
                  />
                  <Button size="icon" onClick={() => handleAddSchedule("new")}>
                    +
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddActivity}>
              Guardar Actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Dialog */}
      <Dialog open={isEditActivityDialogOpen} onOpenChange={setIsEditActivityDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Actividad</DialogTitle>
          </DialogHeader>
          {currentActivity && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="edit-name"
                  value={currentActivity.name}
                  onChange={(e) => setCurrentActivity({ ...currentActivity, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Descripción
                </Label>
                <Input
                  id="edit-description"
                  value={currentActivity.description}
                  onChange={(e) => setCurrentActivity({ ...currentActivity, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-instructor" className="text-right">
                  Instructor
                </Label>
                <Input
                  id="edit-instructor"
                  value={currentActivity.instructor}
                  onChange={(e) => setCurrentActivity({ ...currentActivity, instructor: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-capacity" className="text-right">
                  Capacidad
                </Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  value={currentActivity.capacity}
                  onChange={(e) =>
                    setCurrentActivity({ ...currentActivity, capacity: Number.parseInt(e.target.value) || 0 })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-duration" className="text-right">
                  Duración (min)
                </Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={currentActivity.duration}
                  onChange={(e) =>
                    setCurrentActivity({ ...currentActivity, duration: Number.parseInt(e.target.value) || 0 })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-is_active" className="text-right">
                  Activa
                </Label>
                <Select
                  value={currentActivity.is_active ? "true" : "false"}
                  onValueChange={(value) => setCurrentActivity({ ...currentActivity, is_active: value === "true" })}
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
                <Label className="text-right pt-2">Horario</Label>
                <div className="col-span-3 space-y-2">
                  {currentActivity.schedule.map((s, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="outline">
                        {s.day}: {s.startTime} - {s.endTime}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSchedule(index, "edit")}
                        className="h-6 w-6"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Select
                      value={newScheduleEntry.day}
                      onValueChange={(value) => setNewScheduleEntry({ ...newScheduleEntry, day: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Día" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      value={newScheduleEntry.startTime}
                      onChange={(e) => setNewScheduleEntry({ ...newScheduleEntry, startTime: e.target.value })}
                      className="w-24"
                    />
                    <Input
                      type="time"
                      value={newScheduleEntry.endTime}
                      onChange={(e) => setNewScheduleEntry({ ...newScheduleEntry, endTime: e.target.value })}
                      className="w-24"
                    />
                    <Button size="icon" onClick={() => handleAddSchedule("edit")}>
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleEditActivity}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
