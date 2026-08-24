"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Dumbbell, ExternalLink, Film, LayoutGrid, List, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ExerciseLibraryItem = {
  id: string;
  gym_id: string;
  name: string;
  category: string;
  instructions: string | null;
  video_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ExerciseDraft = {
  name: string;
  category: string;
  instructions: string;
  video_url: string;
};

const CATEGORY_OPTIONS = ["General", "Movilidad", "Fuerza", "Cardio", "Zona media", "Técnica", "Estiramiento"];
const EXERCISES_PER_PAGE = 9;
const emptyDraft = (): ExerciseDraft => ({ name: "", category: "General", instructions: "", video_url: "" });
const inputClass = "mt-1 border-slate-300 bg-white !text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-100";

function toDraft(item: ExerciseLibraryItem): ExerciseDraft {
  return {
    name: item.name,
    category: item.category || "General",
    instructions: item.instructions || "",
    video_url: item.video_url || "",
  };
}

export function ExerciseLibraryManagement({ gymId }: { gymId: string }) {
  const [items, setItems] = useState<ExerciseLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "archived">("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [visibleExerciseCount, setVisibleExerciseCount] = useState(EXERCISES_PER_PAGE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseLibraryItem | null>(null);
  const [deleting, setDeleting] = useState<ExerciseLibraryItem | null>(null);
  const [deletingExercise, setDeletingExercise] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExerciseDraft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!gymId) return;
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("exercise_library")
      .select("*")
      .eq("gym_id", gymId)
      .order("is_active", { ascending: false })
      .order("name");
    if (loadError) {
      console.error("Error loading exercise library", loadError);
      setError("La biblioteca todavía no está disponible. Ejecutá primero el SQL de configuración en Supabase.");
    } else {
      setItems((data ?? []) as ExerciseLibraryItem[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [gymId]);

  const categories = useMemo(() => Array.from(new Set([...CATEGORY_OPTIONS, ...items.map((item) => item.category).filter(Boolean)])).sort(), [items]);
  const allFilteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const textMatch = !normalized || [item.name, item.category, item.instructions].filter(Boolean).join(" ").toLowerCase().includes(normalized);
      const statusMatch = statusFilter === "all" || (statusFilter === "active" ? item.is_active : !item.is_active);
      const categoryMatch = categoryFilter === "all" || item.category === categoryFilter;
      return textMatch && statusMatch && categoryMatch;
    });
  }, [items, query, statusFilter, categoryFilter]);

  const filteredItems = allFilteredItems.slice(0, visibleExerciseCount);

  useEffect(() => {
    setVisibleExerciseCount(EXERCISES_PER_PAGE);
  }, [query, statusFilter, categoryFilter, gymId]);

  const activeCount = items.filter((item) => item.is_active).length;
  const videoCount = items.filter((item) => item.is_active && item.video_url).length;

  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setError(null); setDialogOpen(true); };
  const openEdit = (item: ExerciseLibraryItem) => { setEditing(item); setDraft(toDraft(item)); setError(null); setDialogOpen(true); };
  const setField = <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!draft.name.trim()) { setError("Ingresá el nombre del ejercicio."); return; }
    if (draft.video_url.trim() && !/^https?:\/\//i.test(draft.video_url.trim())) { setError("El enlace del video debe empezar con http:// o https://."); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      category: draft.category.trim() || "General",
      instructions: draft.instructions.trim() || null,
      video_url: draft.video_url.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from("exercise_library").update(payload).eq("id", editing.id).eq("gym_id", gymId).select("*").single()
      : await supabase.from("exercise_library").insert({ ...payload, gym_id: gymId }).select("*").single();
    if (result.error || !result.data) {
      console.error("Error saving exercise", result.error);
      setError("No pudimos guardar el ejercicio. Revisá los datos e intentá nuevamente.");
    } else {
      const saved = result.data as ExerciseLibraryItem;
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setMessage(editing ? "Ejercicio actualizado." : "Ejercicio agregado a la biblioteca.");
      setDialogOpen(false);
    }
    setSaving(false);
  };

  const toggleArchive = async (item: ExerciseLibraryItem) => {
    const nextActive = !item.is_active;
    const { error: archiveError } = await supabase.from("exercise_library").update({ is_active: nextActive, updated_at: new Date().toISOString() }).eq("id", item.id).eq("gym_id", gymId);
    if (archiveError) { setError("No pudimos actualizar el estado del ejercicio."); return; }
    setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, is_active: nextActive } : currentItem));
    setMessage(nextActive ? "Ejercicio restaurado en la biblioteca." : "Ejercicio archivado. Las rutinas existentes no se modifican.");
  };

  const deleteExercise = async () => {
    if (!deleting) return;
    setDeletingExercise(true);
    setDeleteError(null);
    const { data, error: deleteError } = await supabase
      .from("exercise_library")
      .delete()
      .eq("id", deleting.id)
      .eq("gym_id", gymId)
      .select("id")
      .maybeSingle();
    if (deleteError || !data) {
      setDeleteError("No pudimos eliminar el ejercicio. Verificá que tengas permisos para modificar esta biblioteca.");
      setDeletingExercise(false);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== deleting.id));
    setMessage("Ejercicio eliminado de la biblioteca. Las rutinas existentes no se modificaron.");
    setDeleting(null);
    setDeletingExercise(false);
  };
  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    setBulkDeleting(true);
    const { error: bulkDeleteError } = await supabase.from("exercise_library").delete().eq("gym_id", gymId).in("id", selectedIds);
    setBulkDeleting(false);
    if (bulkDeleteError) { setError("No pudimos eliminar los ejercicios seleccionados."); return; }
    setItems((current) => current.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]); setBulkDeleteOpen(false); setMessage("Ejercicios eliminados de la biblioteca. Las rutinas existentes no se modificaron.");
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Rutinas más rápidas</p><h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Biblioteca de ejercicios</h2><p className="mt-2 max-w-2xl text-slate-600">Cargá cada ejercicio una sola vez con sus indicaciones y video. Después estará listo para reutilizarlo en cualquier rutina.</p></div>
      <Button onClick={openCreate} className="bg-blue-600 text-white hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />Nuevo ejercicio</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="border-blue-100 bg-blue-50"><CardContent className="p-4"><p className="text-sm font-medium text-blue-700">Disponibles</p><p className="mt-1 text-3xl font-black text-blue-950">{activeCount}</p></CardContent></Card>
      <Card className="border-emerald-100 bg-emerald-50"><CardContent className="p-4"><p className="text-sm font-medium text-emerald-700">Con video</p><p className="mt-1 text-3xl font-black text-emerald-950">{videoCount}</p></CardContent></Card>
      <Card className="border-slate-200 bg-white"><CardContent className="p-4"><p className="text-sm font-medium text-slate-600">Archivados</p><p className="mt-1 text-3xl font-black text-slate-950">{items.length - activeCount}</p></CardContent></Card>
    </div>

    <Card className="border-slate-200 bg-white"><CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_190px_190px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="border-slate-300 bg-white pl-9 text-slate-950 placeholder:text-slate-400" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ejercicio, grupo muscular o equipamiento" /></div><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"><option value="active">Disponibles</option><option value="archived">Archivados</option><option value="all">Todos los estados</option></select></CardContent></Card>

    {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{message}</p> : null}
    {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{error}</p> : null}
    {!loading && !error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"><Button type="button" size="sm" variant={viewMode === "grid" ? "default" : "ghost"} onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "bg-blue-600 text-white hover:bg-blue-700" : "text-slate-600"}><LayoutGrid className="mr-1.5 h-4 w-4" />Tarjetas</Button><Button type="button" size="sm" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")} className={viewMode === "list" ? "bg-blue-600 text-white hover:bg-blue-700" : "text-slate-600"}><List className="mr-1.5 h-4 w-4" />Lista</Button></div>{viewMode === "list" && selectedIds.length ? <Button type="button" size="sm" onClick={() => setBulkDeleteOpen(true)} className="bg-rose-600 text-white hover:bg-rose-700"><Trash2 className="mr-1.5 h-4 w-4" />Eliminar {selectedIds.length} seleccionados</Button> : <p className="text-sm text-slate-500">{viewMode === "list" ? "Seleccioná ejercicios para una acción conjunta." : "Cambiá a lista para seleccionar varios ejercicios."}</p>}</div> : null}
    {loading ? <Card><CardContent className="p-8 text-center text-slate-500">Cargando biblioteca…</CardContent></Card> : null}
    {!loading && !error && filteredItems.length === 0 ? <Card className="border-dashed"><CardContent className="p-10 text-center"><Dumbbell className="mx-auto h-9 w-9 text-slate-300" /><h3 className="mt-3 font-bold text-slate-900">Todavía no hay ejercicios para mostrar</h3><p className="mt-1 text-sm text-slate-500">Empezá cargando los ejercicios que el profe usa más seguido.</p><Button className="mt-4" onClick={openCreate}>Agregar primer ejercicio</Button></CardContent></Card> : null}
    {!loading && !error && filteredItems.length && viewMode === "grid" ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredItems.map((item) => <Card key={item.id} className={!item.is_active ? "border-slate-200 bg-slate-50 opacity-75" : "border-slate-200 bg-white"}><CardHeader className="space-y-3 pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate text-xl text-slate-950">{item.name}</CardTitle><p className="mt-1 text-sm text-slate-500">Ejercicio reutilizable para tus rutinas</p></div><Badge className={item.is_active ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>{item.is_active ? item.category : "Archivado"}</Badge></div>{item.instructions ? <p className="line-clamp-2 text-sm text-slate-600">{item.instructions}</p> : <p className="text-sm italic text-slate-400">Sin indicaciones todavía.</p>}</CardHeader><CardContent><div className="flex flex-wrap gap-2 border-t pt-3">{item.video_url ? <Button asChild size="sm" variant="outline"><a href={item.video_url} target="_blank" rel="noreferrer"><Film className="mr-1.5 h-4 w-4" />Ver video<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button> : null}<Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="mr-1.5 h-4 w-4" />Editar</Button><Button size="sm" variant="ghost" className="text-slate-600 hover:bg-slate-100 hover:text-slate-950" onClick={() => void toggleArchive(item)}><Archive className="mr-1.5 h-4 w-4" />{item.is_active ? "Archivar" : "Restaurar"}</Button><Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setDeleting(item)}><Trash2 className="mr-1.5 h-4 w-4" />Eliminar</Button></div></CardContent></Card>)}</div> : null}
    {!loading && !error && filteredItems.length && viewMode === "list" ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{filteredItems.map((item) => <div key={item.id} className={`flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center ${!item.is_active ? "bg-slate-50 opacity-75" : ""}`}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Seleccionar ${item.name}`} className="h-4 w-4 accent-blue-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{item.name}</p><Badge className={item.is_active ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"}>{item.is_active ? item.category : "Archivado"}</Badge></div><p className="mt-1 truncate text-sm text-slate-600">{item.instructions || "Sin indicaciones todavía."}</p></div><div className="flex flex-wrap gap-2">{item.video_url ? <Button asChild size="sm" variant="outline"><a href={item.video_url} target="_blank" rel="noreferrer"><Film className="mr-1.5 h-4 w-4" />Video</a></Button> : null}<Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="mr-1.5 h-4 w-4" />Editar</Button><Button size="sm" variant="ghost" onClick={() => void toggleArchive(item)}>{item.is_active ? "Archivar" : "Restaurar"}</Button></div></div>)}</div> : null}
    {!loading && !error && allFilteredItems.length > EXERCISES_PER_PAGE ? <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row"><p className="text-sm font-medium text-slate-600">Mostrando {filteredItems.length} de {allFilteredItems.length} ejercicios</p><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" disabled={visibleExerciseCount <= EXERCISES_PER_PAGE} onClick={() => setVisibleExerciseCount((count) => Math.max(EXERCISES_PER_PAGE, count - EXERCISES_PER_PAGE))}>Ver 9 menos</Button>{visibleExerciseCount < allFilteredItems.length ? <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setVisibleExerciseCount((count) => count + EXERCISES_PER_PAGE)}>Ver 9 más</Button> : null}</div></div> : null}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-xl border-slate-200 bg-white"><DialogHeader><DialogTitle className="text-slate-950">{editing ? "Editar ejercicio" : "Nuevo ejercicio"}</DialogTitle><DialogDescription className="text-slate-600">Guardá solo lo que se repite: nombre, video e indicaciones. Series, carga y repeticiones se definen después en cada rutina.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="sm:col-span-2"><Label className="text-slate-900">Nombre del ejercicio</Label><Input className={inputClass} value={draft.name} onChange={(event) => setField("name", event.target.value)} placeholder="Ej.: Sentadilla goblet" autoFocus /></div><div><Label className="text-slate-900">Categoría</Label><select value={draft.category} onChange={(event) => setField("category", event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950">{categories.map((category) => <option key={category}>{category}</option>)}</select></div><div><Label className="text-slate-900">Enlace de video</Label><Input className={inputClass} value={draft.video_url} onChange={(event) => setField("video_url", event.target.value)} placeholder="https://youtube.com/..." /></div><div className="sm:col-span-2"><Label className="text-slate-900">Indicaciones</Label><Textarea className={inputClass} value={draft.instructions} onChange={(event) => setField("instructions", event.target.value)} placeholder="Técnica, puntos a cuidar o aclaraciones que se repetirán en las rutinas." /></div></div>{error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}<DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar a biblioteca"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !bulkDeleting && setBulkDeleteOpen(open)}><DialogContent className="max-w-md border-slate-200 bg-white"><DialogHeader><DialogTitle className="text-slate-950">¿Eliminar ejercicios seleccionados?</DialogTitle><DialogDescription className="text-slate-600">Vas a eliminar {selectedIds.length} ejercicios de la biblioteca. Las rutinas existentes no se modificarán.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={bulkDeleting} onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button><Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={bulkDeleting} onClick={() => void deleteSelected()}>{bulkDeleting ? "Eliminando…" : "Eliminar seleccionados"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !deletingExercise) { setDeleting(null); setDeleteError(null); } }}>
      <DialogContent className="max-w-md border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle className="text-slate-950">¿Eliminar ejercicio?</DialogTitle>
          <DialogDescription className="text-slate-600">Vas a eliminar <strong>{deleting?.name}</strong> de la biblioteca. Las rutinas que ya lo usan no se modificarán.</DialogDescription>
        </DialogHeader>
        {deleteError ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{deleteError}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={deletingExercise} onClick={() => { setDeleting(null); setDeleteError(null); }}>Cancelar</Button>
          <Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={deletingExercise} onClick={() => void deleteExercise()}>{deletingExercise ? "Eliminando…" : "Eliminar ejercicio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
