"use client";

import { useState } from "react";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Search, Download, Dumbbell } from "lucide-react";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  weight: string;
  rest: string;
  notes: string;
}

interface Routine {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  difficulty: "Principiante" | "Intermedio" | "Avanzado";
  duration: number; // en minutos
  exercises: Exercise[];
  createdDate: string;
  createdBy: string;
}

interface RoutineManagementProps {
  gymId: string;
}

export function RoutineManagement({ gymId }: RoutineManagementProps) {
  console.log("Rutina: Gym ID recibido:", gymId); // 👈 esto
  const [routines, setRoutines] = useState<Routine[]>([]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingRoutine, setViewingRoutine] = useState<Routine | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [newRoutine, setNewRoutine] = useState({
    name: "",
    description: "",
    targetAudience: "",
    difficulty: "Principiante" as "Principiante" | "Intermedio" | "Avanzado",
    duration: 45,
    exercises: [] as Exercise[],
  });

  useEffect(() => {
    const fetchRoutines = async () => {
      const { data, error } = await supabase
        .from("routines")
        .select("*")
        .eq("gym_id", gymId);

      if (error) {
        console.error("Error al cargar rutinas desde Supabase:", error);
        return;
      }

      if (data) {
        const formatted = data.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          targetAudience: r.target_audience,
          difficulty: r.difficulty,
          duration: r.duration,
          exercises: r.exercises,
          createdDate: r.created_date,
          createdBy: r.created_by,
        })) as Routine[];

        setRoutines(formatted);
      }
    };

    fetchRoutines();
  }, [gymId]);

  const filteredRoutines = routines.filter((routine) => {
    const matchesSearch =
      routine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      routine.targetAudience.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === "all" || routine.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  const handleAddRoutine = async () => {
    const routine: Routine = {
      id: `${Date.now()}`,
      ...newRoutine,
      createdDate: new Date().toISOString().split("T")[0],
      createdBy: "Usuario Actual",
    };

    const { error } = await supabase.from("routines").insert([
      {
        id: routine.id,
        gym_id: gymId,
        name: routine.name,
        description: routine.description,
        target_audience: routine.targetAudience,
        difficulty: routine.difficulty,
        duration: routine.duration,
        exercises: routine.exercises,
        created_date: routine.createdDate,
        created_by: routine.createdBy, // ✅ USA snake_case correcto
      },
    ]);

    if (error) {
      console.error("Error al guardar la rutina en Supabase:", error);
      return;
    }


    console.log("Gym ID al guardar rutina:", gymId);
    
    // Si se guarda bien, actualizamos el estado local
    setRoutines([...routines, routine]);
    setNewRoutine({
      name: "",
      description: "",
      targetAudience: "",
      difficulty: "Principiante",
      duration: 45,
      exercises: [],
    });
    setIsAddDialogOpen(false);
  };

  const handleDeleteRoutine = async (id: string) => {
    const { error } = await supabase.from("routines").delete().eq("id", id);

    if (error) {
      console.error("Error al eliminar rutina en Supabase:", error);
      return;
    }

    setRoutines(routines.filter((r) => r.id !== id));
  };

  const addExercise = () => {
    setNewRoutine({
      ...newRoutine,
      exercises: [
        ...newRoutine.exercises,
        {
          name: "",
          sets: 3,
          reps: "12",
          weight: "",
          rest: "60 seg",
          notes: "",
        },
      ],
    });
  };

  const removeExercise = (index: number) => {
    setNewRoutine({
      ...newRoutine,
      exercises: newRoutine.exercises.filter((_, i) => i !== index),
    });
  };

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    const updatedExercises = [...newRoutine.exercises];
    updatedExercises[index] = { ...updatedExercises[index], [field]: value };
    setNewRoutine({ ...newRoutine, exercises: updatedExercises });
  };

  // DESCARGA A EXCEL - Función actualizada
  const downloadRoutineAsExcel = (routine: Routine) => {
    // Crear datos para Excel
    const excelData = [
      ["RUTINA DE EJERCICIOS"],
      [""],
      ["Nombre:", routine.name],
      ["Descripción:", routine.description],
      ["Dirigido a:", routine.targetAudience],
      ["Dificultad:", routine.difficulty],
      ["Duración estimada:", `${routine.duration} minutos`],
      ["Creada por:", routine.createdBy],
      ["Fecha:", new Date(routine.createdDate).toLocaleDateString()],
      [""],
      ["EJERCICIOS:"],
      ["#", "Ejercicio", "Series", "Repeticiones", "Peso", "Descanso", "Notas"],
    ];

    // Agregar ejercicios
    routine.exercises.forEach((exercise, index) => {
      excelData.push([
        (index + 1).toString(),
        exercise.name,
        exercise.sets.toString(),
        exercise.reps,
        exercise.weight,
        exercise.rest,
        exercise.notes,
      ]);
    });

    // Convertir a CSV (compatible con Excel)
    const csvContent = excelData
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rutina-${routine.name
      .toLowerCase()
      .replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Principiante":
        return "bg-green-500";
      case "Intermedio":
        return "bg-yellow-500";
      case "Avanzado":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Rutinas
          </h2>
          <p className="text-muted-foreground">
            Crea y administra rutinas de ejercicios para los socios
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Rutina
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Rutina</DialogTitle>
              <DialogDescription>
                Define una nueva rutina de ejercicios.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre de la Rutina</Label>
                <Input
                  id="name"
                  value={newRoutine.name}
                  onChange={(e) =>
                    setNewRoutine({ ...newRoutine, name: e.target.value })
                  }
                  placeholder="Rutina Principiante - Cuerpo Completo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newRoutine.description}
                  onChange={(e) =>
                    setNewRoutine({
                      ...newRoutine,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe el objetivo y características de la rutina..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="targetAudience">Dirigido a</Label>
                  <Input
                    id="targetAudience"
                    value={newRoutine.targetAudience}
                    onChange={(e) =>
                      setNewRoutine({
                        ...newRoutine,
                        targetAudience: e.target.value,
                      })
                    }
                    placeholder="Principiantes, Mujeres, etc."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="difficulty">Dificultad</Label>
                  <Select
                    value={newRoutine.difficulty}
                    onValueChange={(
                      value: "Principiante" | "Intermedio" | "Avanzado"
                    ) => setNewRoutine({ ...newRoutine, difficulty: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Principiante">Principiante</SelectItem>
                      <SelectItem value="Intermedio">Intermedio</SelectItem>
                      <SelectItem value="Avanzado">Avanzado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duración estimada (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={newRoutine.duration}
                  onChange={(e) =>
                    setNewRoutine({
                      ...newRoutine,
                      duration: Number(e.target.value),
                    })
                  }
                  placeholder="45"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label>Ejercicios</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExercise}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Ejercicio
                  </Button>
                </div>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {newRoutine.exercises.map((exercise, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid gap-3">
                        <div className="flex justify-between items-center">
                          <Label className="font-medium">
                            Ejercicio {index + 1}
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeExercise(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Nombre del ejercicio"
                          value={exercise.name}
                          onChange={(e) =>
                            updateExercise(index, "name", e.target.value)
                          }
                        />
                        <div className="grid grid-cols-4 gap-2">
                          <Input
                            type="number"
                            placeholder="Series"
                            value={exercise.sets}
                            onChange={(e) =>
                              updateExercise(
                                index,
                                "sets",
                                Number(e.target.value)
                              )
                            }
                          />
                          <Input
                            placeholder="Reps"
                            value={exercise.reps}
                            onChange={(e) =>
                              updateExercise(index, "reps", e.target.value)
                            }
                          />
                          <Input
                            placeholder="Peso"
                            value={exercise.weight}
                            onChange={(e) =>
                              updateExercise(index, "weight", e.target.value)
                            }
                          />
                          <Input
                            placeholder="Descanso"
                            value={exercise.rest}
                            onChange={(e) =>
                              updateExercise(index, "rest", e.target.value)
                            }
                          />
                        </div>
                        <Input
                          placeholder="Notas adicionales"
                          value={exercise.notes}
                          onChange={(e) =>
                            updateExercise(index, "notes", e.target.value)
                          }
                        />
                      </div>
                    </Card>
                  ))}
                </div>
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
                  placeholder="Buscar por nombre o público objetivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select
              value={difficultyFilter}
              onValueChange={setDifficultyFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Dificultad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Principiante">Principiante</SelectItem>
                <SelectItem value="Intermedio">Intermedio</SelectItem>
                <SelectItem value="Avanzado">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Routines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Rutinas ({filteredRoutines.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rutina</TableHead>
                <TableHead>Dirigido a</TableHead>
                <TableHead>Dificultad</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Ejercicios</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoutines.map((routine) => (
                <TableRow key={routine.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{routine.name}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {routine.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{routine.targetAudience}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${getDifficultyColor(
                        routine.difficulty
                      )} text-white`}
                    >
                      {routine.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>{routine.duration} min</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Dumbbell className="h-4 w-4 mr-1" />
                      {routine.exercises.length}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(routine.createdDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setViewingRoutine(routine);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadRoutineAsExcel(routine)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRoutine(routine.id)}
                      >
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

      {/* View Routine Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingRoutine?.name}</DialogTitle>
            <DialogDescription>{viewingRoutine?.description}</DialogDescription>
          </DialogHeader>
          {viewingRoutine && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Dirigido a:</Label>
                  <p>{viewingRoutine.targetAudience}</p>
                </div>
                <div>
                  <Label className="font-medium">Dificultad:</Label>
                  <Badge
                    className={`${getDifficultyColor(
                      viewingRoutine.difficulty
                    )} text-white ml-2`}
                  >
                    {viewingRoutine.difficulty}
                  </Badge>
                </div>
                <div>
                  <Label className="font-medium">Duración:</Label>
                  <p>{viewingRoutine.duration} minutos</p>
                </div>
                <div>
                  <Label className="font-medium">Ejercicios:</Label>
                  <p>{viewingRoutine.exercises.length} ejercicios</p>
                </div>
              </div>
              <div>
                <Label className="font-medium">Lista de Ejercicios:</Label>
                <div className="space-y-3 mt-2">
                  {viewingRoutine.exercises.map((exercise, index) => (
                    <Card key={index} className="p-3">
                      <div className="font-medium">
                        {index + 1}. {exercise.name}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {exercise.sets} series × {exercise.reps} reps
                        {exercise.weight && ` - ${exercise.weight}`}
                        {exercise.rest && ` - Descanso: ${exercise.rest}`}
                      </div>
                      {exercise.notes && (
                        <div className="text-sm text-blue-600 mt-1">
                          💡 {exercise.notes}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() =>
                viewingRoutine && downloadRoutineAsExcel(viewingRoutine)
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
