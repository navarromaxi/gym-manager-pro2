"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Dumbbell, Search, UserRound } from "lucide-react";
import { useParams } from "next/navigation";
import { WEEK_DAYS, getDayExercises, type WeeklyPlan } from "@/features/routines/routine-plan";

type Exercise = { name: string; sets: number; reps: string; weight: string; rest: string; notes: string; videoUrl?: string };
type PublicRoutine = { id: string; name: string; description: string; duration: number; exercises: Exercise[]; weeklyPlan: WeeklyPlan };
type SearchResult = { member: { id: string; name: string }; routine: PublicRoutine };
type Gym = { name?: string | null; logoUrl?: string | null };

export default function RoomPage() {
  const { gymId = "" } = useParams<{ gymId: string }>();
  const [query, setQuery] = useState("");
  const [gym, setGym] = useState<Gym>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!gymId) return;
    void fetch(`/api/public-gyms/${gymId}`, { cache: "no-store" }).then((response) => response.json()).then((payload) => setGym(payload?.data ?? {})).catch(() => undefined);
  }, [gymId]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) { setMessage("Ingresá al menos 2 caracteres."); return; }
    setLoading(true); setMessage(""); setResults([]); setSelected(null);
    const response = await fetch(`/api/public-gyms/${gymId}/routines?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setMessage(payload?.error ?? "No pudimos realizar la búsqueda.");
    else { setGym(payload?.gym ?? {}); setResults(payload?.results ?? []); if (!(payload?.results ?? []).length) setMessage("No encontramos una rutina para ese socio."); }
    setLoading(false);
  };
  const openRoutine = (result: SearchResult) => { setSelected(result); setDayIndex(0); setMessage(""); };
  const activeDay = WEEK_DAYS[dayIndex];
  const exercises = selected ? (getDayExercises(selected.routine.weeklyPlan, activeDay.key).length ? getDayExercises(selected.routine.weeklyPlan, activeDay.key) : dayIndex === 0 ? selected.routine.exercises : []) : [];
  const countForDay = (index: number, key: string) => selected ? getDayExercises(selected.routine.weeklyPlan, key).length || (index === 0 ? selected.routine.exercises.length : 0) : 0;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_42%,_#eefbf6)] px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-6xl">
    <header className="mb-8 text-center">{gym.logoUrl ? <img src={gym.logoUrl} alt={`Logo de ${gym.name ?? "gimnasio"}`} className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-white bg-white object-contain p-1 shadow-sm" /> : <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm"><Dumbbell className="h-8 w-8" /></span>}<p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">Sala de entrenamiento</p>{gym.name ? <p className="mt-2 text-lg font-bold text-slate-700">{gym.name}</p> : null}<h1 className="mt-1 text-4xl font-black tracking-tight text-slate-950">Tu rutina</h1><p className="mt-3 text-slate-600">Buscá por tu nombre o cédula para consultar tu plan de entrenamiento.</p></header>
    {!selected ? <section className="mx-auto max-w-2xl rounded-3xl border border-white bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-7"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserRound className="h-5 w-5" /></span><div><h2 className="font-black text-slate-950">Encontrá tu rutina</h2><p className="text-sm text-slate-600">Ingresá tu nombre o cédula.</p></div></div><form onSubmit={search} className="mt-6 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Nombre o cédula" /></div><button disabled={loading} className="rounded-xl bg-blue-600 px-5 font-bold text-white transition hover:bg-blue-700 disabled:bg-blue-300">{loading ? "Buscando..." : "Buscar"}</button></form>{message ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-center text-sm font-medium text-slate-600">{message}</p> : null}{results.length ? <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">{results.map((result) => <button type="button" key={result.routine.id} onClick={() => openRoutine(result)} className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-b-0 transition hover:bg-blue-50"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Dumbbell className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-950">{result.member.name}</span><span className="block truncate text-sm text-slate-600">{result.routine.name}</span></span><span className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Abrir</span></button>)}</div> : null}</section> : <section><button type="button" onClick={() => { setSelected(null); setResults([]); setQuery(""); }} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-blue-700"><ArrowLeft className="h-4 w-4" />Nueva búsqueda</button><article className="overflow-hidden rounded-3xl border border-white bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]"><div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7"><div><p className="font-bold text-blue-700">{selected.member.name}</p><h2 className="mt-1 text-3xl font-black text-slate-950">{selected.routine.name}</h2>{selected.routine.description ? <p className="mt-2 max-w-2xl text-slate-600">{selected.routine.description}</p> : null}</div><span className="w-fit rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-700">{selected.routine.duration} min</span></div><div className="overflow-x-auto border-b bg-slate-50 p-2"><div className="flex min-w-max gap-1">{WEEK_DAYS.map((day, index) => { const active = index === dayIndex; const count = countForDay(index, day.key); return <button type="button" key={day.key} onClick={() => setDayIndex(index)} className={`min-w-[95px] rounded-xl px-3 py-2 text-left transition ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-950"}`}><span className="block text-sm font-bold">{day.label}</span><span className={`block text-xs ${active ? "text-blue-200" : "text-slate-400"}`}>{count} {count === 1 ? "ejercicio" : "ejercicios"}</span></button>; })}</div></div><div className="p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-black text-slate-950">Plan de {activeDay.label}</h3><p className="text-sm text-slate-600">{exercises.length ? `${exercises.length} ejercicios programados` : "Sin ejercicios programados"}</p></div></div>{exercises.length ? <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-950 text-left text-xs uppercase tracking-wider text-slate-300"><tr><th className="w-14 px-4 py-3">#</th><th className="min-w-[220px] px-4 py-3">Ejercicio</th><th className="px-4 py-3">Series</th><th className="px-4 py-3">Repeticiones</th><th className="px-4 py-3">Peso</th><th className="px-4 py-3">Tiempo</th><th className="min-w-[180px] px-4 py-3">Notas</th></tr></thead><tbody className="divide-y divide-slate-100">{exercises.map((exercise, index) => <tr key={`${exercise.name}-${index}`} className="hover:bg-blue-50/60"><td className="px-4 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">{index + 1}</span></td><td className="px-4 py-3 font-bold text-slate-950">{exercise.name || "Ejercicio sin nombre"}</td><td className="px-4 py-3 font-semibold text-slate-700">{exercise.sets || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.reps || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.weight || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.rest || "-"}</td><td className="px-4 py-3 text-slate-600">{exercise.notes ? <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">{exercise.notes}</span> : "-"}</td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-600"><Dumbbell className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold">No hay ejercicios cargados para este día.</p></div>}</div></article></section>}
  </div></main>;
}
