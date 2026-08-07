"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, CheckCircle2, ClipboardCopy, ClipboardList, Copy, ExternalLink, Loader2, Mail, Pencil, Phone, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { supabase, insertMemberWithFallback } from "@/lib/supabase";
import { PersonalizedRoutineBuilder, type CreatedPersonalizedRoutine, type RoutineMemberSearch } from "@/features/routines/components/personalized-routine-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type OnlineClient = {
  id: string; full_name: string; cedula: string; email: string; phone: string | null; source: string; status: string;
  intake: Record<string, unknown>; created_at: string; current_period_ends_at: string | null; internal_notes: string | null;
  linked_member_id: string | null; linked_routine_id: string | null;
};
type Appointment = { client_id: string; starts_at: string; status: string };
type RoutineInfo = { id: string; name: string; valid_from: string | null; valid_until: string | null; public_share_token: string | null; public_link_enabled: boolean | null; [key: string]: unknown };

const statusLabel: Record<string, string> = { pending_payment: "Pendiente de pago", active: "Activo", payment_due: "Pago próximo", grace: "En espera de pago", expired: "Vencido", cancelled: "Cancelado" };
const statusClass: Record<string, string> = { pending_payment: "bg-amber-100 text-amber-900", active: "bg-emerald-100 text-emerald-900", payment_due: "bg-blue-100 text-blue-900", grace: "bg-orange-100 text-orange-900", expired: "bg-rose-100 text-rose-900", cancelled: "bg-slate-200 text-slate-800" };
const dateLabel = (value?: string | null) => value ? new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" }) : null;

