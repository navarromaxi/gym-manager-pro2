"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, Droplets, ExternalLink, HeartPulse, MapPin, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { LinkifiedText } from "@/features/routines/components/linkified-text";
import { WEEK_DAYS, getDayExercises, getDaySections, type WeeklyPlan } from "@/features/routines/routine-plan";

type Exercise = { name: string; sets: number; reps: string; weight: string; rest: string; notes: string; videoUrl?: string };
type Routine = { name: string; description: string; duration: number; memberName: string | null; exercises: Exercise[]; weeklyPlan: WeeklyPlan; dayIntensities: Record<string, "green" | "yellow" | "red">; planCycle: "weekly" | "biweekly" | "monthly"; cyclePlan: Record<string, WeeklyPlan>; validFrom: string | null; validUntil: string | null };
type Payload = { gym: { id: string; name: string | null; logoUrl: string | null }; routine: Routine };

export default function PublicRoutinePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [message, setMessage] = useState("Cargando rutina...");
  const [dayIndex, setDayIndex] = useState(0);
  const [weekIndex, setWeekIndex] = useState(0);
  const [tab, setTab] = useState<"routine" | "more">("routine");

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

  if (!payload) return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#eefbf6)] p-6"><div className="max-w-md rounded-3xl border border-white bg-white p-8 text-center shadow-xl"><Sparkles className="mx-auto h-9 w-9 text-blue-600" /><h1 className="mt-4 text-xl font-black text-slate-950">Tu espacio de entrenamiento</h1><p className="mt-2 text-slate-600">{message}</p></div></main>;

  const { gym, routine } = payload;
  const isOnlineTraining = gym.id === "entrenamiento_online";
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

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#eefbf6)] px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-col items-center gap-3 text-center">
      {gym.logoUrl ? <img src={gym.logoUrl} alt={`Logo de ${gym.name ?? "gimnasio"}`} className="h-14 w-14 rounded-2xl border border-white bg-white object-contain p-1 shadow-sm" /> : null}
      <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">{isOnlineTraining ? "Tu entrenamiento" : "Plan de entrenamiento"}</p>{gym.name ? <p className="mt-1 text-lg font-bold text-slate-700">{gym.name}</p> : null}</div>
      {isOnlineTraining ? <nav className="mt-2 inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Secciones de tu espacio"><button type="button" onClick={() => setTab("routine")} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === "routine" ? "bg-slate-950 text-white shadow" : "text-slate-500 hover:text-slate-950"}`}>Mi rutina</button><button type="button" onClick={() => setTab("more")} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === "more" ? "bg-slate-950 text-white shadow" : "text-slate-500 hover:text-slate-950"}`}>Mucho más</button></nav> : null}
    </header>

    {tab === "routine" ? <article className="public-routine-card overflow-hidden rounded-3xl border border-white bg-white shadow-[0_18px_45px_rgba(15,23,42,0.1)]">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7"><div>{routine.memberName ? <p className="font-bold text-blue-700">{routine.memberName}</p> : null}<h1 className="mt-1 text-3xl font-black text-slate-950">{routine.name}</h1>{routine.description ? <p className="mt-2 max-w-2xl text-slate-600">{routine.description}</p> : null}{routine.validUntil ? <p className="mt-3 text-sm font-medium text-slate-500">Vigente hasta {new Date(`${routine.validUntil}T00:00:00`).toLocaleDateString("es-UY")}</p> : null}</div><span className="w-fit rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-700">{routine.duration} min</span></div>
      {weekCount > 1 ? <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 p-3"><span className="px-2 text-sm font-bold text-slate-600">Semana:</span>{Array.from({ length: weekCount }, (_, index) => <button key={index} type="button" onClick={() => setWeekIndex(index)} className={`rounded-lg px-3 py-2 text-sm font-bold ${weekIndex === index ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-blue-50"}`}>Semana {index + 1}</button>)}</div> : null}
      <div className="overflow-x-auto border-b bg-slate-50 p-2"><div className="flex min-w-max gap-1">{WEEK_DAYS.map((day, index) => { const count = getDayExercises(plan, day.key).length || (index === 0 ? routine.exercises.length : 0); return <button type="button" key={day.key} onClick={() => setDayIndex(index)} className={`min-w-[96px] rounded-xl border px-3 py-2 text-left transition ${dayClass(day.key, dayIndex === index)}`}><span className="block text-sm font-bold">{day.label}</span><span className="block text-xs opacity-80">{count} {count === 1 ? "ejercicio" : "ejercicios"}</span></button>; })}</div></div>
      <div className="p-5 sm:p-7"><div className="mb-4"><h2 className="text-xl font-black text-slate-950">Plan de {activeDay.label}</h2><p className="text-sm text-slate-600">{exercises.length ? `${exercises.length} ejercicios programados` : "Sin ejercicios programados"}</p></div>{exercises.length ? <div className="overflow-hidden rounded-2xl border border-slate-200">{sections.map((section, sectionIndex) => <section key={section.id} className="border-b last:border-b-0"><div className="bg-slate-950 px-4 py-2.5 text-white"><span className="mr-2 rounded bg-blue-500/30 px-2 py-0.5 text-xs font-bold">SECCIÓN {sectionIndex + 1}</span><span className="font-bold">{section.title}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Ejercicio</th><th className="px-4 py-3">Series</th><th className="px-4 py-3">Repeticiones</th><th className="px-4 py-3">Peso</th><th className="px-4 py-3">Tiempo</th><th className="px-4 py-3">Notas</th></tr></thead><tbody>{section.exercises.map((exercise, index) => <tr key={`${exercise.name}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3 font-bold text-slate-950">{exercise.videoUrl ? <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline-offset-2 hover:underline">{exercise.name}<ExternalLink className="h-3.5 w-3.5" /></a> : exercise.name}</td><td className="px-4 py-3 text-slate-600">{exercise.sets || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.reps || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.weight || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.rest || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.notes ? <LinkifiedText value={exercise.notes} /> : "-"}</td></tr>)}</tbody></table></div></section>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-600"><Sparkles className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold">No hay ejercicios cargados para este día.</p></div>}</div>
      {isOnlineTraining ? <div className="border-t bg-gradient-to-r from-blue-50 to-indigo-50 p-5 sm:px-7"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><p className="font-black text-slate-950">¿Querés revisar tu progreso?</p><p className="mt-1 text-sm text-slate-600">Agendá tu reunión con el profe para el próximo mes.</p></div><a href="/entrenamiento/entrenamiento_online/agenda" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><CalendarCheck2 className="h-4 w-4" />Agendar mi reunión</a></div></div> : null}
    </article> : <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)] sm:p-9"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Tu espacio de beneficios</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Mucho más que una rutina.</h1><p className="mt-3 text-base leading-7 text-slate-300">Próximamente vas a encontrar beneficios, promociones y contenidos útiles seleccionados para acompañarte dentro y fuera del entrenamiento.</p></div><div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/10 p-4"><Sparkles className="h-5 w-5 text-cyan-200" /><p className="mt-3 font-bold">Beneficios exclusivos</p><p className="mt-1 text-sm text-slate-300">Descuentos y oportunidades para miembros.</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4"><MapPin className="h-5 w-5 text-cyan-200" /><p className="mt-3 font-bold">Aliados cerca tuyo</p><p className="mt-1 text-sm text-slate-300">Gimnasios y profesionales asociados.</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4"><HeartPulse className="h-5 w-5 text-cyan-200" /><p className="mt-3 font-bold">Bienestar simple</p><p className="mt-1 text-sm text-slate-300">Ideas prácticas para tu día a día.</p></div></div></div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Consejo de la semana</p><div className="mt-4 flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Droplets className="h-6 w-6" /></span><div><h2 className="text-xl font-black text-slate-950">Hidratación que acompaña tu entrenamiento</h2><p className="mt-2 leading-7 text-slate-600">Llevá agua contigo, tomá pequeños sorbos durante el día y aumentá el consumo cuando haya calor o sesiones más exigentes. Esta información es general y no sustituye la recomendación de un profesional de salud.</p></div></div></article><article className="rounded-3xl border border-dashed border-blue-300 bg-blue-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Próximamente</p><h2 className="mt-3 text-xl font-black text-slate-950">Promociones para vos</h2><p className="mt-2 leading-7 text-slate-600">Este espacio quedará preparado para mostrar beneficios reales de gimnasios, nutricionistas y marcas asociadas.</p><span className="mt-5 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700">Beneficios en preparación</span></article></div>
      <div className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between"><div><p className="font-black text-slate-950">Tu seguimiento también importa</p><p className="mt-1 text-sm text-slate-600">Reservá una reunión para conversar sobre tu próximo mes.</p></div><a href="/entrenamiento/entrenamiento_online/agenda" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 sm:mt-0"><CalendarCheck2 className="h-4 w-4" />Agendar mi reunión</a></div>
    </section>}
  </div></main>;
}
