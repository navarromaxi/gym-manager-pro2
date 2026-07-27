"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Copy, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ClassTemplate } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const EMPTY_FORM = { title: "", weekday: "1", startTime: "18:00", duration: "60", capacity: "20", notes: "" };
type WeeklyOccurrence = { id: string; title: string; starts_at: string; ends_at: string; capacity: number; notes?: string | null };
const WEEK_DATE_FORMATTER = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long" });
const WEEK_TIME_FORMATTER = new Intl.DateTimeFormat("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
const WEEK_DAY_FORMATTER = new Intl.DateTimeFormat("es-UY", { weekday: "short", day: "numeric" });

function getWeekKey(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const weekDay = date.getDay() || 7;
  date.setDate(date.getDate() - weekDay + 1);
  return date.toDateString();
}

export function ClassManagement({ gymId }: { gymId: string }) {
  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weeklyClasses, setWeeklyClasses] = useState<WeeklyOccurrence[]>([]);
  const [weeklyReserved, setWeeklyReserved] = useState<Record<string, number>>({});
  const [selectedWeek, setSelectedWeek] = useState("");
  const publicUrl = useMemo(() => typeof window === "undefined" ? "" : `${window.location.origin}/clases/${gymId}`, [gymId]);

  const load = async () => {
    if (!gymId) return;
    setLoading(true);
    const { data, error } = await supabase.from("class_templates").select("*").eq("gym_id", gymId).order("weekday").order("start_time");
    if (error) setMessage("No se pudieron cargar las clases.");
    else setTemplates((data ?? []) as ClassTemplate[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [gymId]);

  const create = async (weekdays: number[]) => {
    if (!form.title.trim()) return setMessage("Ingresa un nombre para la clase.");
    setSaving(true);
    setMessage(null);
    const rows = weekdays.map((weekday) => ({
      gym_id: gymId,
      title: form.title.trim(),
      weekday,
      start_time: form.startTime,
      duration_minutes: Number(form.duration),
      capacity: Number(form.capacity),
      notes: form.notes.trim() || null,
    }));
    const { data, error } = await supabase.from("class_templates").insert(rows).select();
    if (error) setMessage("No se pudo crear la clase. Revisa los datos e intenta nuevamente.");
    else {
      setTemplates((previous) => [...previous, ...((data ?? []) as ClassTemplate[])].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)));
      setForm(EMPTY_FORM);
      setMessage(weekdays.length > 1 ? "Se crearon 5 clases, de lunes a viernes." : "Clase semanal creada.");
    }
    setSaving(false);
  };

  const loadWeek = async () => {
    setWeekLoading(true);
    const response = await fetch(`/api/public-gyms/${gymId}/classes?days=21`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setMessage("No se pudo cargar la vista semanal.");
    else {
      const nextClasses = payload?.classes ?? [];
      setWeeklyClasses(nextClasses);
      setWeeklyReserved(payload?.reservedByOccurrence ?? {});
      setSelectedWeek((current) => current || (nextClasses[0] ? getWeekKey(nextClasses[0].starts_at) : ""));
    }
    setWeekLoading(false);
  };

  const availableWeeks = useMemo(() => [...new Set(weeklyClasses.map((item) => getWeekKey(item.starts_at)))].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()), [weeklyClasses]);
  const selectedWeekIndex = Math.max(availableWeeks.indexOf(selectedWeek), 0);
  const calendarDays = useMemo(() => {
    if (!selectedWeek) return [];
    const start = new Date(selectedWeek);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = date.toDateString();
      return { date, items: weeklyClasses.filter((item) => new Date(item.starts_at).toDateString() === dateKey) };
    });
  }, [selectedWeek, weeklyClasses]);

  const remove = async (template: ClassTemplate) => {
    if (!window.confirm(`¿Eliminar ${template.title}? Las próximas clases de este horario dejarán de generarse.`)) return;
    const { error } = await supabase.from("class_templates").delete().eq("id", template.id).eq("gym_id", gymId);
    if (error) return setMessage("No se pudo eliminar la clase.");
    setTemplates((previous) => previous.filter((item) => item.id !== template.id));
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-3xl font-bold tracking-tight">Clases</h2><p className="text-muted-foreground">Configura horarios semanales y deja que los socios reserven su lugar.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setIsWeekOpen(true); void loadWeek(); }}><CalendarDays className="mr-2 h-4 w-4" />Ver mi semana</Button><Button variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl).then(() => setMessage("Link público copiado."))}><Copy className="mr-2 h-4 w-4" />Copiar link público</Button></div></div>
    {message ? <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</p> : null}
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-blue-600" />Nuevo horario semanal</CardTitle></CardHeader><CardContent><form onSubmit={(event) => { event.preventDefault(); void create([Number(form.weekday)]); }} className="space-y-4"><div><Label>Nombre de la clase</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej.: Funcional" /></div><div className="grid grid-cols-2 gap-3"><div><Label>Día</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.weekday} onChange={(event) => setForm({ ...form, weekday: event.target.value })}>{DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></div><div><Label>Hora</Label><Input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></div><div><Label>Duración (minutos)</Label><Input min="15" max="480" type="number" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></div><div><Label>Cupos</Label><Input min="1" type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></div></div><div><Label>Notas (opcional)</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div><div className="grid gap-2"><Button disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? "Creando..." : "Agregar solo este día"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => void create([1, 2, 3, 4, 5])}><Copy className="mr-2 h-4 w-4" />Crear de lunes a viernes</Button><p className="text-xs text-muted-foreground">Esta opción copia el mismo horario cinco veces. Para el sábado, crea un horario separado.</p></div></form></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" />Horarios configurados</CardTitle></CardHeader><CardContent className="space-y-3">{loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : templates.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Aún no hay horarios. Crea el primero para habilitar reservas semanales.</p> : templates.map((template) => <div key={template.id} className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-semibold">{template.title}</p><p className="text-sm text-muted-foreground">{DAYS[template.weekday - 1]} · {template.start_time.slice(0, 5)} · {template.duration_minutes} min · {template.capacity} cupos</p>{template.notes ? <p className="mt-1 text-xs text-muted-foreground">{template.notes}</p> : null}</div><Button size="icon" variant="outline" onClick={() => void remove(template)} aria-label="Eliminar clase"><Trash2 className="h-4 w-4" /></Button></div>)}</CardContent></Card>
    </div>
    <Dialog open={isWeekOpen} onOpenChange={setIsWeekOpen}><DialogContent className="max-w-6xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-blue-600" />Mi semana de clases</DialogTitle><DialogDescription>Calendario semanal con cupos libres y reservas confirmadas.</DialogDescription></DialogHeader>{weekLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando agenda...</p> : !weeklyClasses.length ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aún no hay clases generadas para los próximos días.</p> : <div className="space-y-4"><div className="flex items-center justify-between rounded-xl border bg-slate-50 p-2"><Button type="button" size="sm" variant="ghost" disabled={selectedWeekIndex === 0} onClick={() => setSelectedWeek(availableWeeks[selectedWeekIndex - 1])}><ChevronLeft className="h-4 w-4" />Anterior</Button><p className="text-sm font-semibold capitalize text-slate-900">Semana del {WEEK_DATE_FORMATTER.format(new Date(selectedWeek))}</p><Button type="button" size="sm" variant="ghost" disabled={selectedWeekIndex >= availableWeeks.length - 1} onClick={() => setSelectedWeek(availableWeeks[selectedWeekIndex + 1])}>Siguiente<ChevronRight className="ml-1 h-4 w-4" /></Button></div><div className="grid grid-cols-7 gap-2">{calendarDays.map(({ date, items }) => <section key={date.toDateString()} className="min-w-0 overflow-hidden rounded-xl border bg-white"><div className="border-b bg-slate-100 px-2 py-2 text-center"><p className="text-xs font-bold capitalize text-slate-900">{WEEK_DAY_FORMATTER.format(date)}</p></div><div className="space-y-1.5 p-1.5">{items.length ? items.map((item) => { const used = weeklyReserved[item.id] ?? 0; const available = Math.max(item.capacity - used, 0); return <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2" title={item.notes ?? undefined}><p className="text-xs font-black tabular-nums text-slate-900">{WEEK_TIME_FORMATTER.format(new Date(item.starts_at))}</p><p className="truncate text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[11px] font-medium text-emerald-700">{available} libres</p><p className="text-[10px] text-slate-500">{used}/{item.capacity} usados</p></div>; }) : <p className="py-4 text-center text-[11px] text-slate-400">Sin clases</p>}</div></section>)}</div></div>}</DialogContent></Dialog>
  </div>;
}
