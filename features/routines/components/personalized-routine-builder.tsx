"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WEEK_DAYS, blankExercises, createSection, emptyExercise, getDayExercises, getDaySections, normalizeWeeklyPlan, type RoutineExercise, type RoutineSection, type WeeklyPlan } from "@/features/routines/routine-plan";
import { ExerciseLibraryPicker, type LibraryExerciseOption } from "@/features/routines/components/exercise-library-picker";

export type RoutineMemberSearch = { id: string; name: string; cedula?: string | null; email?: string | null; phone?: string | null };
type LibraryExercise = LibraryExerciseOption;
export type CreatedPersonalizedRoutine = { id: string; name: string; description: string; targetAudience: string; difficulty: "Principiante" | "Intermedio" | "Avanzado"; duration: number; exercises: RoutineExercise[]; createdDate: string; createdBy: string; memberId: string; weeklyPlan: WeeklyPlan; validFrom?: string | null; validUntil?: string | null; dayIntensities?: Record<string, "green" | "yellow" | "red">; planCycle?: "weekly" | "biweekly" | "monthly"; cyclePlan?: Record<string, WeeklyPlan>; publicShareToken?: string | null; publicLinkEnabled?: boolean };
const inputClass = "border-slate-300 bg-white !text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const cellClass = "h-9 w-full rounded border border-slate-200 bg-white px-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export function PersonalizedRoutineBuilder({ gymId, members, initialRoutine, onSaved, onCancel }: { gymId: string; members: RoutineMemberSearch[]; initialRoutine?: CreatedPersonalizedRoutine; onSaved: (routine: CreatedPersonalizedRoutine) => void; onCancel: () => void }) {
  const [memberQuery, setMemberQuery] = useState("");
  const [member, setMember] = useState<RoutineMemberSearch | null>(() => initialRoutine ? members.find((item) => item.id === initialRoutine.memberId) ?? null : null);
  const [name, setName] = useState(initialRoutine?.name ?? "");
  const [description, setDescription] = useState(initialRoutine?.description ?? "");
  const [duration, setDuration] = useState(initialRoutine?.duration ?? 60);
  const [validFrom, setValidFrom] = useState(initialRoutine?.validFrom ?? "");
  const [validUntil, setValidUntil] = useState(initialRoutine?.validUntil ?? "");
  const [dayIntensities, setDayIntensities] = useState<Record<string, "green" | "yellow" | "red">>(initialRoutine?.dayIntensities ?? {});
  const [dayIndex, setDayIndex] = useState(0);
  const [planCycle, setPlanCycle] = useState<"weekly" | "biweekly" | "monthly">(initialRoutine?.planCycle ?? "weekly");
  const [weekIndex, setWeekIndex] = useState(0);
  const [cyclePlan, setCyclePlan] = useState<Record<string, WeeklyPlan>>(() => initialRoutine?.cyclePlan && Object.keys(initialRoutine.cyclePlan).length ? initialRoutine.cyclePlan : { week_1: initialRoutine?.weeklyPlan && Object.keys(initialRoutine.weeklyPlan).length ? normalizeWeeklyPlan(initialRoutine.weeklyPlan) : { monday: [createSection("Sección 1")] } });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyDays, setCopyDays] = useState<string[]>([]);
  const [copyWeeks, setCopyWeeks] = useState<number[]>([]);
  const day = WEEK_DAYS[dayIndex];
  const weekCount = planCycle === "monthly" ? 4 : planCycle === "biweekly" ? 2 : 1;
  const weekKey = `week_${weekIndex + 1}`;
  const weeklyPlan = cyclePlan[weekKey] ?? {};
  const setWeeklyPlan = (updater: WeeklyPlan | ((current: WeeklyPlan) => WeeklyPlan)) => setCyclePlan((current) => ({ ...current, [weekKey]: typeof updater === "function" ? updater(current[weekKey] ?? {}) : updater }));
  const sections = getDaySections(weeklyPlan, day.key);
  const matches = useMemo(() => { const q = memberQuery.trim().toLowerCase(); return !q || member ? [] : members.filter((item) => [item.name, item.cedula, item.email, item.phone].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 8); }, [member, memberQuery, members]);
  const setSections = (next: RoutineSection[]) => setWeeklyPlan((current) => ({ ...current, [day.key]: next }));
  const updateSection = (sectionIndex: number, changes: Partial<RoutineSection>) => setSections(sections.map((section, index) => index === sectionIndex ? { ...section, ...changes } : section));
  useEffect(() => {
    let cancelled = false;
    void supabase.from("exercise_library").select("id, name, category, instructions, video_url").eq("gym_id", gymId).eq("is_active", true).order("category").order("name").then(({ data, error: libraryError }) => {
      if (libraryError) console.warn("No se pudo cargar la biblioteca de ejercicios", libraryError);
      if (!cancelled && data) setLibraryExercises(data as LibraryExercise[]);
    });
    return () => { cancelled = true; };
  }, [gymId]);
  const updateCell = (sectionIndex: number, rowIndex: number, field: keyof RoutineExercise, value: string) => updateSection(sectionIndex, { exercises: sections[sectionIndex].exercises.map((row, index) => {
    if (index !== rowIndex) return row;
    if (field === "name") {
      const match = libraryExercises.find((item) => item.name.trim().toLowerCase() === value.trim().toLowerCase());
      if (!match) return { ...row, name: value, videoUrl: undefined };
      return {
        ...row,
        name: value,
        notes: match.video_url || match.instructions || "",
        videoUrl: match.video_url ?? undefined,
      };
    }
    return { ...row, [field]: field === "sets" ? Number(value) || 0 : value };
  }) });
  const changeDay = (direction: number) => { const next = (dayIndex + direction + WEEK_DAYS.length) % WEEK_DAYS.length; const nextDay = WEEK_DAYS[next]; setWeeklyPlan((current) => current[nextDay.key] ? current : { ...current, [nextDay.key]: [createSection("Sección 1")] }); setDayIndex(next); };
  const chooseMember = (next: RoutineMemberSearch) => { setMember(next); setMemberQuery(""); if (!name.trim()) setName(`Rutina de ${next.name}`); };
  const toggleCopyDay = (dayKey: string) => setCopyDays((current) => current.includes(dayKey) ? current.filter((key) => key !== dayKey) : [...current, dayKey]);
  const toggleCopyWeek = (targetWeekIndex: number) => setCopyWeeks((current) => current.includes(targetWeekIndex) ? current.filter((index) => index !== targetWeekIndex) : [...current, targetWeekIndex]);
  const copyToSelectedDays = () => {
    const clonedSections = () => sections.map((section, index) => ({ ...section, id: `${section.id}-${Date.now()}-${index}`, exercises: section.exercises.map((exercise) => ({ ...exercise })) }));
    const sourceWeek = weeklyPlan;
    const cloneWeek = () => Object.fromEntries(Object.entries(sourceWeek).map(([dayKey, value]) => [dayKey, getDaySections({ [dayKey]: value }, dayKey).map((section, index) => ({ ...section, id: `${section.id}-${Date.now()}-${dayKey}-${index}`, exercises: section.exercises.map((exercise) => ({ ...exercise })) }))]));
    setCyclePlan((current) => ({ ...current, [weekKey]: { ...sourceWeek, ...Object.fromEntries(copyDays.map((dayKey) => [dayKey, clonedSections()])) }, ...Object.fromEntries(copyWeeks.map((targetWeekIndex) => [`week_${targetWeekIndex + 1}`, cloneWeek()])) }));
    setDayIntensities((current) => {
      const next = { ...current };
      copyWeeks.forEach((targetWeekIndex) => WEEK_DAYS.forEach((item) => {
        const intensity = current[`${weekKey}:${item.key}`] ?? (weekIndex === 0 ? current[item.key] : undefined);
        if (intensity) next[`week_${targetWeekIndex + 1}:${item.key}`] = intensity;
      }));
      return next;
    });
    setCopyDays([]);
    setCopyWeeks([]);
    setIsCopyDialogOpen(false);
  };
  const save = async () => {
    if (!member) return setError("Selecciona el socio para esta rutina.");
    if (!name.trim()) return setError("Ingresa un nombre para la rutina.");
    setSaving(true); setError(null);
    const cleanPlan = (plan: WeeklyPlan) => Object.fromEntries(Object.entries(plan).map(([key, value]) => [key, getDaySections({ [key]: value }, key).map((section) => ({ ...section, title: section.title.trim() || "Sin título", exercises: section.exercises.filter((exercise) => exercise.name.trim()) })).filter((section) => section.exercises.length)]));
    const cleanedCyclePlan = Object.fromEntries(Object.entries(cyclePlan).map(([key, plan]) => [key, cleanPlan(plan)]));
    const cleanedPlan = cleanedCyclePlan.week_1 ?? {};
    if (validFrom && validUntil && validUntil < validFrom) return setError("La fecha hasta no puede ser anterior a la fecha desde.");
    const routine: CreatedPersonalizedRoutine = { id: initialRoutine?.id ?? `${Date.now()}`, name: name.trim(), description: description.trim(), targetAudience: "Rutina personalizada", difficulty: "Intermedio", duration, exercises: getDayExercises(cleanedPlan, "monday"), createdDate: initialRoutine?.createdDate ?? new Date().toISOString().slice(0, 10), createdBy: initialRoutine?.createdBy ?? "Usuario Actual", memberId: member.id, weeklyPlan: cleanedPlan, validFrom: validFrom || null, validUntil: validUntil || null, dayIntensities, planCycle, cyclePlan: cleanedCyclePlan };
    const payload = { name: routine.name, description: routine.description, target_audience: routine.targetAudience, difficulty: routine.difficulty, duration: routine.duration, exercises: routine.exercises, weekly_plan: routine.weeklyPlan, member_id: routine.memberId, valid_from: routine.validFrom, valid_until: routine.validUntil, day_intensities: routine.dayIntensities, plan_cycle: routine.planCycle, cycle_plan: routine.cyclePlan };
    const result = initialRoutine ? await supabase.from("routines").update(payload).eq("id", routine.id).eq("gym_id", gymId).select("public_share_token, public_link_enabled").single() : await supabase.from("routines").insert({ id: routine.id, gym_id: gymId, ...payload, created_date: routine.createdDate, created_by: routine.createdBy }).select("public_share_token, public_link_enabled").single();
    const saveError = result.error;
    if (result.data) { routine.publicShareToken = result.data.public_share_token ?? null; routine.publicLinkEnabled = result.data.public_link_enabled ?? true; }
    if (saveError) setError("No se pudo guardar la rutina. Revisa los datos e intenta nuevamente."); else onSaved(routine);
    setSaving(false);
  };

  return <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]"><section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><div><Label>Buscar socio</Label>{member ? <div className="mt-2 flex min-h-10 items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="min-w-0"><p className="truncate font-bold text-emerald-950">{member.name}</p><p className="truncate text-xs text-emerald-800">{member.cedula ? `Cédula: ${member.cedula}` : member.email ?? "Socio seleccionado"}</p></div><Button size="sm" variant="outline" onClick={() => setMember(null)}>Cambiar</Button></div> : <div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} className={`${inputClass} pl-9`} placeholder="Nombre, cédula, email o teléfono" />{matches.length ? <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{matches.map((item) => <button type="button" key={item.id} onClick={() => chooseMember(item)} className="block w-full border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-slate-50"><p className="font-semibold text-slate-950">{item.name}</p><p className="text-xs text-slate-600">{item.cedula ? `Cédula: ${item.cedula}` : item.email || item.phone || "Sin datos adicionales"}</p></button>)}</div> : null}</div>}</div><div><Label>Nombre de la rutina</Label><Input className={`mt-2 ${inputClass}`} style={{ color: "#0f172a" }} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Plan de fuerza" /></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><Label>Objetivo u observaciones (opcional)</Label><Textarea className={`mt-2 min-h-24 ${inputClass}`} style={{ color: "#0f172a" }} value={description} onChange={(event) => setDescription(event.target.value)} /></div><div><Label>Duración estimada (minutos)</Label><Input className={`mt-2 ${inputClass}`} style={{ color: "#0f172a" }} type="number" min="15" value={duration} onChange={(event) => setDuration(Number(event.target.value) || 0)} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Vigente desde</Label><Input className={`mt-2 ${inputClass}`} style={{ color: "#0f172a", colorScheme: "light" }} type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></div><div><Label>Vigente hasta (opcional)</Label><Input className={`mt-2 ${inputClass}`} style={{ color: "#0f172a", colorScheme: "light" }} type="date" min={validFrom || undefined} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></div></div>
    </section><section className="overflow-hidden rounded-2xl border"><div className="flex items-center justify-between border-b bg-slate-950 p-3 text-white"><Button type="button" size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => changeDay(-1)}><ChevronLeft className="h-5 w-5" /></Button><div className="text-center"><select value={planCycle} onChange={(event) => { const next = event.target.value as "weekly" | "biweekly" | "monthly"; const nextCount = next === "monthly" ? 4 : next === "biweekly" ? 2 : 1; setPlanCycle(next); setWeekIndex(0); setCyclePlan((current) => Object.fromEntries(Array.from({ length: nextCount }, (_, index) => [`week_${index + 1}`, current[`week_${index + 1}`] ?? { monday: [createSection("Sección 1")] }]))); }} className="bg-transparent text-center text-xs font-bold uppercase tracking-[0.2em] text-blue-300 outline-none"><option value="weekly">Plan semanal</option><option value="biweekly">Plan quincenal</option><option value="monthly">Plan mensual</option></select>{weekCount > 1 ? <div className="mt-1 flex items-center justify-center gap-2"><button type="button" disabled={weekIndex === 0} onClick={() => setWeekIndex((current) => current - 1)} className="text-blue-200 disabled:opacity-30">‹</button><span className="text-sm font-bold">Semana {weekIndex + 1} de {weekCount}</span><button type="button" disabled={weekIndex === weekCount - 1} onClick={() => setWeekIndex((current) => current + 1)} className="text-blue-200 disabled:opacity-30">›</button></div> : null}<p className="text-xl font-black">{day.label}</p><div className="mt-2 flex flex-wrap justify-center gap-1"><button type="button" onClick={() => setDayIntensities((current) => ({ ...current, [`${weekKey}:${day.key}`]: "green" }))} className={`rounded-full px-2 py-1 text-xs font-bold ${(dayIntensities[`${weekKey}:${day.key}`] ?? (weekIndex === 0 ? dayIntensities[day.key] : undefined)) === "green" ? "bg-emerald-400 text-emerald-950 ring-2 ring-white" : "bg-emerald-950 text-emerald-200"}`}>Verde</button><button type="button" onClick={() => setDayIntensities((current) => ({ ...current, [`${weekKey}:${day.key}`]: "yellow" }))} className={`rounded-full px-2 py-1 text-xs font-bold ${(dayIntensities[`${weekKey}:${day.key}`] ?? (weekIndex === 0 ? dayIntensities[day.key] : undefined)) === "yellow" ? "bg-amber-300 text-amber-950 ring-2 ring-white" : "bg-amber-950 text-amber-200"}`}>Amarillo</button><button type="button" onClick={() => setDayIntensities((current) => ({ ...current, [`${weekKey}:${day.key}`]: "red" }))} className={`rounded-full px-2 py-1 text-xs font-bold ${(dayIntensities[`${weekKey}:${day.key}`] ?? (weekIndex === 0 ? dayIntensities[day.key] : undefined)) === "red" ? "bg-rose-400 text-rose-950 ring-2 ring-white" : "bg-rose-950 text-rose-200"}`}>Rojo</button></div></div><Button type="button" size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => changeDay(1)}><ChevronRight className="h-5 w-5" /></Button></div>
      <div className="space-y-4 p-3">{sections.map((section, sectionIndex) => <div key={section.id} className="overflow-hidden rounded-xl border"><div className="flex items-center gap-3 border-b bg-slate-50 px-3 py-2"><span className="text-xs font-bold text-slate-500">SECCIÓN {sectionIndex + 1}</span><input value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} className="min-w-0 flex-1 bg-transparent font-bold text-slate-950 outline-none" placeholder="Ej.: Movilidad" /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="w-10 px-2 py-3 text-center">#</th><th className="min-w-44 px-2 py-3">Ejercicio</th><th className="w-20 px-2 py-3">Series</th><th className="w-28 px-2 py-3">Repeticiones</th><th className="w-24 px-2 py-3">Peso</th><th className="w-28 px-2 py-3">Tiempo</th><th className="min-w-40 px-2 py-3">Notas</th><th className="w-10" /></tr></thead><tbody>{section.exercises.map((row, rowIndex) => <tr key={rowIndex} className="border-t"><td className="px-2 text-center text-slate-400">{rowIndex + 1}</td><td className="p-1"><ExerciseLibraryPicker value={row.name} exercises={libraryExercises} onSelect={(value) => updateCell(sectionIndex, rowIndex, "name", value)} /></td>{(["sets", "reps", "weight", "rest", "notes"] as (keyof RoutineExercise)[]).map((field) => <td key={field} className="p-1"><input value={row[field] || ""} onChange={(event) => updateCell(sectionIndex, rowIndex, field, event.target.value)} inputMode={field === "sets" ? "numeric" : undefined} className={cellClass} /></td>)}<td className="p-1 text-center"><button type="button" onClick={() => updateSection(sectionIndex, { exercises: section.exercises.filter((_, index) => index !== rowIndex) })} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><div className="border-t bg-slate-50 p-2"><Button type="button" variant="outline" size="sm" onClick={() => updateSection(sectionIndex, { exercises: [...section.exercises, emptyExercise()] })}><Plus className="mr-1 h-4 w-4" />Agregar fila</Button></div></div>)}<div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setSections([...sections, createSection(`Sección ${sections.length + 1}`)])}><Plus className="mr-1 h-4 w-4" />Agregar sección</Button><Button type="button" variant="outline" size="sm" onClick={() => { setCopyDays([]); setCopyWeeks([]); setIsCopyDialogOpen(true); }}>Llevar a otros días</Button></div><span className="text-xs text-slate-600">Elegí un ejercicio de la biblioteca o cargalo manualmente.</span></div></div>
    </section></div>
    {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}<div className="flex justify-end gap-3"><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Guardando..." : initialRoutine ? "Guardar cambios" : "Guardar rutina personalizada"}</Button></div>
    <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Replicar {day.label}</DialogTitle><DialogDescription>Elegí otros días de esta semana o, si corresponde, copiá la semana completa a las semanas siguientes. El contenido elegido será reemplazado.</DialogDescription></DialogHeader><div><p className="mb-2 text-sm font-bold">Otros días de esta semana</p><div className="grid grid-cols-2 gap-2">{WEEK_DAYS.filter((item) => item.key !== day.key).map((item) => <button key={item.key} type="button" onClick={() => toggleCopyDay(item.key)} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${copyDays.includes(item.key) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"}`}>{item.label}</button>)}</div></div>{weekCount > 1 ? <div className="mt-5 border-t pt-4"><p className="mb-1 text-sm font-bold">Copiar esta semana completa a</p><p className="mb-2 text-xs text-muted-foreground">Incluye todos los días y secciones configurados.</p><div className="flex flex-wrap gap-2">{Array.from({ length: weekCount }, (_, index) => index).filter((index) => index !== weekIndex).map((index) => <button key={index} type="button" onClick={() => toggleCopyWeek(index)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${copyWeeks.includes(index) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"}`}>Semana {index + 1}</button>)}</div></div> : null}<DialogFooter><Button variant="outline" onClick={() => setIsCopyDialogOpen(false)}>Cancelar</Button><Button disabled={!copyDays.length && !copyWeeks.length} onClick={copyToSelectedDays}>Replicar selección</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
