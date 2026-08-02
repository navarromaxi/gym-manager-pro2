"use client";

import { useEffect, useState } from "react";
import { Dumbbell, ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { LinkifiedText } from "@/features/routines/components/linkified-text";
import { WEEK_DAYS, getDayExercises, getDaySections, type WeeklyPlan } from "@/features/routines/routine-plan";

type Exercise = { name: string; sets: number; reps: string; weight: string; rest: string; notes: string; videoUrl?: string };
type Routine = { name: string; description: string; duration: number; memberName: string | null; exercises: Exercise[]; weeklyPlan: WeeklyPlan; dayIntensities: Record<string, "green" | "yellow" | "red">; planCycle: "weekly" | "biweekly" | "monthly"; cyclePlan: Record<string, WeeklyPlan>; validFrom: string | null; validUntil: string | null };
type Payload = { gym: { name: string | null; logoUrl: string | null }; routine: Routine };

export default function PublicRoutinePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [message, setMessage] = useState("Cargando rutina...");
  const [dayIndex, setDayIndex] = useState(0);
  const [weekIndex, setWeekIndex] = useState(0);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/public-routines/${token}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) setMessage(data?.error ?? "No pudimos abrir esta rutina.");
        else { setPayload(data); setMessage(""); }
      })
      .catch(() => setMessage("No pudimos abrir esta rutina."));
  }, [token]);

  if (!payload) return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#eefbf6)] p-6"><div className="max-w-md rounded-3xl border border-white bg-white p-8 text-center shadow-xl"><Dumbbell className="mx-auto h-9 w-9 text-blue-600" /><h1 className="mt-4 text-xl font-black text-slate-950">Rutina personal</h1><p className="mt-2 text-slate-600">{message}</p></div></main>;

  const { gym, routine } = payload;
  const weekCount = routine.planCycle === "monthly" ? 4 : routine.planCycle === "biweekly" ? 2 : 1;
  const plan = routine.cyclePlan[`week_${weekIndex + 1}`] ?? routine.weeklyPlan;
  const activeDay = WEEK_DAYS[dayIndex];
  const exercises = getDayExercises(plan, activeDay.key).length ? getDayExercises(plan, activeDay.key) : dayIndex === 0 ? routine.exercises : [];
  const sections = getDaySections(plan, activeDay.key).length ? getDaySections(plan, activeDay.key) : exercises.length ? [{ id: "legacy", title: "Ejercicios", exercises }] : [];
  const dayClass = (key: string, active: boolean) => {
    const intensity = routine.dayIntensities[`week_${weekIndex + 1}:${key}`] ?? (weekIndex === 0 ? routine.dayIntensities[key] : undefined);
    if (intensity === "green") return "border-emerald-300 bg-emerald-600 text-white";
    if (intensity === "yellow") return "border-amber-200 bg-amber-400 text-slate-950";
    if (intensity === "red") return "border-rose-300 bg-rose-600 text-white";
    return active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300";
  };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#eefbf6)] px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-6xl">
    <header className="mb-7 text-center">{gym.logoUrl ? <img src={gym.logoUrl} alt={`Logo de ${gym.name ?? "gimnasio"}`} className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-white bg-white object-contain p-1 shadow-sm" /> : <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm"><Dumbbell className="h-8 w-8" /></span>}<p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">Plan de entrenamiento</p>{gym.name ? <p className="mt-2 text-lg font-bold text-slate-700">{gym.name}</p> : null}</header>
    <article className="public-routine-card overflow-hidden rounded-3xl border border-white bg-white shadow-[0_18px_45px_rgba(15,23,42,0.1)]">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7"><div>{routine.memberName ? <p className="font-bold text-blue-700">{routine.memberName}</p> : null}<h1 className="mt-1 text-3xl font-black text-slate-950">{routine.name}</h1>{routine.description ? <p className="mt-2 max-w-2xl text-slate-600">{routine.description}</p> : null}{routine.validUntil ? <p className="mt-3 text-sm font-medium text-slate-500">Vigente hasta {new Date(`${routine.validUntil}T00:00:00`).toLocaleDateString("es-UY")}</p> : null}</div><span className="w-fit rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-700">{routine.duration} min</span></div>
      {weekCount > 1 ? <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 p-3"><span className="px-2 text-sm font-bold text-slate-600">Semana:</span>{Array.from({ length: weekCount }, (_, index) => <button key={index} type="button" onClick={() => setWeekIndex(index)} className={`rounded-lg px-3 py-2 text-sm font-bold ${weekIndex === index ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-blue-50"}`}>Semana {index + 1}</button>)}</div> : null}
      <div className="overflow-x-auto border-b bg-slate-50 p-2"><div className="flex min-w-max gap-1">{WEEK_DAYS.map((day, index) => { const count = getDayExercises(plan, day.key).length || (index === 0 ? routine.exercises.length : 0); return <button type="button" key={day.key} onClick={() => setDayIndex(index)} className={`min-w-[96px] rounded-xl border px-3 py-2 text-left transition ${dayClass(day.key, dayIndex === index)}`}><span className="block text-sm font-bold">{day.label}</span><span className="block text-xs opacity-80">{count} {count === 1 ? "ejercicio" : "ejercicios"}</span></button>; })}</div></div>
      <div className="p-5 sm:p-7"><div className="mb-4"><h2 className="text-xl font-black text-slate-950">Plan de {activeDay.label}</h2><p className="text-sm text-slate-600">{exercises.length ? `${exercises.length} ejercicios programados` : "Sin ejercicios programados"}</p></div>{exercises.length ? <div className="overflow-hidden rounded-2xl border border-slate-200">{sections.map((section, sectionIndex) => <section key={section.id} className="border-b last:border-b-0"><div className="bg-slate-950 px-4 py-2.5 text-white"><span className="mr-2 rounded bg-blue-500/30 px-2 py-0.5 text-xs font-bold">SECCIÓN {sectionIndex + 1}</span><span className="font-bold">{section.title}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Ejercicio</th><th className="px-4 py-3">Series</th><th className="px-4 py-3">Repeticiones</th><th className="px-4 py-3">Peso</th><th className="px-4 py-3">Tiempo</th><th className="px-4 py-3">Notas</th></tr></thead><tbody>{section.exercises.map((exercise, index) => <tr key={`${exercise.name}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3 font-bold text-slate-950">{exercise.videoUrl ? <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline-offset-2 hover:underline">{exercise.name}<ExternalLink className="h-3.5 w-3.5" /></a> : exercise.name}</td><td className="px-4 py-3 text-slate-600">{exercise.sets || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.reps || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.weight || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.rest || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.notes ? <LinkifiedText value={exercise.notes} /> : "-"}</td></tr>)}</tbody></table></div></section>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-600"><Dumbbell className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold">No hay ejercicios cargados para este día.</p></div>}</div>
    </article>
  </div></main>;
}
