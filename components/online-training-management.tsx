"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardCopy, ClipboardList, ExternalLink, Loader2, RefreshCw, Users } from "lucide-react";
import { supabase, insertMemberWithFallback } from "@/lib/supabase";
import { PersonalizedRoutineBuilder, type CreatedPersonalizedRoutine, type RoutineMemberSearch } from "@/features/routines/components/personalized-routine-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type OnlineClient = {
  id: string; full_name: string; cedula: string; email: string; phone: string | null; source: string; status: string;
  intake: Record<string, unknown>; created_at: string; current_period_ends_at: string | null; internal_notes: string | null;
  linked_member_id: string | null; linked_routine_id: string | null;
};
type Appointment = { client_id: string; starts_at: string; status: string };
type RoutineInfo = { id: string; name: string; valid_from: string | null; valid_until: string | null; public_share_token: string | null; public_link_enabled: boolean | null };

const statusLabel: Record<string, string> = { pending_payment: "Pendiente de pago", active: "Activo", payment_due: "Pago próximo", grace: "En espera de pago", expired: "Vencido", cancelled: "Cancelado" };
const statusClass: Record<string, string> = { pending_payment: "bg-amber-100 text-amber-900", active: "bg-emerald-100 text-emerald-900", payment_due: "bg-blue-100 text-blue-900", grace: "bg-orange-100 text-orange-900", expired: "bg-rose-100 text-rose-900", cancelled: "bg-slate-200 text-slate-800" };
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" }) : null;

export function OnlineTrainingManagement({ gymId }: { gymId: string }) {
  const [clients, setClients] = useState<OnlineClient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [routines, setRoutines] = useState<Record<string, RoutineInfo>>({});
  const [price, setPrice] = useState(549);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [routineTarget, setRoutineTarget] = useState<{ client: OnlineClient; member: RoutineMemberSearch } | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
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
    const routineIds = loadedClients.map((client) => client.linked_routine_id).filter(Boolean) as string[];
    let routineMap: Record<string, RoutineInfo> = {};
    if (routineIds.length) {
      const { data } = await supabase.from("routines").select("id, name, valid_from, valid_until, public_share_token, public_link_enabled").in("id", routineIds);
      routineMap = Object.fromEntries(((data ?? []) as RoutineInfo[]).map((routine) => [routine.id, routine]));
    }
    setPrice(configResult.data?.monthly_price ?? 549);
    setClients(loadedClients);
    setAppointments((appointmentsResult.data ?? []) as Appointment[]);
    setRoutines(routineMap);
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
    setRoutineTarget({ client, member });
    setCreating(null);
  };
  const onRoutineSaved = async (routine: CreatedPersonalizedRoutine) => {
    if (!routineTarget) return;
    const { error } = await supabase.from("online_training_clients").update({ linked_member_id: routine.memberId, linked_routine_id: routine.id }).eq("id", routineTarget.client.id).eq("gym_id", gymId);
    if (error) { setMessage("La rutina se guardó, pero no pudimos vincularla al cliente."); return; }
    setRoutineTarget(null); setMessage("Rutina entregada y vinculada al cliente."); await load();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Portal privado</p>
        <h2 className="text-4xl font-bold tracking-tight text-slate-950">Gestión de entrenamiento</h2>
        <p className="text-slate-600">Clientes, entrevistas y rutinas en un solo lugar.</p>
        <Button onClick={() => void load()} disabled={loading} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
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
          const appointment = nextAppointment(client.id); const routine = client.linked_routine_id ? routines[client.linked_routine_id] : null;
          const routineLink = routine?.public_share_token && routine.public_link_enabled ? `${window.location.origin}/rutina/${routine.public_share_token}` : null;
          return <article key={client.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-950">{client.full_name}</h3><Badge className={statusClass[client.status] ?? "bg-slate-200 text-slate-800"}>{statusLabel[client.status] ?? client.status}</Badge>{routine && <Badge className="bg-emerald-100 text-emerald-900"><CheckCircle2 className="mr-1 h-3 w-3" />Rutina entregada</Badge>}</div><p className="mt-1 text-sm text-slate-600">{client.cedula} · {client.email}{client.phone ? ` · ${client.phone}` : ""}</p>{appointment ? <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-blue-800"><CalendarClock className="h-4 w-4" />Próxima entrevista: {dateLabel(appointment.starts_at)} · {new Date(appointment.starts_at).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</p> : <p className="mt-2 text-sm text-slate-500">Sin entrevista futura agendada.</p>}{routine && <p className="mt-2 text-sm text-slate-700"><strong>{routine.name}</strong>{routine.valid_from ? ` · desde ${dateLabel(routine.valid_from)}` : ""}{routine.valid_until ? ` hasta ${dateLabel(routine.valid_until)}` : ""}</p>}</div><div className="flex flex-wrap items-center gap-2"><Select value={client.status} onValueChange={(status) => void updateClient(client, { status })}><SelectTrigger className="w-44 rounded-xl border-slate-300 bg-white text-slate-950"><SelectValue /></SelectTrigger><SelectContent className="bg-white text-slate-950">{Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button onClick={() => void startRoutine(client)} disabled={creating === client.id} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">{creating === client.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}{routine ? "Nueva rutina" : "Crear rutina"}</Button>{routineLink && <Button variant="outline" onClick={() => void copy(routineLink, "Link de rutina copiado.")} className="rounded-xl border-blue-200 bg-white text-blue-700 hover:bg-blue-50"><ExternalLink className="mr-2 h-4 w-4" />Copiar rutina</Button>}</div></div>
            <Textarea value={client.internal_notes ?? ""} onChange={(event) => setClients((current) => current.map((item) => item.id === client.id ? { ...item, internal_notes: event.target.value } : item))} onBlur={(event) => void updateClient(client, { internal_notes: event.target.value })} placeholder="Notas internas para el profesor" className="mt-4 min-h-16 rounded-xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-400" />
            {Object.keys(client.intake ?? {}).length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-blue-700">Ver cuestionario inicial</summary><pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs text-slate-700">{JSON.stringify(client.intake, null, 2)}</pre></details>}
          </article>;
        })}</div>}</CardContent>
      </Card>
      <Dialog open={Boolean(routineTarget)} onOpenChange={(open) => !open && setRoutineTarget(null)}><DialogContent className="max-h-[96vh] max-w-7xl overflow-y-auto border-0 bg-transparent p-0 shadow-none"><div className="rounded-3xl bg-slate-950 p-2"><PersonalizedRoutineBuilder gymId={gymId} members={routineTarget ? [routineTarget.member] : []} defaultMember={routineTarget?.member} onCancel={() => setRoutineTarget(null)} onSaved={(routine) => void onRoutineSaved(routine)} /></div></DialogContent></Dialog>
    </div>
  );
}
