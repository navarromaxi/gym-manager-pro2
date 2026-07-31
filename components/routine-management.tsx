"use client";

import { useState, useEffect } from "react";
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
import { Plus, Trash2, Search, Download, Dumbbell, MonitorUp, Copy, Link2, Link2Off } from "lucide-react";
import { RoutineRoomMode, type RoomRoutine } from "@/features/routines/components/routine-room-mode";
import { PersonalizedRoutineBuilder, type CreatedPersonalizedRoutine } from "@/features/routines/components/personalized-routine-builder";
import { WEEK_DAYS, getDaySections, type WeeklyPlan } from "@/features/routines/routine-plan";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  weight: string;
  rest: string;
  notes: string;
}

interface Routine extends RoomRoutine {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  difficulty: "Principiante" | "Intermedio" | "Avanzado";
  duration: number; // en minutos
  exercises: Exercise[];
  createdDate: string;
  createdBy: string;
  weeklyPlan?: WeeklyPlan;
  validFrom?: string | null;
  validUntil?: string | null;
  dayIntensities?: Record<string, "green" | "yellow" | "red">;
  planCycle?: "weekly" | "biweekly" | "monthly";
  cyclePlan?: Record<string, WeeklyPlan>;
  publicShareToken?: string | null;
  publicLinkEnabled?: boolean;
}

interface RoutineMember { id: string; name: string; cedula?: string | null; email?: string | null; phone?: string | null; }

interface RoutineManagementProps {
  gymId: string;
}