export function OnlineTrainingManagement({ gymId }: { gymId: string }) {
  const [clients, setClients] = useState<OnlineClient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [routinesByClient, setRoutinesByClient] = useState<Record<string, RoutineInfo[]>>({});
  const [price, setPrice] = useState(549);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [routineTarget, setRoutineTarget] = useState<{ client: OnlineClient; member: RoutineMemberSearch; initialRoutine?: CreatedPersonalizedRoutine; createAsNew?: boolean } | null>(null);
  const [routineSetupTarget, setRoutineSetupTarget] = useState<{ client: OnlineClient; member: RoutineMemberSearch } | null>(null);
  const [routineSetupMode, setRoutineSetupMode] = useState<"choose" | "copy">("choose");
  const [templateQuery, setTemplateQuery] = useState("");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null);
  const publicUrl = typeof window === "undefined" ? "" : `${window.location.origin}/entrenamiento/${gymId}`;

  const load = async () => {
    setLoading(true);
    const [configResult, clientsResult, appointmentsResult] = await Promise.all([
      supabase.from("online_training_config").select("monthly_price").eq("gym_id", gymId).maybeSingle(),
      supabase.from("online_training_clients").select("id, full_name, cedula, email, phone, source, status, intake, created_at, current_period_ends_at, internal_notes, linked_member_id, linked_routine_id").eq("gym_id", gymId).order("created_at", { ascending: false }),
      supabase.from("online_training_appointments").select("client_id, starts_at, status").eq("gym_id", gymId).eq("status", "confirmed").gte("starts_at", new Date().toISOString()).order("starts_at"),
    ]);
    if (configResult.error || clientsResult.error || appointmentsResult.error) {
      setMessage("No pudimos cargar los clientes. Verificá que el SQL de operación esté ejecutado.");
      setLoading(false); return;
    }
    const loadedClients = (clientsResult.data ?? []) as OnlineClient[];
    const clientByMemberId = new Map<string, string>();
    loadedClients.forEach((client) => {
      clientByMemberId.set(client.id, client.id);
      if (client.linked_member_id) clientByMemberId.set(client.linked_member_id, client.id);
    });
    const memberIds = [...clientByMemberId.keys()];
    const routineMap: Record<string, RoutineInfo[]> = Object.fromEntries(loadedClients.map((client) => [client.id, []]));
    if (memberIds.length) {
      const { data, error: routinesError } = await supabase
        .from("routines")
        .select("*")
        .eq("gym_id", gymId)
        .in("member_id", memberIds)
        .order("valid_from", { ascending: false, nullsFirst: false });
      if (routinesError) {
        setMessage("No pudimos cargar las rutinas de los clientes.");
      } else {
        ((data ?? []) as RoutineInfo[]).forEach((routine) => {
          const clientId = clientByMemberId.get(String((routine as Record<string, unknown>).member_id ?? ""));
          if (clientId) routineMap[clientId].push(routine);
        });
      }
    }
    setPrice(configResult.data?.monthly_price ?? 549);
    setClients(loadedClients);
    setAppointments((appointmentsResult.data ?? []) as Appointment[]);
    setRoutinesByClient(routineMap);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [gymId]);

  const updateClient = async (client: OnlineClient, update: Partial<OnlineClient>) => {
    const { error } = await supabase.from("online_training_clients").update(update).eq("id", client.id).eq("gym_id", gymId);
    if (error) return setMessage("No pudimos guardar ese cambio.");
    setClients((current) => current.map((item) => item.id === client.id ? { ...item, ...update } : item));
  };
  const nextAppointment = (clientId: string) => appointments.find((appointment) => appointment.client_id === clientId);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? clients.filter((client) => [client.full_name, client.cedula, client.email].some((value) => value.toLowerCase().includes(normalized))) : clients;
  }, [clients, query]);

  const copy = async (value: string, success: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(success); } catch { window.prompt("Copiá este enlace:", value); }
  };
  const startRoutine = async (client: OnlineClient) => {
    if (client.status !== "active" && client.status !== "payment_due") {
      setMessage("Primero marcá al cliente como activo o con pago próximo."); return;
    }
    setCreating(client.id);
    let member: RoutineMemberSearch = { id: client.linked_member_id ?? client.id, name: client.full_name, cedula: client.cedula, email: client.email, phone: client.phone };
    if (!client.linked_member_id) {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await insertMemberWithFallback({
        id: client.id, gym_id: gymId, name: client.full_name, cedula: client.cedula, email: client.email, phone: client.phone ?? "",
        referral_source: "Rutina online", join_date: today, plan: "Rutina personalizada online", plan_price: 0,
        last_payment: today, next_payment: client.current_period_ends_at?.slice(0, 10) ?? today, status: "active",
      });
      if (error) { setCreating(null); setMessage("No pudimos preparar el perfil del cliente para crear la rutina."); return; }
      await updateClient(client, { linked_member_id: member.id });
    }
    setRoutineSetupMode("choose");
    setTemplateQuery("");
    setRoutineSetupTarget({ client, member });
    setCreating(null);
  };
  const routineToBuilderInitial = (routine: RoutineInfo, member: RoutineMemberSearch): CreatedPersonalizedRoutine => {
    const raw = routine as Record<string, any>;
    return {
      id: routine.id,
      name: routine.name,
      description: String(raw.description ?? ""),
      targetAudience: String(raw.target_audience ?? "Rutina personalizada"),
      difficulty: raw.difficulty === "Principiante" || raw.difficulty === "Avanzado" ? raw.difficulty : "Intermedio",
      duration: Number(raw.duration ?? 60),
      exercises: Array.isArray(raw.exercises) ? raw.exercises : [],
      createdDate: String(raw.created_date ?? new Date().toISOString().slice(0, 10)),
      createdBy: String(raw.created_by ?? "Usuario Actual"),
      memberId: member.id,
      weeklyPlan: raw.weekly_plan ?? {},
      validFrom: raw.valid_from ?? null,
      validUntil: raw.valid_until ?? null,
      dayIntensities: raw.day_intensities ?? {},
      planCycle: raw.plan_cycle === "monthly" || raw.plan_cycle === "biweekly" ? raw.plan_cycle : "weekly",
      cyclePlan: raw.cycle_plan ?? {},
      publicShareToken: raw.public_share_token ?? null,
      publicLinkEnabled: raw.public_link_enabled ?? true,
    };
  };
  const editRoutine = (client: OnlineClient, routine: RoutineInfo) => {
    const member: RoutineMemberSearch = {
      id: String((routine as Record<string, any>).member_id ?? client.linked_member_id ?? client.id),
      name: client.full_name,
      cedula: client.cedula,
      email: client.email,
      phone: client.phone,
    };
    setRoutineTarget({ client, member, initialRoutine: routineToBuilderInitial(routine, member) });
  };
  const startBlankRoutine = () => {
    if (!routineSetupTarget) return;
    setRoutineTarget(routineSetupTarget);
    setRoutineSetupTarget(null);
  };
  const useRoutineAsTemplate = (sourceRoutine: RoutineInfo) => {
    if (!routineSetupTarget) return;
    const initialRoutine = routineToBuilderInitial(sourceRoutine, routineSetupTarget.member);
    initialRoutine.name = `${sourceRoutine.name} · ${routineSetupTarget.client.full_name}`;
    initialRoutine.validFrom = null;
    initialRoutine.validUntil = null;
    initialRoutine.publicShareToken = null;
    setRoutineTarget({ ...routineSetupTarget, initialRoutine, createAsNew: true });
    setRoutineSetupTarget(null);
  };
  const deleteRoutine = async (client: OnlineClient, routine: RoutineInfo) => {
    if (!window.confirm(`¿Eliminar la rutina "${routine.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingRoutineId(routine.id);
    const { error } = await supabase.from("routines").delete().eq("id", routine.id).eq("gym_id", gymId);
    if (error) {
      setMessage("No pudimos eliminar la rutina.");
      setDeletingRoutineId(null);
      return;
    }
    if (client.linked_routine_id === routine.id) {
      await updateClient(client, { linked_routine_id: null });
    }
    setDeletingRoutineId(null);
    setMessage("Rutina eliminada.");
    await load();
  };
  const onRoutineSaved = async (routine: CreatedPersonalizedRoutine) => {
    if (!routineTarget) return;
    const { error } = await supabase.from("online_training_clients").update({ linked_member_id: routine.memberId, linked_routine_id: routine.id }).eq("id", routineTarget.client.id).eq("gym_id", gymId);
    if (error) { setMessage("La rutina se guardó, pero no pudimos vincularla al cliente."); return; }
    setRoutineTarget(null); setMessage("Rutina entregada y vinculada al cliente."); await load();
  };
  const templateSources = useMemo(() => {
    const normalized = templateQuery.trim().toLowerCase();
    return clients
      .filter((client) => (routinesByClient[client.id] ?? []).length > 0)
      .filter((client) => !normalized || [client.full_name, client.cedula, client.email].some((value) => value.toLowerCase().includes(normalized)));
  }, [clients, routineSetupTarget?.client.id, routinesByClient, templateQuery]);
  const upcomingSchedule = useMemo(() => appointments
    .map((appointment) => ({ appointment, client: clients.find((client) => client.id === appointment.client_id) }))
    .filter((entry): entry is { appointment: Appointment; client: OnlineClient } => Boolean(entry.client))
    .sort((a, b) => new Date(a.appointment.starts_at).getTime() - new Date(b.appointment.starts_at).getTime()), [appointments, clients]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Portal privado</p>
        <h2 className="text-4xl font-bold tracking-tight text-slate-950">Gestión de entrenamiento</h2>
        <p className="text-slate-600">Clientes, entrevistas y rutinas en un solo lugar.</p>
        <div className="flex flex-wrap justify-center gap-2"><Button type="button" variant="outline" onClick={() => setIsScheduleOpen(true)} className="rounded-xl border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800"><CalendarDays className="mr-2 h-4 w-4" />Agenda de reuniones{upcomingSchedule.length ? ` (${upcomingSchedule.length})` : ""}</Button><Button onClick={() => void load()} disabled={loading} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button></div>
      </header>
      <Card className="rounded-3xl border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 text-slate-950 shadow-sm">
        <CardContent className="flex flex-col items-center justify-between gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div><p className="text-sm font-semibold text-slate-600">Plan mensual</p><p className="text-3xl font-bold text-slate-950">$ {price} UYU</p></div>
          <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => void copy(publicUrl, "Link de inscripción copiado.")} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"><ClipboardCopy className="mr-2 h-4 w-4" />Copiar inscripción</Button><a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border-2 border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"><ExternalLink className="mr-2 h-4 w-4" />Abrir pública</a></div>
        </CardContent>
      </Card>
      {message && <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center font-medium text-blue-900">{message}</p>}
      <Card className="rounded-3xl border-slate-200 bg-white text-slate-950 shadow-sm">
        <CardHeader className="items-center space-y-3 text-center"><CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><Users className="h-6 w-6 text-blue-600" />Clientes recibidos</CardTitle><CardDescription className="text-slate-600">Creá la rutina desde acá cuando el pago esté activo.</CardDescription><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, cédula o email" className="h-12 max-w-xl rounded-xl border-2 border-blue-200 bg-white px-4 text-slate-950 placeholder:text-slate-400 focus-visible:border-blue-500" /></CardHeader>
        <CardContent>{loading ? <p className="py-8 text-center text-slate-500">Cargando...</p> : filtered.length === 0 ? <div className="py-10 text-center text-slate-500"><ClipboardList className="mx-auto mb-3 h-8 w-8" />Todavía no hay solicitudes.</div> : <div className="space-y-4">{filtered.map((client) => {
          const appointment = nextAppointment(client.id);
          const clientRoutines = routinesByClient[client.id] ?? [];
          return <article key={client.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-950">{client.full_name}</h3><Badge className={statusClass[client.status] ?? "bg-slate-200 text-slate-800"}>{statusLabel[client.status] ?? client.status}</Badge>{clientRoutines.length > 0 && <Badge className="bg-emerald-100 text-emerald-900"><CheckCircle2 className="mr-1 h-3 w-3" />{clientRoutines.length === 1 ? "Rutina entregada" : `${clientRoutines.length} rutinas`}</Badge>}</div><p className="mt-1 text-sm text-slate-600">{client.cedula} · {client.email}{client.phone ? ` · ${client.phone}` : ""}</p>{appointment ? <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-blue-800"><CalendarClock className="h-4 w-4" />Próxima entrevista: {dateLabel(appointment.starts_at)} · {new Date(appointment.starts_at).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</p> : <p className="mt-2 text-sm text-slate-500">Sin entrevista futura agendada.</p>}</div><div className="flex flex-wrap items-center gap-2"><Select value={client.status} onValueChange={(status) => void updateClient(client, { status })}><SelectTrigger className="w-44 rounded-xl border-slate-300 bg-white text-slate-950"><SelectValue /></SelectTrigger><SelectContent className="bg-white text-slate-950">{Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button onClick={() => void startRoutine(client)} disabled={creating === client.id} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">{creating === client.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}{clientRoutines.length ? "Nueva rutina" : "Crear rutina"}</Button></div></div>
            {clientRoutines.length ? <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3">{clientRoutines.map((clientRoutine) => { const routineLink = clientRoutine.public_share_token && clientRoutine.public_link_enabled ? `${window.location.origin}/rutina/${clientRoutine.public_share_token}` : null; return <div key={clientRoutine.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-950">{clientRoutine.name}</p><p className="text-sm text-slate-600">{clientRoutine.valid_from ? `Desde ${dateLabel(clientRoutine.valid_from)}` : "Sin fecha de inicio"}{clientRoutine.valid_until ? ` · hasta ${dateLabel(clientRoutine.valid_until)}` : ""}</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editRoutine(client, clientRoutine)} className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>{routineLink ? <Button type="button" size="sm" variant="outline" onClick={() => void copy(routineLink, "Link de rutina copiado.")} className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Copiar link</Button> : null}<Button type="button" size="sm" variant="outline" disabled={deletingRoutineId === clientRoutine.id} onClick={() => void deleteRoutine(client, clientRoutine)} className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />{deletingRoutineId === clientRoutine.id ? "Eliminando..." : "Eliminar"}</Button></div></div>; })}</div> : null}
            <Textarea value={client.internal_notes ?? ""} onChange={(event) => setClients((current) => current.map((item) => item.id === client.id ? { ...item, internal_notes: event.target.value } : item))} onBlur={(event) => void updateClient(client, { internal_notes: event.target.value })} placeholder="Notas internas para el profesor" className="mt-4 min-h-16 rounded-xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-400" />
            {Object.keys(client.intake ?? {}).length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-blue-700">Ver cuestionario inicial</summary><pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs text-slate-700">{JSON.stringify(client.intake, null, 2)}</pre></details>}
          </article>;
        })}</div>}</CardContent>
      </Card>
      <Dialog open={Boolean(routineSetupTarget)} onOpenChange={(open) => { if (!open) { setRoutineSetupTarget(null); setRoutineSetupMode("choose"); setTemplateQuery(""); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl border-slate-200 bg-white p-6 text-slate-950 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Preparar rutina para {routineSetupTarget?.client.full_name}</DialogTitle>
            <DialogDescription className="text-slate-600">Elegí cómo querés comenzar. Después podrás revisar y ajustar todo antes de guardar.</DialogDescription>
          </DialogHeader>
          {routineSetupMode === "choose" ? <div className="grid gap-4 pt-3 sm:grid-cols-2">
            <button type="button" onClick={startBlankRoutine} className="group rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-lg">
              <span className="mb-4 inline-flex rounded-xl bg-blue-600 p-3 text-white"><ClipboardList className="h-6 w-6" /></span>
              <p className="text-lg font-bold">Crear rutina nueva</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Empezá desde cero y armá una planificación completamente personalizada.</p>
            </button>
            <button type="button" onClick={() => setRoutineSetupMode("copy")} className="group rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-lg">
              <span className="mb-4 inline-flex rounded-xl bg-violet-600 p-3 text-white"><Copy className="h-6 w-6" /></span>
              <p className="text-lg font-bold">Copiar rutina de otro socio</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Usá una rutina ya creada como base y adaptala para este cliente.</p>
            </button>
          </div> : <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-slate-950">Elegí una rutina para duplicar</p><p className="text-sm text-slate-600">La original no se modifica. También podés reutilizar una rutina anterior de este mismo cliente.</p></div><Button type="button" variant="outline" onClick={() => setRoutineSetupMode("choose")} className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-950">Volver</Button></div>
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input autoFocus value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Buscar socio por nombre, cédula o email" className="h-11 rounded-xl border-2 border-slate-300 bg-white pl-9 text-slate-950 placeholder:text-slate-500 focus-visible:border-blue-600" style={{ backgroundColor: "#ffffff", color: "#0f172a" }} /></div>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">{templateSources.length ? templateSources.map((sourceClient) => <div key={sourceClient.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{sourceClient.full_name}</p>{sourceClient.id === routineSetupTarget?.client.id ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">Este cliente</span> : null}</div><p className="mb-3 text-xs text-slate-600">{sourceClient.cedula} · {sourceClient.email}</p><div className="space-y-2">{(routinesByClient[sourceClient.id] ?? []).map((sourceRoutine) => <button type="button" key={sourceRoutine.id} onClick={() => useRoutineAsTemplate(sourceRoutine)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-violet-400 hover:bg-violet-50"><span><span className="block font-semibold text-slate-950">{sourceRoutine.name}</span><span className="text-xs text-slate-600">{sourceRoutine.valid_from ? `Desde ${dateLabel(sourceRoutine.valid_from)}` : "Sin fecha de inicio"}</span></span><Copy className="h-4 w-4 text-violet-600" /></button>)}</div></div>) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">No hay rutinas disponibles para copiar.</p>}</div>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(routineTarget)} onOpenChange={(open) => !open && setRoutineTarget(null)}><DialogContent className="max-h-[96vh] max-w-7xl overflow-y-auto border-0 bg-transparent p-0 shadow-none"><div className="rounded-3xl bg-slate-950 p-2"><PersonalizedRoutineBuilder key={`${routineTarget?.client.id ?? ""}-${routineTarget?.initialRoutine?.id ?? "new"}-${routineTarget?.createAsNew ? "copy" : "edit"}`} gymId={gymId} members={routineTarget ? [routineTarget.member] : []} initialRoutine={routineTarget?.initialRoutine} createAsNew={routineTarget?.createAsNew} defaultMember={routineTarget?.member} onCancel={() => setRoutineTarget(null)} onSaved={(routine) => void onRoutineSaved(routine)} /></div></DialogContent></Dialog>
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl border-slate-200 bg-white p-6 text-slate-950 sm:max-w-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl"><CalendarDays className="h-6 w-6 text-blue-600" />Agenda de próximas reuniones</DialogTitle><DialogDescription className="text-slate-600">Vista interna de respaldo. Estas reuniones provienen directamente de ManagerPro.</DialogDescription></DialogHeader>
          {upcomingSchedule.length ? <div className="mt-3 space-y-3">{upcomingSchedule.map(({ appointment, client }) => <article key={appointment.client_id + appointment.starts_at} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">{dateLabel(appointment.starts_at)} · {new Date(appointment.starts_at).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</p><h3 className="mt-1 text-lg font-black text-slate-950">{client.full_name}</h3><p className="mt-1 text-sm text-slate-600">Cédula: {client.cedula}</p></div><span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Confirmada</span></div><div className="mt-4 grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2">{client.phone ? <a href={`tel:${client.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"><Phone className="h-4 w-4 text-blue-600" />{client.phone}</a> : <span className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500">Sin teléfono registrado</span>}<a href={`mailto:${client.email}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"><Mail className="h-4 w-4 text-blue-600" />{client.email}</a></div></article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600"><CalendarDays className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold">No hay reuniones futuras agendadas.</p></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
