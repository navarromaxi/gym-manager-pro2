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
import { Plus, Edit, Trash2, Search, Clock, Users } from "lucide-react"

interface Activity {
  id: string
  name: string
  description: string
  instructor: string
  capacity: number
  duration: number // en minutos
  schedule: {
    day: string
    startTime: string
    endTime: string
  }[]
  isActive: boolean
  createdDate: string
}

interface ActivityManagementProps {
  activities: Activity[]
  setActivities: (activities: Activity[]) => void
}

export function ActivityManagement({ activities, setActivities }: ActivityManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [newActivity, setNewActivity] = useState({
    name: "",
    description: "",
    instructor: "",
    capacity: 10,
    duration: 60,
    schedule: [] as { day: string; startTime: string; endTime: string }[],
  })

  const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

  const filteredActivities = activities.filter(
    (activity) =>
      activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.instructor.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleAddActivity = () => {
    const activity: Activity = {
      id: Date.now().toString(),
      ...newActivity,
      isActive: true,
      createdDate: new Date().toISOString().split("T")[0],
    }

    setActivities([...activities, activity])
    setNewActivity({
      name: "",
      description: "",
      instructor: "",
      capacity: 10,
      duration: 60,
      schedule: [],
    })
    setIsAddDialogOpen(false)
  }

  const handleEditActivity = () => {
    if (!editingActivity) return

    setActivities(activities.map((a) => (a.id === editingActivity.id ? editingActivity : a)))
    setIsEditDialogOpen(false)
    setEditingActivity(null)
  }

  const handleDeleteActivity = (id: string) => {
    setActivities(activities.filter((a) => a.id !== id))
  }

  const toggleActivityStatus = (id: string) => {
    setActivities(activities.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a)))
  }

  const addScheduleSlot = (activityData: any, setActivityData: any) => {
    setActivityData({
      ...activityData,
      schedule: [...activityData.schedule, { day: "Lunes", startTime: "08:00", endTime: "09:00" }],
    })
  }

  const removeScheduleSlot = (index: number, activityData: any, setActivityData: any) => {
    setActivityData({
      ...activityData,
      schedule: activityData.schedule.filter((_: any, i: number) => i !== index),
    })
  }

  const updateScheduleSlot = (index: number, field: string, value: string, activityData: any, setActivityData: any) => {
    const updatedSchedule = [...activityData.schedule]
    updatedSchedule[index] = { ...updatedSchedule[index], [field]: value }
    setActivityData({ ...activityData, schedule: updatedSchedule })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Actividades</h2>
          <p className="text-muted-foreground">Administra las clases y actividades del gimnasio</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Actividad</DialogTitle>
              <DialogDescription>Define una nueva clase o actividad para el gimnasio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre de la Actividad</Label>
                <Input
                  id="name"
                  value={newActivity.name}
                  onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                  placeholder="Pilates Matutino"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  placeholder="Describe la actividad..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="instructor">Instructor</Label>
                  <Input
                    id="instructor"
                    value={newActivity.instructor}
                    onChange={(e) => setNewActivity({ ...newActivity, instructor: e.target.value })}
                    placeholder="María González"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="capacity">Capacidad</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={newActivity.capacity}
                    onChange={(e) => setNewActivity({ ...newActivity, capacity: Number(e.target.value) })}
                    placeholder="15"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duración (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={newActivity.duration}
                  onChange={(e) => setNewActivity({ ...newActivity, duration: Number(e.target.value) })}
                  placeholder="60"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label>Horarios</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addScheduleSlot(newActivity, setNewActivity)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Horario
                  </Button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {newActivity.schedule.map((slot, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select
                        value={slot.day}
                        onValueChange={(value) => updateScheduleSlot(index, "day", value, newActivity, setNewActivity)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {daysOfWeek.map((day) => (
                            <SelectItem key={day} value={day}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) =>
                          updateScheduleSlot(index, "startTime", e.target.value, newActivity, setNewActivity)
                        }
                        className="w-24"
                      />
                      <span className="text-sm">a</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) =>
                          updateScheduleSlot(index, "endTime", e.target.value, newActivity, setNewActivity)
                        }
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeScheduleSlot(index, newActivity, setNewActivity)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddActivity}>
                Crear Actividad
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Actividades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Actividades ({filteredActivities.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actividad</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Capacidad</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Horarios</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActivities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{activity.name}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-xs">{activity.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>{activity.instructor}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {activity.capacity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {activity.duration} min
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {activity.schedule.slice(0, 2).map((slot, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {slot.day} {slot.startTime}-{slot.endTime}
                        </Badge>
                      ))}
                      {activity.schedule.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{activity.schedule.length - 2} más
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActivityStatus(activity.id)}
                      className={activity.isActive ? "text-green-600" : "text-red-600"}
                    >
                      {activity.isActive ? "Activa" : "Inactiva"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingActivity(activity)
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteActivity(activity.id)}>
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
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Actividad</DialogTitle>
            <DialogDescription>Modifica los datos de la actividad.</DialogDescription>
          </DialogHeader>
          {editingActivity && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre de la Actividad</Label>
                <Input
                  id="edit-name"
                  value={editingActivity.name}
                  onChange={(e) => setEditingActivity({ ...editingActivity, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={editingActivity.description}
                  onChange={(e) => setEditingActivity({ ...editingActivity, description: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-instructor">Instructor</Label>
                  <Input
                    id="edit-instructor"
                    value={editingActivity.instructor}
                    onChange={(e) => setEditingActivity({ ...editingActivity, instructor: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-capacity">Capacidad</Label>
                  <Input
                    id="edit-capacity"
                    type="number"
                    value={editingActivity.capacity}
                    onChange={(e) => setEditingActivity({ ...editingActivity, capacity: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-duration">Duración (minutos)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={editingActivity.duration}
                  onChange={(e) => setEditingActivity({ ...editingActivity, duration: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label>Horarios</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addScheduleSlot(editingActivity, setEditingActivity)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Horario
                  </Button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {editingActivity.schedule.map((slot, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select
                        value={slot.day}
                        onValueChange={(value) =>
                          updateScheduleSlot(index, "day", value, editingActivity, setEditingActivity)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {daysOfWeek.map((day) => (
                            <SelectItem key={day} value={day}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) =>
                          updateScheduleSlot(index, "startTime", e.target.value, editingActivity, setEditingActivity)
                        }
                        className="w-24"
                      />
                      <span className="text-sm">a</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) =>
                          updateScheduleSlot(index, "endTime", e.target.value, editingActivity, setEditingActivity)
                        }
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeScheduleSlot(index, editingActivity, setEditingActivity)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
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