export function RoutineManagement({ gymId }: RoutineManagementProps) {
  console.log("Rutina: Gym ID recibido:", gymId); // 👈 esto
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [members, setMembers] = useState<RoutineMember[]>([]);
  const [isRoomMode, setIsRoomMode] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPersonalizedDialogOpen, setIsPersonalizedDialogOpen] = useState(false);
  const [editingPersonalizedRoutine, setEditingPersonalizedRoutine] = useState<Routine | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); //Estado estados para editar rutina
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null); //Estado estados para editar rutina
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingRoutine, setViewingRoutine] = useState<Routine | null>(null);
  const [duplicatingRoutine, setDuplicatingRoutine] = useState<Routine | null>(null);
  const [duplicateMemberId, setDuplicateMemberId] = useState("");
  const [duplicateMemberQuery, setDuplicateMemberQuery] = useState("");
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateDescription, setDuplicateDescription] = useState("");
  const [duplicateDuration, setDuplicateDuration] = useState(60);
  const [duplicateValidFrom, setDuplicateValidFrom] = useState("");
  const [duplicateValidUntil, setDuplicateValidUntil] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [routineStatusFilter, setRoutineStatusFilter] = useState("all");
  const [newRoutine, setNewRoutine] = useState({
    name: "",
    description: "",
    targetAudience: "",
    difficulty: "Principiante" as "Principiante" | "Intermedio" | "Avanzado",
    duration: 45,
    exercises: [] as Exercise[],
    memberId: "",
  });

  useEffect(() => {
    const fetchRoutines = async () => {
      const [{ data, error }, { data: memberData, error: membersError }] = await Promise.all([
        supabase.from("routines").select("*").eq("gym_id", gymId),
        supabase.from("members").select("id, name, cedula, email, phone").eq("gym_id", gymId).order("name"),
      ]);

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
          memberId: r.member_id ?? null,
          weeklyPlan: r.weekly_plan ?? {},
          validFrom: r.valid_from ?? null,
          validUntil: r.valid_until ?? null,
          archivedAt: r.archived_at ?? null,
          dayIntensities: r.day_intensities ?? {},
          planCycle: r.plan_cycle ?? "weekly",
          cyclePlan: r.cycle_plan ?? {},
          publicShareToken: r.public_share_token ?? null,
          publicLinkEnabled: r.public_link_enabled ?? true,
        })) as Routine[];

        setRoutines(formatted);
      }
      if (membersError) console.error("Error al cargar socios para rutinas:", membersError);
      else setMembers((memberData ?? []) as RoutineMember[]);
    };

    fetchRoutines();
  }, [gymId]);

  const today = new Date().toLocaleDateString("en-CA");
  const routineStatus = (routine: Routine) => {
    if (routine.validFrom && routine.validFrom > today) return "upcoming";
    if (routine.validUntil && routine.validUntil < today) return "archived";
    return "active";
  };
  const filteredRoutines = routines.filter((routine) => {
    const matchesSearch =
      routine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      routine.targetAudience.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === "all" || routine.difficulty === difficultyFilter;
    const matchesStatus = routineStatusFilter === "all" || routineStatus(routine) === routineStatusFilter;
    return matchesSearch && matchesDifficulty && matchesStatus;
  });
  const routineHasNoDifficulty = (routine: Pick<Routine, "memberId" | "targetAudience">) => Boolean(routine.memberId) || routine.targetAudience === "Rutina personalizada";
  const copyPublicRoutineLink = async (routine: Routine) => {
    if (!routine.publicShareToken || !routine.publicLinkEnabled) return alert("Este enlace estará disponible cuando corras el SQL de enlaces públicos.");
    const url = `${window.location.origin}/rutina/${routine.publicShareToken}`;
    try { await navigator.clipboard.writeText(url); alert("Enlace copiado. Ya podés enviárselo al socio."); }
    catch { window.prompt("Copiá este enlace para el socio:", url); }
  };
  const togglePublicRoutineLink = async (routine: Routine) => {
    const isEnabled = routine.publicLinkEnabled !== false;
    if (isEnabled && !window.confirm("¿Desactivar este enlace? El socio dejará de poder abrir la rutina con ese link.")) return;
    const nextToken = isEnabled ? routine.publicShareToken : crypto.randomUUID();
    const { error } = await supabase.from("routines").update({ public_link_enabled: !isEnabled, public_share_token: nextToken }).eq("id", routine.id).eq("gym_id", gymId);
    if (error) return alert("No pudimos actualizar el enlace. Intentá nuevamente.");
    setRoutines((current) => current.map((item) => item.id === routine.id ? { ...item, publicLinkEnabled: !isEnabled, publicShareToken: nextToken } : item));
    alert(isEnabled ? "Enlace desactivado." : "Generamos un enlace nuevo y seguro para esta rutina.");
  };

  const handleAddRoutine = async () => {
    const routine: Routine = {
      id: `${Date.now()}`,
      ...newRoutine,
      createdDate: new Date().toISOString().split("T")[0],
      createdBy: "Usuario Actual",
    };

    const { data: createdRoutine, error } = await supabase.from("routines").insert([
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
        member_id: routine.memberId || null,
        created_by: routine.createdBy, // ✅ USA snake_case correcto
      },
    ]).select("public_share_token, public_link_enabled").single();

    if (error) {
      console.error("Error al guardar la rutina en Supabase:", error);
      return;
    }

    console.log("Gym ID al guardar rutina:", gymId);

    // Si se guarda bien, actualizamos el estado local
    setRoutines([...routines, { ...routine, publicShareToken: createdRoutine?.public_share_token ?? null, publicLinkEnabled: createdRoutine?.public_link_enabled ?? true }]);
    setNewRoutine({
      name: "",
      description: "",
      targetAudience: "",
      difficulty: "Principiante",
      duration: 45,
      exercises: [],
      memberId: "",
    });
    setIsAddDialogOpen(false);
  };

  const handleUpdateRoutine = async () => {
    if (!editingRoutine) return;

    const { id, ...dataToUpdate } = editingRoutine;

    const { error } = await supabase
      .from("routines")
      .update({
        name: dataToUpdate.name,
        description: dataToUpdate.description,
        target_audience: dataToUpdate.targetAudience,
        difficulty: dataToUpdate.difficulty,
        duration: dataToUpdate.duration,
        exercises: dataToUpdate.exercises,
        member_id: dataToUpdate.memberId || null,
      })
      .eq("id", id);

    if (error) {
      console.error("Error al actualizar rutina:", error);
      return;
    }

    // Actualizar en el estado local
    const updated = routines.map((r) =>
      r.id === id ? { ...r, ...dataToUpdate } : r
    );
    setRoutines(updated);
    setIsEditDialogOpen(false);
    setEditingRoutine(null);
  };

  const addExerciseToEdit = () => {
    if (!editingRoutine) return;
    setEditingRoutine({
      ...editingRoutine,
      exercises: [
        ...editingRoutine.exercises,
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

  const removeExerciseFromEdit = (index: number) => {
    if (!editingRoutine) return;
    const updatedExercises = editingRoutine.exercises.filter(
      (_, i) => i !== index
    );
    setEditingRoutine({ ...editingRoutine, exercises: updatedExercises });
  };

  const updateExerciseInEdit = (
    index: number,
    field: keyof Exercise,
    value: any
  ) => {
    if (!editingRoutine) return;
    const updated = [...editingRoutine.exercises];
    updated[index] = { ...updated[index], [field]: value };
    setEditingRoutine({ ...editingRoutine, exercises: updated });
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
      ["Dificultad:", routineHasNoDifficulty(routine) ? "No aplica" : routine.difficulty],
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

  const downloadRoutineAsPeriodExcel = (routine: Routine) => {
    const rows: string[][] = [
      ["RUTINA DE EJERCICIOS"],
      ["Nombre", routine.name],
      ["Período", routine.planCycle === "monthly" ? "Mensual (4 semanas)" : routine.planCycle === "biweekly" ? "Quincenal (2 semanas)" : "Semanal"],
      ["Vigente desde", routine.validFrom || "Sin fecha de inicio"],
      ["Vigente hasta", routine.validUntil || "Sin fecha de fin"],
      ["Duración estimada", `${routine.duration} minutos`],
    ];
    const weekCount = routine.planCycle === "monthly" ? 4 : routine.planCycle === "biweekly" ? 2 : 1;
    Array.from({ length: weekCount }, (_, weekIndex) => {
      const plan = routine.cyclePlan?.[`week_${weekIndex + 1}`] ?? routine.weeklyPlan;
      rows.push([""], [`SEMANA ${weekIndex + 1}`]);
      WEEK_DAYS.forEach((day) => {
        const sections = getDaySections(plan, day.key);
        if (!sections.length && weekIndex === 0 && day.key === "monday" && routine.exercises.length) sections.push({ id: "legacy", title: "Ejercicios", exercises: routine.exercises });
        if (!sections.length) return;
        rows.push([day.label.toUpperCase()]);
        sections.forEach((section, sectionIndex) => {
          rows.push([`SECCIÓN ${sectionIndex + 1}: ${section.title}`], ["#", "Ejercicio", "Series", "Repeticiones", "Peso", "Tiempo", "Notas"]);
          section.exercises.forEach((exercise, index) => rows.push([(index + 1).toString(), exercise.name, exercise.sets.toString(), exercise.reps, exercise.weight, exercise.rest, exercise.notes]));
        });
      });
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rutina-${routine.name.toLowerCase().replace(/\s+/g, "-")}-completa.csv`;
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

  const openDuplicateDialog = (routine: Routine) => {
    setDuplicatingRoutine(routine);
    setDuplicateMemberId("");
    setDuplicateMemberQuery("");
    setDuplicateName(`${routine.name} - copia`);
    setDuplicateDescription(routine.description);
    setDuplicateDuration(routine.duration);
    setDuplicateValidFrom(routine.validFrom ?? "");
    setDuplicateValidUntil(routine.validUntil ?? "");
    setDuplicateError(null);
  };

  const handleDuplicateRoutine = async () => {
    if (!duplicatingRoutine || !duplicateMemberId) {
      setDuplicateError("Elegí el socio al que querés asignar esta copia.");
      return;
    }

    const name = duplicateName.trim();
    if (!name) {
      setDuplicateError("Ingresá un nombre para la nueva rutina.");
      return;
    }
    if (duplicateValidFrom && duplicateValidUntil && duplicateValidUntil < duplicateValidFrom) {
      setDuplicateError("La fecha hasta no puede ser anterior a la fecha desde.");
      return;
    }

    setIsDuplicating(true);
    setDuplicateError(null);
    const copy: Routine = {
      ...duplicatingRoutine,
      id: `${Date.now()}`,
      name,
      description: duplicateDescription.trim(),
      duration: duplicateDuration,
      targetAudience: "Rutina personalizada",
      memberId: duplicateMemberId,
      validFrom: duplicateValidFrom || null,
      validUntil: duplicateValidUntil || null,
      createdDate: new Date().toISOString().split("T")[0],
      createdBy: "Usuario Actual",
    };
    const { error } = await supabase.from("routines").insert({
      id: copy.id,
      gym_id: gymId,
      name: copy.name,
      description: copy.description,
      target_audience: copy.targetAudience,
      difficulty: copy.difficulty,
      duration: copy.duration,
      exercises: copy.exercises,
      weekly_plan: copy.weeklyPlan ?? {},
      member_id: copy.memberId,
      valid_from: copy.validFrom ?? null,
      valid_until: copy.validUntil ?? null,
      day_intensities: copy.dayIntensities ?? {},
      plan_cycle: copy.planCycle ?? "weekly",
      cycle_plan: copy.cyclePlan ?? {},
      created_date: copy.createdDate,
      created_by: copy.createdBy,
    });
    if (error) {
      console.error("Error al duplicar rutina:", error);
      setDuplicateError("No se pudo duplicar la rutina. Intentá nuevamente.");
    } else {
      setRoutines((current) => [...current, copy]);
      setDuplicatingRoutine(null);
    }
    setIsDuplicating(false);
  };

  if (isRoomMode) {
    return <RoutineRoomMode routines={routines} members={members} onExit={() => setIsRoomMode(false)} onEdit={(routine) => {
      const fullRoutine = routines.find((item) => item.id === routine.id);
      if (!fullRoutine) return;
      if (fullRoutine.weeklyPlan && Object.keys(fullRoutine.weeklyPlan).length) {
        setIsRoomMode(false);
        setEditingPersonalizedRoutine(fullRoutine);
        setIsPersonalizedDialogOpen(true);
        return;
      }
      setIsRoomMode(false);
      setEditingRoutine(fullRoutine);
      setIsEditDialogOpen(true);
    }} onRoutineOpened={(routine) => {
      const openedAt = new Date().toISOString();
      void supabase.from("routines").update({ last_opened_at: openedAt }).eq("id", routine.id).eq("gym_id", gymId);
    }} />;
  }

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
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.open(`/sala-admin/${gymId}`, "_blank", "noopener,noreferrer")}><MonitorUp className="mr-2 h-4 w-4" />Modo sala</Button><Dialog open={isPersonalizedDialogOpen} onOpenChange={(open) => { setIsPersonalizedDialogOpen(open); if (!open) setEditingPersonalizedRoutine(null); }}><DialogTrigger asChild><Button variant="secondary" onClick={() => setEditingPersonalizedRoutine(null)}><Dumbbell className="mr-2 h-4 w-4" />Rutina personalizada</Button></DialogTrigger><DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>{editingPersonalizedRoutine ? "Editar rutina personalizada" : "Crear rutina personalizada"}</DialogTitle><DialogDescription>Buscá el socio y planificá sus ejercicios por día.</DialogDescription></DialogHeader><PersonalizedRoutineBuilder key={editingPersonalizedRoutine?.id ?? "new"} gymId={gymId} members={members} initialRoutine={editingPersonalizedRoutine ? editingPersonalizedRoutine as CreatedPersonalizedRoutine : undefined} onCancel={() => setIsPersonalizedDialogOpen(false)} onSaved={(routine: CreatedPersonalizedRoutine) => { setRoutines((current) => editingPersonalizedRoutine ? current.map((item) => item.id === routine.id ? routine as Routine : item) : [...current, routine as Routine]); setIsPersonalizedDialogOpen(false); setEditingPersonalizedRoutine(null); }} /></DialogContent></Dialog><Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Rutina general
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
        </Dialog></div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="min-w-0 flex-1">
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
            <Select value={routineStatusFilter} onValueChange={setRoutineStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Vigentes</SelectItem>
                <SelectItem value="upcoming">Próximas</SelectItem>
                <SelectItem value="archived">Archivadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Routines Table */}
      <Card className="routine-list-card">
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
                <TableHead>Estado</TableHead>
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
                    {routineHasNoDifficulty(routine) ? <Badge className="border border-slate-300 bg-white text-slate-900 hover:bg-white">No aplica</Badge> : <Badge
                      className={`${getDifficultyColor(
                        routine.difficulty
                      )} text-white`}
                    >
                      {routine.difficulty}
                    </Badge>}
                  </TableCell>
                  <TableCell>{routine.duration} min</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Dumbbell className="h-4 w-4 mr-1" />
                      {routine.exercises.length}
                    </div>
                  </TableCell>
                  <TableCell>
                    {routineStatus(routine) === "active" ? <Badge className="bg-emerald-600 text-white">Vigente</Badge> : routineStatus(routine) === "upcoming" ? <Badge className="bg-blue-600 text-white">Próxima</Badge> : <Badge className="bg-slate-600 text-white">Archivada</Badge>}
                    {routine.validUntil ? <p className="mt-1 text-xs text-muted-foreground">Hasta {new Date(`${routine.validUntil}T00:00:00`).toLocaleDateString()}</p> : null}
                  </TableCell>
                  <TableCell>
                    {new Date(routine.createdDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
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
                        title="Copiar enlace para el socio"
                        onClick={() => void copyPublicRoutineLink(routine)}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" title={routine.publicLinkEnabled === false ? "Generar enlace nuevo" : "Desactivar enlace público"} onClick={() => void togglePublicRoutineLink(routine)}>
                        {routine.publicLinkEnabled === false ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Duplicar para otro socio"
                        onClick={() => openDuplicateDialog(routine)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline" // BOTON PARA EDITAR RUTINA
                        size="sm"
                        onClick={() => {
                          if (routine.memberId || routine.targetAudience === "Rutina personalizada") {
                            setEditingPersonalizedRoutine(routine);
                            setIsPersonalizedDialogOpen(true);
                          } else {
                            setEditingRoutine(routine);
                            setIsEditDialogOpen(true);
                          }
                        }}
                      >
                        ✏️
                      </Button>
                      <Button
                        variant="outline" //BOTON PARA ELIMINAR RUTINA
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

      <Dialog open={Boolean(duplicatingRoutine)} onOpenChange={(open) => { if (!open) setDuplicatingRoutine(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Duplicar rutina</DialogTitle>
            <DialogDescription>
              Se conservarán los ejercicios y el plan semanal. Elegí el socio que recibirá esta nueva copia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre de la nueva rutina</Label>
              <Input className="mt-2" value={duplicateName} onChange={(event) => setDuplicateName(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Objetivo u observaciones</Label><Textarea className="mt-2" value={duplicateDescription} onChange={(event) => setDuplicateDescription(event.target.value)} /></div>
              <div><Label>Duración estimada (minutos)</Label><Input className="mt-2" type="number" min="15" value={duplicateDuration} onChange={(event) => setDuplicateDuration(Number(event.target.value) || 0)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Vigente desde</Label><Input className="mt-2" style={{ color: "#0f172a", colorScheme: "light" }} type="date" value={duplicateValidFrom} onChange={(event) => setDuplicateValidFrom(event.target.value)} /></div>
              <div><Label>Vigente hasta (opcional)</Label><Input className="mt-2" style={{ color: "#0f172a", colorScheme: "light" }} type="date" min={duplicateValidFrom || undefined} value={duplicateValidUntil} onChange={(event) => setDuplicateValidUntil(event.target.value)} /></div>
            </div>
            <div>
              <Label>Buscar y elegir socio</Label>
              <Input className="mt-2" value={duplicateMemberQuery} onChange={(event) => { setDuplicateMemberQuery(event.target.value); setDuplicateMemberId(""); }} placeholder="Nombre, cédula, email o teléfono" />
              <div className={`mt-2 max-h-56 overflow-y-auto rounded-xl border ${duplicateMemberId ? "hidden" : ""}`}>
                {members.filter((member) => {
                  const query = duplicateMemberQuery.trim().toLowerCase();
                  return !query || [member.name, member.cedula, member.email, member.phone].filter(Boolean).join(" ").toLowerCase().includes(query);
                }).slice(0, 10).map((member) => {
                  const selected = duplicateMemberId === member.id;
                  return <button key={member.id} type="button" onClick={() => { setDuplicateMemberId(member.id); setDuplicateMemberQuery(member.name); }} className={`block w-full border-b px-3 py-3 text-left last:border-b-0 ${selected ? "bg-blue-700 text-white" : "hover:bg-accent"}`}>
                    <p className="font-semibold">{member.name}</p>
                    <p className={`text-xs ${selected ? "text-blue-100" : "text-muted-foreground"}`}>{member.cedula ? `Cédula: ${member.cedula}` : member.email || member.phone || "Sin datos adicionales"}</p>
                  </button>;
                })}
              </div>
            </div>
            {duplicateError ? <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{duplicateError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicatingRoutine(null)}>Cancelar</Button>
            <Button disabled={isDuplicating} onClick={() => void handleDuplicateRoutine()}><Copy className="mr-2 h-4 w-4" />{isDuplicating ? "Duplicando..." : "Duplicar rutina"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {routineHasNoDifficulty(viewingRoutine) ? <Badge className="ml-2 border border-slate-300 bg-white text-slate-900 hover:bg-white">No aplica</Badge> : <Badge
                    className={`${getDifficultyColor(
                      viewingRoutine.difficulty
                    )} text-white ml-2`}
                  >
                    {viewingRoutine.difficulty}
                  </Badge>}
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
                viewingRoutine && downloadRoutineAsPeriodExcel(viewingRoutine)
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Rutina</DialogTitle>
            <DialogDescription>
              Modifica la rutina y sus ejercicios.
            </DialogDescription>
          </DialogHeader>
          {editingRoutine && (
            <div className="grid gap-4 py-4">
              {/* Campos principales */}
              <Input
                placeholder="Nombre de la rutina"
                value={editingRoutine.name}
                onChange={(e) =>
                  setEditingRoutine({ ...editingRoutine, name: e.target.value })
                }
              />
              <Textarea
                placeholder="Descripción"
                value={editingRoutine.description}
                onChange={(e) =>
                  setEditingRoutine({
                    ...editingRoutine,
                    description: e.target.value,
                  })
                }
              />
              <div className="grid gap-2">
                <Label>Socio asignado</Label>
                <Select value={editingRoutine.memberId || "__general"} onValueChange={(value) => setEditingRoutine({ ...editingRoutine, memberId: value === "__general" ? null : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__general">Rutina general (sin socio)</SelectItem>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Lista editable de ejercicios */}
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label>Ejercicios</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExerciseToEdit}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Ejercicio
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="bg-slate-950 text-left text-xs uppercase tracking-wider text-slate-300">
                        <tr>
                          <th className="w-12 px-3 py-3 text-center font-semibold">#</th>
                          <th className="min-w-[220px] px-3 py-3 font-semibold">Ejercicio</th>
                          <th className="w-24 px-3 py-3 font-semibold">Series</th>
                          <th className="w-32 px-3 py-3 font-semibold">Repeticiones</th>
                          <th className="w-28 px-3 py-3 font-semibold">Peso</th>
                          <th className="w-28 px-3 py-3 font-semibold">Tiempo</th>
                          <th className="min-w-[180px] px-3 py-3 font-semibold">Notas</th>
                          <th className="w-12 px-3 py-3"><span className="sr-only">Eliminar</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {editingRoutine.exercises.map((exercise, index) => (
                          <tr key={index} className="transition-colors hover:bg-blue-50/50">
                            <td className="px-3 py-2 text-center"><span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">{index + 1}</span></td>
                            <td className="p-2"><input className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Nombre del ejercicio" value={exercise.name} onChange={(event) => updateExerciseInEdit(index, "name", event.target.value)} /></td>
                            <td className="p-2"><input className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" type="number" placeholder="Series" value={exercise.sets} onChange={(event) => updateExerciseInEdit(index, "sets", Number(event.target.value))} /></td>
                            <td className="p-2"><input className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Reps" value={exercise.reps} onChange={(event) => updateExerciseInEdit(index, "reps", event.target.value)} /></td>
                            <td className="p-2"><input className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Peso" value={exercise.weight} onChange={(event) => updateExerciseInEdit(index, "weight", event.target.value)} /></td>
                            <td className="p-2"><input className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Tiempo" value={exercise.rest} onChange={(event) => updateExerciseInEdit(index, "rest", event.target.value)} /></td>
                            <td className="p-2"><input className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Notas" value={exercise.notes} onChange={(event) => updateExerciseInEdit(index, "notes", event.target.value)} /></td>
                            <td className="p-2 text-center"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeExerciseFromEdit(index)}><Trash2 className="h-4 w-4" /><span className="sr-only">Eliminar ejercicio</span></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="hidden">
                  {editingRoutine.exercises.map((exercise, index) => (
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
                            onClick={() => removeExerciseFromEdit(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Nombre del ejercicio"
                          value={exercise.name}
                          onChange={(e) =>
                            updateExerciseInEdit(index, "name", e.target.value)
                          }
                        />
                        <div className="grid grid-cols-4 gap-2">
                          <Input
                            type="number"
                            placeholder="Series"
                            value={exercise.sets}
                            onChange={(e) =>
                              updateExerciseInEdit(
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
                              updateExerciseInEdit(
                                index,
                                "reps",
                                e.target.value
                              )
                            }
                          />
                          <Input
                            placeholder="Peso"
                            value={exercise.weight}
                            onChange={(e) =>
                              updateExerciseInEdit(
                                index,
                                "weight",
                                e.target.value
                              )
                            }
                          />
                          <Input
                            placeholder="Descanso"
                            value={exercise.rest}
                            onChange={(e) =>
                              updateExerciseInEdit(
                                index,
                                "rest",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <Input
                          placeholder="Notas adicionales"
                          value={exercise.notes}
                          onChange={(e) =>
                            updateExerciseInEdit(index, "notes", e.target.value)
                          }
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Botón para guardar cambios */}
              <DialogFooter>
                <Button onClick={handleUpdateRoutine}>Guardar Cambios</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
