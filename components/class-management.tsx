"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Copy, Download, List, Plus, Trash2, Users } from "lucide-react";
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
type ClassReservation = { id: string; created_at: string; members: { name: string; email: string | null; phone: string | null; cedula: string | null } | null };
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

function upcomingWeekKey() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return getWeekKey(date);
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function ClassManagement({ gymId }: { gymId: string }) {
  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1]);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<ClassTemplate | null>(null);
  const [duplicateWeekdays, setDuplicateWeekdays] = useState<number[]>([]);
  const [duplicateForm, setDuplicateForm] = useState(EMPTY_FORM);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weeklyClasses, setWeeklyClasses] = useState<WeeklyOccurrence[]>([]);
  const [weeklyReserved, setWeeklyReserved] = useState<Record<string, number>>({});
  const [selectedWeek, setSelectedWeek] = useState("");
  const [rosterOccurrence, setRosterOccurrence] = useState<WeeklyOccurrence | null>(null);
  const [roster, setRoster] = useState<ClassReservation[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
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
    if (!weekdays.length) return setMessage("Selecciona al menos un día.");
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
      setSelectedWeekdays([1]);
      setMessage(weekdays.length > 1 ? `Se crearon ${weekdays.length} horarios semanales.` : "Clase semanal creada.");
    }
    setSaving(false);
  };

  const toggleWeekday = (weekday: number) => setSelectedWeekdays((current) => current.includes(weekday) ? current.filter((item) => item !== weekday) : [...current, weekday].sort((a, b) => a - b));

  const loadWeek = async () => {
    setWeekLoading(true);
    const response = await fetch(`/api/public-gyms/${gymId}/classes?days=35`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setMessage("No se pudo cargar la vista semanal.");
    else {
      const nextClasses = payload?.classes ?? [];
      setWeeklyClasses(nextClasses);
      setWeeklyReserved(payload?.reservedByOccurrence ?? {});
      setSelectedWeek((current) => current || upcomingWeekKey());
    }
    setWeekLoading(false);
  };

  const availableWeeks = useMemo(() => {
    const currentWeek = new Date(upcomingWeekKey());
    const nextWeeks = Array.from({ length: 4 }, (_, index) => {
      const week = new Date(currentWeek);
      week.setDate(currentWeek.getDate() + index * 7);
      return week.toDateString();
    });
    return [...new Set([...nextWeeks, ...weeklyClasses.map((item) => getWeekKey(item.starts_at))])]
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [weeklyClasses]);
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

  const openWeek = () => {
    setSelectedWeek(upcomingWeekKey());
    setIsWeekOpen(true);
    void loadWeek();
  };

  const loadRoster = async (occurrence: WeeklyOccurrence) => {
    setRosterOccurrence(occurrence);
    setRoster([]);
    setRosterLoading(true);
    const { data, error } = await supabase
      .from("class_reservations")
      .select("id, created_at, members(name, email, phone, cedula)")
      .eq("gym_id", gymId)
      .eq("occurrence_id", occurrence.id)
      .order("created_at", { ascending: true });
    if (error) setMessage("No se pudo cargar el listado de esta clase.");
    else setRoster((data ?? []) as unknown as ClassReservation[]);
    setRosterLoading(false);
  };

  const downloadRoster = () => {
    if (!rosterOccurrence) return;
    const headers = ["Nombre", "Cédula", "Email", "Teléfono", "Clase", "Fecha y hora de la clase", "Reserva creada el"];
    const classDate = `${WEEK_DATE_FORMATTER.format(new Date(rosterOccurrence.starts_at))} ${WEEK_TIME_FORMATTER.format(new Date(rosterOccurrence.starts_at))}`;
    const rows = roster.map((reservation) => [
      reservation.members?.name, reservation.members?.cedula, reservation.members?.email, reservation.members?.phone,
      rosterOccurrence.title, classDate,
      new Intl.DateTimeFormat("es-UY", { dateStyle: "short", timeStyle: "short" }).format(new Date(reservation.created_at)),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `listado-${rosterOccurrence.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${rosterOccurrence.starts_at.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (template: ClassTemplate) => {
    if (!window.confirm(`¿Eliminar ${template.title}? Las próximas clases de este horario dejarán de generarse.`)) return;
    const { error } = await supabase.from("class_templates").delete().eq("id", template.id).eq("gym_id", gymId);
    if (error) return setMessage("No se pudo eliminar la clase.");
    setTemplates((previous) => previous.filter((item) => item.id !== template.id));
  };

  const openDuplicate = (template: ClassTemplate) => {
    setDuplicatingTemplate(template);
    setDuplicateWeekdays([]);
    setDuplicateForm({
      title: template.title,
      weekday: String(template.weekday),
      startTime: template.start_time.slice(0, 5),
      duration: String(template.duration_minutes),
      capacity: String(template.capacity),
      notes: template.notes ?? "",
    });
  };

  const toggleDuplicateWeekday = (weekday: number) => {
    setDuplicateWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((item) => item !== weekday)
        : [...current, weekday].sort((a, b) => a - b)
    );
  };

  const duplicate = async () => {
    if (!duplicatingTemplate || !duplicateWeekdays.length) {
      return setMessage("Selecciona al menos un día para duplicar este horario.");
    }
    if (!duplicateForm.title.trim()) return setMessage("Ingresa un nombre para la clase.");
    setSaving(true);
    const rows = duplicateWeekdays.map((weekday) => ({
      gym_id: gymId,
      title: duplicateForm.title.trim(),
      weekday,
      start_time: duplicateForm.startTime,
      duration_minutes: Number(duplicateForm.duration),
      capacity: Number(duplicateForm.capacity),
      notes: duplicateForm.notes.trim() || null,
    }));
    const { data, error } = await supabase.from("class_templates").insert(rows).select();
    setSaving(false);
    if (error) return setMessage("No se pudieron duplicar los horarios. Intenta nuevamente.");
    setTemplates((previous) =>
      [...previous, ...((data ?? []) as ClassTemplate[])].sort(
        (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)
      )
    );
    setDuplicatingTemplate(null);
    setMessage(duplicateWeekdays.length === 1 ? "Horario duplicado." : "Se duplicó el horario en " + duplicateWeekdays.length + " días.");
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-3xl font-bold tracking-tight">Clases</h2><p className="text-muted-foreground">Configura horarios semanales y deja que los socios reserven su lugar.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={openWeek}><CalendarDays className="mr-2 h-4 w-4" />Ver mi semana</Button><Button variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl).then(() => setMessage("Link público copiado."))}><Copy className="mr-2 h-4 w-4" />Copiar link público</Button></div></div>
    {message ? <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</p> : null}
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-blue-600" />Nuevo horario semanal</CardTitle></CardHeader><CardContent><form onSubmit={(event) => { event.preventDefault(); void create(selectedWeekdays); }} className="space-y-4"><div><Label>Nombre de la clase</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej.: Funcional" /></div><div><Label>Días de la semana</Label><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{DAYS.map((day, index) => <button key={day} type="button" onClick={() => toggleWeekday(index + 1)} className={selectedWeekdays.includes(index + 1) ? "rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-bold text-white" : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"}>{day}</button>)}</div><p className="mt-2 text-xs text-muted-foreground">Marcá todos los días en que se repite este mismo horario.</p></div><div className="grid grid-cols-2 gap-3"><div><Label>Hora</Label><Input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></div><div><Label>Duración (minutos)</Label><Input min="15" max="480" type="number" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></div><div className="col-span-2"><Label>Cupos</Label><Input min="1" type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></div></div><div><Label>Notas (opcional)</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div><div className="grid gap-2"><Button disabled={saving || selectedWeekdays.length === 0}><Plus className="mr-2 h-4 w-4" />{saving ? "Creando..." : selectedWeekdays.length > 1 ? "Crear horarios seleccionados" : "Crear horario semanal"}</Button><p className="text-xs text-muted-foreground">Podés marcar, por ejemplo, martes y jueves: se crearán ambas clases a la misma hora, duración y cupos.</p></div></form></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" />Horarios configurados</CardTitle></CardHeader><CardContent className="space-y-3">{loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : templates.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Aún no hay horarios. Crea el primero para habilitar reservas semanales.</p> : templates.map((template) => <div key={template.id} className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-semibold">{template.title}</p><p className="text-sm text-muted-foreground">{DAYS[template.weekday - 1]} · {template.start_time.slice(0, 5)} · {template.duration_minutes} min · {template.capacity} cupos</p>{template.notes ? <p className="mt-1 text-xs text-muted-foreground">{template.notes}</p> : null}</div><Button size="icon" variant="outline" onClick={() => void remove(template)} aria-label="Eliminar clase"><Trash2 className="h-4 w-4" /></Button></div>)}</CardContent></Card>
    </div>
    <Dialog open={isWeekOpen} onOpenChange={setIsWeekOpen}><DialogContent className="max-w-6xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-blue-600" />Mi semana de clases</DialogTitle><DialogDescription>Calendario semanal con cupos libres y reservas confirmadas.</DialogDescription></DialogHeader>{weekLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando agenda...</p> : !weeklyClasses.length ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aún no hay clases generadas para los próximos días.</p> : <div className="space-y-4"><div className="grid grid-cols-[120px_1fr_120px] items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2"><Button type="button" size="sm" disabled={selectedWeekIndex === 0} className="bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500" onClick={() => setSelectedWeek(availableWeeks[selectedWeekIndex - 1])}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><p className="text-center text-sm font-bold capitalize text-slate-950">Semana del {WEEK_DATE_FORMATTER.format(new Date(selectedWeek))}</p><Button type="button" size="sm" disabled={selectedWeekIndex >= availableWeeks.length - 1} className="bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500" onClick={() => setSelectedWeek(availableWeeks[selectedWeekIndex + 1])}>Siguiente<ChevronRight className="ml-1 h-4 w-4" /></Button></div><div className="grid grid-cols-7 gap-2">{calendarDays.map(({ date, items }) => <section key={date.toDateString()} className="min-w-0 overflow-hidden rounded-xl border bg-white"><div className="border-b bg-slate-100 px-2 py-2 text-center"><p className="text-xs font-bold capitalize text-slate-900">{WEEK_DAY_FORMATTER.format(date)}</p></div><div className="space-y-1.5 p-1.5">{items.length ? items.map((item) => { const used = weeklyReserved[item.id] ?? 0; const available = Math.max(item.capacity - used, 0); return <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2" title={item.notes ?? undefined}><p className="text-xs font-black tabular-nums text-slate-900">{WEEK_TIME_FORMATTER.format(new Date(item.starts_at))}</p><p className="truncate text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[11px] font-medium text-emerald-700">{available} libres</p><p className="text-[10px] text-slate-500">{used}/{item.capacity} usados</p><Button type="button" size="sm" variant="outline" className="mt-2 h-7 w-full border-blue-200 bg-white px-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50" onClick={() => void loadRoster(item)}><List className="mr-1 h-3 w-3" />Ver listado</Button></div>; }) : <p className="py-4 text-center text-[11px] text-slate-400">Sin clases</p>}</div></section>)}</div></div>}</DialogContent></Dialog>
    <Dialog open={Boolean(rosterOccurrence)} onOpenChange={(open) => !open && setRosterOccurrence(null)}><DialogContent className="max-w-2xl border-slate-200 bg-white text-slate-950"><DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" />Listado de inscriptos</DialogTitle><DialogDescription>{rosterOccurrence ? <span className="capitalize">{rosterOccurrence.title} · {WEEK_DATE_FORMATTER.format(new Date(rosterOccurrence.starts_at))} · {WEEK_TIME_FORMATTER.format(new Date(rosterOccurrence.starts_at))}</span> : null}</DialogDescription></DialogHeader><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-600">{rosterLoading ? "Cargando..." : `${roster.length} ${roster.length === 1 ? "persona anotada" : "personas anotadas"}`}</p><Button type="button" variant="outline" disabled={rosterLoading || !roster.length} onClick={downloadRoster}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button></div>{rosterLoading ? <p className="py-8 text-center text-sm text-slate-500">Cargando listado...</p> : roster.length ? <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Cédula</th><th className="px-3 py-2">Contacto</th></tr></thead><tbody>{roster.map((reservation) => <tr key={reservation.id} className="border-t border-slate-100"><td className="px-3 py-3 font-semibold text-slate-900">{reservation.members?.name ?? "Socio"}<span className="mt-1 block text-xs font-normal text-slate-500">Se anotó {new Intl.DateTimeFormat("es-UY", { dateStyle: "short", timeStyle: "short" }).format(new Date(reservation.created_at))}</span></td><td className="px-3 py-3 text-slate-700">{reservation.members?.cedula ?? "—"}</td><td className="px-3 py-3 text-slate-700"><span className="block">{reservation.members?.email ?? "—"}</span><span className="block text-xs text-slate-500">{reservation.members?.phone ?? ""}</span></td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Todavía no hay personas anotadas a esta clase.</p>}</DialogContent></Dialog>
    {templates.length > 0 && <Card className="border-blue-100 bg-blue-50/50"><CardContent className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row"><p className="text-sm font-medium text-slate-700">¿Ya creaste un horario? Duplicalo y elegí los nuevos días.</p><div className="flex flex-wrap justify-center gap-2">{templates.map((template) => <Button key={template.id} variant="outline" className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50" onClick={() => openDuplicate(template)}><Copy className="mr-2 h-4 w-4" />Duplicar {template.title}</Button>)}</div></CardContent></Card>}
    <Dialog open={Boolean(duplicatingTemplate)} onOpenChange={(open) => !open && setDuplicatingTemplate(null)}><DialogContent className="max-w-2xl border-blue-100 bg-white text-slate-950"><DialogHeader><DialogTitle className="flex items-center gap-2 text-slate-950"><Copy className="h-5 w-5 text-blue-600" />Duplicar horario semanal</DialogTitle><DialogDescription className="text-slate-600">Elegí los nuevos días. Podés editar los valores antes de confirmar.</DialogDescription></DialogHeader><div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div><Label className="text-slate-800">Nombre de la clase</Label><Input value={duplicateForm.title} onChange={(event) => setDuplicateForm({ ...duplicateForm, title: event.target.value })} className="mt-2 h-11 rounded-xl border-2 border-blue-200 bg-white px-3 text-slate-950" /></div><div><Label className="text-slate-800">Hora</Label><Input type="time" value={duplicateForm.startTime} onChange={(event) => setDuplicateForm({ ...duplicateForm, startTime: event.target.value })} className="mt-2 h-11 rounded-xl border-2 border-blue-200 bg-white px-3 text-slate-950" /></div><div><Label className="text-slate-800">Duración (minutos)</Label><Input min="15" max="480" type="number" value={duplicateForm.duration} onChange={(event) => setDuplicateForm({ ...duplicateForm, duration: event.target.value })} className="mt-2 h-11 rounded-xl border-2 border-blue-200 bg-white px-3 text-slate-950" /></div><div><Label className="text-slate-800">Cupos</Label><Input min="1" type="number" value={duplicateForm.capacity} onChange={(event) => setDuplicateForm({ ...duplicateForm, capacity: event.target.value })} className="mt-2 h-11 rounded-xl border-2 border-blue-200 bg-white px-3 text-slate-950" /></div></div><div><Label className="text-slate-800">Duplicar en estos días</Label><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{DAYS.map((day, index) => { const weekday = index + 1; const isOriginal = weekday === duplicatingTemplate?.weekday; const selected = duplicateWeekdays.includes(weekday); return <button key={day} type="button" disabled={isOriginal} onClick={() => toggleDuplicateWeekday(weekday)} className={isOriginal ? "cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400" : selected ? "rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-bold text-white" : "rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-blue-50"}>{day}{isOriginal ? " (original)" : ""}</button>; })}</div></div><div><Label className="text-slate-800">Notas (opcional)</Label><Textarea value={duplicateForm.notes} onChange={(event) => setDuplicateForm({ ...duplicateForm, notes: event.target.value })} className="mt-2 rounded-xl border-2 border-blue-200 bg-white text-slate-950" /></div><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><Button variant="outline" className="border-slate-300 bg-white text-slate-800" onClick={() => setDuplicatingTemplate(null)}>Cancelar</Button><Button disabled={saving || !duplicateWeekdays.length} className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void duplicate()}><Copy className="mr-2 h-4 w-4" />{saving ? "Duplicando..." : duplicateWeekdays.length > 1 ? "Duplicar en " + duplicateWeekdays.length + " días" : "Duplicar horario"}</Button></div></div></DialogContent></Dialog>
  </div>;
}
