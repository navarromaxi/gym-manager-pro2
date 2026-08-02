"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Dumbbell, ExternalLink, RotateCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WEEK_DAYS, getDayExercises, getDaySections, type RoutineSection, type WeeklyPlan } from "@/features/routines/routine-plan";
import { LinkifiedText } from "@/features/routines/components/linkified-text";

type Exercise = { name: string; sets: number; reps: string; weight: string; rest: string; notes: string; videoUrl?: string };
export type RoomRoutine = { id: string; name: string; description: string; targetAudience: string; difficulty: string; duration: number; exercises: Exercise[]; memberId?: string | null; weeklyPlan?: WeeklyPlan; validFrom?: string | null; validUntil?: string | null; archivedAt?: string | null; dayIntensities?: Record<string, "green" | "yellow" | "red">; planCycle?: "weekly" | "biweekly" | "monthly"; cyclePlan?: Record<string, WeeklyPlan> };
type Member = { id: string; name: string };

export function RoutineRoomMode({ routines, members, onExit, onEdit, onRefresh, onRoutineOpened }: { routines: RoomRoutine[]; members: Member[]; onExit: () => void; onEdit?: (routine: RoomRoutine) => void; onRefresh?: () => void; onRoutineOpened?: (routine: RoomRoutine) => void }) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(3);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dayByRoutine, setDayByRoutine] = useState<Record<string, number>>({});
  const [weekByRoutine, setWeekByRoutine] = useState<Record<string, number>>({});

  const memberNames = useMemo(() => new Map(members.map((member) => [member.id, member.name])), [members]);
  const today = new Date().toLocaleDateString("en-CA");
  const personalized = useMemo(() => routines
    .filter((routine) => !routine.archivedAt && (!routine.memberId || ((!routine.validFrom || routine.validFrom <= today) && (!routine.validUntil || routine.validUntil >= today))))
    .map((routine) => ({ ...routine, memberName: memberNames.get(routine.memberId ?? "") ?? routine.name }))
    .sort((a, b) => a.memberName.localeCompare(b.memberName)), [memberNames, routines, today]);
  const visible = personalized.filter((routine) => `${routine.memberName} ${routine.name}`.toLowerCase().includes(search.toLowerCase()));
  const shownRoutines = visible.slice(0, visibleCount);
  const openRoutines = openIds.map((id) => personalized.find((routine) => routine.id === id)).filter((routine): routine is (typeof personalized)[number] => Boolean(routine));
  const activeRoutine = openRoutines.find((routine) => routine.id === activeId) ?? openRoutines[0] ?? null;
  const dayIndex = activeRoutine ? dayByRoutine[activeRoutine.id] ?? 0 : 0;
  const weekIndex = activeRoutine ? weekByRoutine[activeRoutine.id] ?? 0 : 0;
  const weekCount = activeRoutine?.planCycle === "monthly" ? 4 : activeRoutine?.planCycle === "biweekly" ? 2 : 1;
  const activePlan = activeRoutine?.cyclePlan?.[`week_${weekIndex + 1}`] ?? activeRoutine?.weeklyPlan;
  const setDayIndex = (nextDayIndex: number) => {
    if (activeRoutine) setDayByRoutine((current) => ({ ...current, [activeRoutine.id]: nextDayIndex }));
  };
  const activeDay = WEEK_DAYS[dayIndex];
  const activeExercises = activeRoutine ? (getDayExercises(activePlan, activeDay.key).length ? getDayExercises(activePlan, activeDay.key) : dayIndex === 0 ? activeRoutine.exercises : []) : [];

  const openRoutine = (routine: (typeof personalized)[number]) => {
    setOpenIds((current) => current.includes(routine.id) ? current : [...current, routine.id]);
    setActiveId(routine.id);
    onRoutineOpened?.(routine);
  };
  const closeRoutine = (id: string) => {
    setOpenIds((current) => {
      const next = current.filter((routineId) => routineId !== id);
      if (activeId === id) setActiveId(next[next.length - 1] ?? null);
      return next;
    });
  };
  const changeSearch = (value: string) => { setSearch(value); setVisibleCount(3); };
  const dayExerciseCount = (routine: (typeof personalized)[number], index: number, dayKey: string) => {
    const routineWeek = weekByRoutine[routine.id] ?? 0;
    const plan = routine.cyclePlan?.[`week_${routineWeek + 1}`] ?? routine.weeklyPlan;
    return getDayExercises(plan, dayKey).length || (index === 0 ? routine.exercises.length : 0);
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Rutinas</p><h2 className="mt-1 text-3xl font-black">Modo sala</h2><p className="mt-1 text-sm text-slate-300">Abri las rutinas necesarias y cambia entre ellas con las pestanas.</p></div>
      <div className="flex gap-2"><Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => onRefresh?.()}><RotateCw className="mr-2 h-4 w-4" />Actualizar</Button><Button variant="secondary" onClick={onExit}><ArrowLeft className="mr-2 h-4 w-4" />Gestionar rutinas</Button></div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
      <Card className="h-fit"><CardContent className="p-4">
        <div className="mb-4"><p className="font-bold">Rutinas disponibles</p><p className="text-sm text-muted-foreground">{personalized.length} rutinas cargadas</p></div>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Buscar socio o rutina" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>
        {visible.length ? <><div className="mt-3 overflow-hidden rounded-xl border">{shownRoutines.map((routine) => <div key={routine.id} className="flex min-h-16 items-center gap-3 border-b px-3 py-2.5 last:border-b-0"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{routine.memberName}</p><p className="truncate text-sm text-muted-foreground">{routine.name}</p></div><Button size="sm" variant={activeId === routine.id ? "default" : "outline"} onClick={() => openRoutine(routine)}>{openIds.includes(routine.id) ? "Abierta" : "Abrir"}</Button></div>)}</div>{visible.length > 3 ? <div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Mostrando {shownRoutines.length} de {visible.length}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={visibleCount <= 3} onClick={() => setVisibleCount((count) => Math.max(3, count - 3))}>Ver 3 menos</Button>{visibleCount < visible.length ? <Button size="sm" variant="outline" onClick={() => setVisibleCount((count) => count + 3)}>Ver 3 más</Button> : null}</div></div> : null}</> : <p className="mt-3 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No encontramos rutinas con esa búsqueda.</p>}
      </CardContent></Card>

      <section className="min-w-0">
        <div className="routine-room-tabs flex min-h-12 items-end gap-1 overflow-x-auto border-b"><div className="flex gap-1">{openRoutines.map((routine) => <button key={routine.id} onClick={() => setActiveId(routine.id)} className={`group flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2 text-sm font-bold transition ${activeRoutine?.id === routine.id ? "bg-background text-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}><span>{routine.memberName}</span><span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); closeRoutine(routine.id); }} onKeyDown={(event) => { if (event.key === "Enter") closeRoutine(routine.id); }} className="rounded p-0.5 hover:bg-muted"><X className="h-3.5 w-3.5" /></span></button>)}</div></div>
        {activeRoutine ? <Card className="rounded-tl-none"><CardContent className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-blue-700">{activeRoutine.memberName}</p><h3 className="mt-1 text-2xl font-black">{activeRoutine.name}</h3>{activeRoutine.description ? <p className="mt-2 text-muted-foreground">{activeRoutine.description}</p> : null}</div><div className="text-left sm:text-right"><p className="text-sm text-muted-foreground">Duracion estimada</p><p className="text-xl font-black">{activeRoutine.duration} min</p>{onEdit ? <Button size="sm" variant="outline" className="mt-3" onClick={() => onEdit(activeRoutine)}>Editar</Button> : null}</div></div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full border bg-muted px-3 py-1.5 text-muted-foreground">{activeRoutine.validFrom ? `Vigente desde ${new Date(`${activeRoutine.validFrom}T00:00:00`).toLocaleDateString()}` : "Vigente sin fecha de inicio"}</span><span className="rounded-full border bg-muted px-3 py-1.5 text-muted-foreground">{activeRoutine.validUntil ? `Hasta ${new Date(`${activeRoutine.validUntil}T00:00:00`).toLocaleDateString()}` : "Sin fecha de finalización"}</span></div>
          {weekCount > 1 ? <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-2"><span className="px-2 text-sm font-bold text-muted-foreground">Semana:</span>{Array.from({ length: weekCount }, (_, index) => <Button key={index} size="sm" variant={weekIndex === index ? "default" : "outline"} onClick={() => setWeekByRoutine((current) => ({ ...current, [activeRoutine.id]: index }))}>Semana {index + 1}</Button>)}</div> : null}
          <div className="mt-5 overflow-x-auto rounded-xl border bg-muted/30 p-1.5"><div className="flex min-w-max gap-1" role="tablist" aria-label="Dias de entrenamiento">{WEEK_DAYS.map((day, index) => { const count = dayExerciseCount(activeRoutine, index, day.key); const isActive = dayIndex === index; const intensity = activeRoutine.dayIntensities?.[`week_${weekIndex + 1}:${day.key}`] ?? (weekIndex === 0 ? activeRoutine.dayIntensities?.[day.key] : undefined); const intensityClass = intensity === "green" ? "border-emerald-300 bg-emerald-600 text-white" : intensity === "yellow" ? "border-amber-200 bg-amber-500 text-slate-950" : intensity === "red" ? "border-rose-300 bg-rose-600 text-white" : ""; return <button key={day.key} role="tab" aria-selected={isActive} onClick={() => setDayIndex(index)} className={`min-w-[88px] rounded-lg border px-3 py-2 text-left transition ${intensityClass || (isActive ? "bg-slate-950 text-white shadow-sm" : "border-transparent text-muted-foreground hover:bg-background hover:text-foreground")} ${isActive ? "ring-2 ring-white/80" : ""}`}><span className="block text-sm font-bold">{day.label}</span><span className={`block text-xs ${intensity ? (intensity === "yellow" ? "text-slate-800" : "text-white/90") : isActive ? "text-white/80" : "text-muted-foreground"}`}>{count} {count === 1 ? "ejercicio" : "ejercicios"}</span></button>; })}</div></div>
          <div className="mt-5 overflow-hidden rounded-xl border bg-background"><div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3"><div><p className="font-black">Plan de {activeDay.label}</p><p className="text-sm text-muted-foreground">{activeExercises.length ? `${activeExercises.length} ${activeExercises.length === 1 ? "ejercicio programado" : "ejercicios programados"}` : "Sin ejercicios programados"}</p></div><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{activeRoutine.duration} min</span></div>{activeExercises.length ? <SectionExerciseList sections={getDaySections(activePlan, activeDay.key)} legacyExercises={dayIndex === 0 ? activeRoutine.exercises : []} /> : <div className="p-8 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Dumbbell className="h-5 w-5" /></span><p className="mt-3 font-semibold">No hay ejercicios para {activeDay.label.toLowerCase()}.</p></div>}</div>
        </CardContent></Card> : null}
      </section>
    </div>
  </div>;
}

function SectionExerciseList({ sections, legacyExercises }: { sections: RoutineSection[]; legacyExercises: Exercise[] }) {
  const visibleSections = sections.length ? sections : legacyExercises.length ? [{ id: "legacy", title: "Ejercicios", exercises: legacyExercises }] : [];
  return <div className="divide-y">{visibleSections.map((section, sectionIndex) => <section key={section.id}><div className="flex items-center gap-2 bg-slate-950 px-4 py-2.5 text-white"><span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-bold">SECCIÓN {sectionIndex + 1}</span><h4 className="font-bold">{section.title}</h4></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="w-14 px-4 py-3">#</th><th className="min-w-[210px] px-4 py-3">Ejercicio</th><th className="px-4 py-3">Series</th><th className="px-4 py-3">Repeticiones</th><th className="px-4 py-3">Peso</th><th className="px-4 py-3">Tiempo</th><th className="min-w-[180px] px-4 py-3">Notas</th></tr></thead><tbody className="divide-y">{section.exercises.map((exercise, index) => <tr key={`${exercise.name}-${index}`}><td className="px-4 py-3.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">{index + 1}</span></td><td className="px-4 py-3.5 font-bold">{exercise.videoUrl ? <a className="inline-flex items-center gap-1 text-blue-700 underline-offset-2 hover:underline" href={exercise.videoUrl} target="_blank" rel="noreferrer">{exercise.name || "Ejercicio sin nombre"}<ExternalLink className="h-3.5 w-3.5" /></a> : exercise.name || "Ejercicio sin nombre"}</td><td className="px-4 py-3.5 font-semibold">{exercise.sets || "-"}</td><td className="px-4 py-3.5 text-muted-foreground">{exercise.reps || "-"}</td><td className="px-4 py-3.5 text-muted-foreground">{exercise.weight || "-"}</td><td className="px-4 py-3.5 text-muted-foreground">{exercise.rest || "-"}</td><td className="px-4 py-3.5 text-muted-foreground">{exercise.notes ? <span className="inline-block rounded-md bg-amber-50 px-2 py-1 text-amber-900"><LinkifiedText value={exercise.notes} /></span> : "-"}</td></tr>)}</tbody></table></div></section>)}</div>;
}
