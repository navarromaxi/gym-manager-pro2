"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Plus, Trash2 } from "lucide-react"

// Dummy data for demonstration
interface Routine {
  id: string
  name: string
  description: string
  level: "Principiante" | "Intermedio" | "Avanzado"
  focus_area: string // e.g., "Piernas", "Brazos", "Full Body"
  exercises: { name: string; sets: number; reps: string; notes?: string }[]
  created_by: string // Instructor name or user ID
}

export function RoutineManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [levelFilter, setLevelFilter] = useState("all")
  const [newRoutine, setNewRoutine] = useState<Omit<Routine, "id">>({
    name: "",
    description: "",
    level: "Principiante",
    focus_area: "",
    exercises: [{ name: "", sets: 3, reps: "8-12" }],
    created_by: "Admin", // Default creator
  })

  const [routines, setRoutines] = useState<Routine[]>([
    {
      id: "routine_1",
      name: "Rutina Full Body Principiante",
      description: "Rutina para empezar a entrenar todo el cuerpo.",
      level: "Principiante",
      focus_area: "Full Body",
      exercises: [
        { name: "Sentadilla", sets: 3, reps: "10-12" },
        { name: "Press de Banca", sets: 3, reps: "8-10" },
        { name: "Remo con Barra", sets: 3, reps: "8-10" },
        { name: "Press Militar", sets: 3, reps: "8-10" },
        { name: "Plancha", sets: 3, reps: "30s" },
      ],
      created_by: "Carlos Pérez",
    },
    {
      id: "routine_2",
      name: "Rutina de Piernas Avanzada",
      description: "Entrenamiento intenso para el tren inferior.",
      level: "Avanzado",
      focus_area: "Piernas",
      exercises: [
        { name: "Sentadilla Búlgara", sets: 4, reps: "8-12 por pierna" },
        { name: "Peso Muerto Rumano", sets: 3, reps: "8-10" },
        { name: "Prensa de Piernas", sets: 3, reps: "10-15" },
        { name: "Extensiones de Cuádriceps", sets: 3, reps: "12-15" },
        { name: "Curl Femoral", sets: 3, reps: "12-15" },
      ],
      created_by: "María González",
    },
  ])

  const filteredRoutines = routines.filter((routine) => {
    const matchesSearch =
      routine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      routine.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      routine.focus_area.toLowerCase().includes(searchTerm.toLowerCase()) ||
      routine.created_by.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLevel = levelFilter === "all" || routine.level === levelFilter
    return matchesSearch && matchesLevel
  })

  const handleAddRoutine = () => {
    if (!newRoutine.name || !newRoutine.focus_area || newRoutine.exercises.length === 0) {
      alert("Por favor, completa todos los campos obligatorios y añade al menos un ejercicio.")
      return
    }
    const routineToAdd: Routine = {
      id: `routine_${Date.now()}`,
      ...newRoutine,
    }
    setRoutines((prev) => [...prev, routineToAdd])
    setNewRoutine({
      name: "",
      description: "",
      level: "Principiante",
      focus_area: "",
      exercises: [{ name: "", sets: 3, reps: "8-12" }],
      created_by: "Admin",
    })
    setIsAddDialogOpen(false)
  }

  const handleEditRoutine = () => {
    if (!editingRoutine) return
    if (!editingRoutine.name || !editingRoutine.focus_area || editingRoutine.exercises.length === 0) {
      alert("Por favor, completa todos los campos obligatorios y añade al menos un ejercicio.")
      return
    }
    setRoutines(routines.map((r) => (r.id === editingRoutine.id ? editingRoutine : r)))
    setIsEditDialogOpen(false)
    setEditingRoutine(null)
  }

  const handleDeleteRoutine = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta rutina?")) {
      setRoutines(routines.filter((r) => r.id !== id))
    }
  }

  const handleExerciseChange = (
    index: number,
    field: keyof Routine["exercises"][0],
    value: string | number,
    isNew: boolean,
  ) => {
    if (isNew) {
      const updatedExercises = [...newRoutine.exercises]
      // @ts-ignore
      updatedExercises[index][field] = value
      setNewRoutine({ ...newRoutine, exercises: updatedExercises })
    } else if (editingRoutine) {
      const updatedExercises = [...editingRoutine.exercises]
      // @ts-ignore
      updatedExercises[index][field] = value
      setEditingRoutine({ ...editingRoutine, exercises: updatedExercises })
    }
  }

  const addExerciseEntry = (isNew: boolean) => {
    if (isNew) {
      setNewRoutine({
        ...newRoutine,
        exercises: [...newRoutine.exercises, { name: "", sets: 3, reps: "8-12" }],
      })
    } else if (editingRoutine) {
      setEditingRoutine({
        ...editingRoutine,
        exercises: [...editingRoutine.exercises, { name: "", sets: 3, reps: "8-12" }],
      })
    }
  }

  const removeExerciseEntry = (index: number, isNew: boolean) => {
    if (isNew) {
      setNewRoutine({
        ...newRoutine,
        exercises: newRoutine.exercises.filter((_, i) => i !== index),
      })
    } else if (editingRoutine) {
      setEditingRoutine({
        ...editingRoutine,
        exercises: editingRoutine.exercises.filter((_, i) => i !== index),
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Rutinas</h2>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Nueva Rutina
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta sección está en desarrollo. Aquí podrás crear y gestionar rutinas de entrenamiento personalizadas para
            tus socios.
          </p>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Rutina
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Crear Nueva Rutina</DialogTitle>
            <DialogDescription>Define una nueva rutina de entrenamiento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={newRoutine.name}
                onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
                placeholder="Rutina de Pecho y Tríceps"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="level" className="text-right">
                Nivel
              </Label>
              <Select
                value={newRoutine.level}
                onValueChange={(value: "Principiante" | "Intermedio" | "Avanzado") =>
                  setNewRoutine({ ...newRoutine, level: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Principiante">Principiante</SelectItem>
                  <SelectItem value="Intermedio">Intermedio</SelectItem>
                  <SelectItem value="Avanzado">Avanzado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="focus_area" className="text-right">
                Área de Enfoque
              </Label>
              <Input
                id="focus_area"
                value={newRoutine.focus_area}
                onChange={(e) => setNewRoutine({ ...newRoutine, focus_area: e.target.value })}
                placeholder="Piernas, Full Body, Brazos..."
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right">
                Descripción
              </Label>
              <Textarea
                id="description"
                value={newRoutine.description}
                onChange={(e) => setNewRoutine({ ...newRoutine, description: e.target.value })}
                placeholder="Rutina enfocada en fuerza y volumen para el tren superior."
                className="col-span-3 min-h-[80px]"
              />
            </div>
            <div className="col-span-4">
              <Label className="text-right">Ejercicios</Label>
              {newRoutine.exercises.map((exercise, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 mt-2 items-center">
                  <Input
                    placeholder="Nombre del ejercicio"
                    value={exercise.name}
                    onChange={(e) => handleExerciseChange(index, "name", e.target.value, true)}
                    className="col-span-2"
                  />
                  <Input
                    type="number"
                    placeholder="Series"
                    value={exercise.sets}
                    onChange={(e) => handleExerciseChange(index, "sets", Number.parseInt(e.target.value) || 0, true)}
                    className="col-span-1"
                  />
                  <Input
                    placeholder="Repeticiones"
                    value={exercise.reps}
                    onChange={(e) => handleExerciseChange(index, "reps", e.target.value, true)}
                    className="col-span-1"
                  />
                  <Input
                    placeholder="Notas (opcional)"
                    value={exercise.notes || ""}
                    onChange={(e) => handleExerciseChange(index, "notes", e.target.value, true)}
                    className="col-span-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExerciseEntry(index, true)}
                    disabled={newRoutine.exercises.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 bg-transparent"
                onClick={() => addExerciseEntry(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Añadir Ejercicio
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddRoutine}>
              Crear Rutina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
