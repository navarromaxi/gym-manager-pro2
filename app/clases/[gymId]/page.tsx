"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck2, CalendarDays, CheckCircle2, ChevronDown, Clock3, TicketCheck } from "lucide-react";
import { useParams } from "next/navigation";

type PublicClass = { id: string; title: string; starts_at: string; ends_at: string; capacity: number; notes?: string | null };
type PublicGym = { name?: string | null; logoUrl?: string | null };
type Feedback = { type: "error" | "success"; text: string } | null;
type Screen = "home" | "reserve" | "mine";

const dateFormatter = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long" });
const timeFormatter = new Intl.DateTimeFormat("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });

export default function PublicClassesPage() {
  const { gymId = "" } = useParams<{ gymId: string }>();
  const [screen, setScreen] = useState<Screen>("home");
  const [gym, setGym] = useState<PublicGym>({});
  const [classes, setClasses] = useState<PublicClass[]>([]);
  const [reserved, setReserved] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<PublicClass | null>(null);
  const [cedula, setCedula] = useState("");
  const [myReservations, setMyReservations] = useState<PublicClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openDay, setOpenDay] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!gymId) return;
    void fetch(`/api/public-gyms/${gymId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setGym(payload?.data ?? {}))
      .catch(() => undefined);
  }, [gymId]);

  const loadClasses = async () => {
    setLoading(true);
    const response = await fetch(`/api/public-gyms/${gymId}/classes`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setFeedback({ type: "error", text: "No pudimos cargar las clases. Intenta nuevamente." });
    else {
      const nextClasses = payload?.classes ?? [];
      setClasses(nextClasses);
      setReserved(payload?.reservedByOccurrence ?? {});
      setGym(payload?.gym ?? {});
      setOpenDay(nextClasses[0] ? new Date(nextClasses[0].starts_at).toDateString() : "");
    }
    setLoading(false);
  };

  const openReservations = () => {
    setFeedback(null);
    setScreen("reserve");
    void loadClasses();
  };

  const days = useMemo(() => classes.reduce<Record<string, PublicClass[]>>((groups, item) => {
    const key = new Date(item.starts_at).toDateString();
    (groups[key] ??= []).push(item);
    return groups;
  }, {}), [classes]);

  const reserve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setFeedback(null);
    const response = await fetch(`/api/public-gyms/${gymId}/classes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occurrenceId: selected.id, cedula }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setFeedback({ type: "error", text: payload?.error ?? "No se pudo confirmar la reserva." });
    else {
      setFeedback({ type: "success", text: "Tu reserva fue confirmada." });
      setReserved((current) => ({ ...current, [selected.id]: (current[selected.id] ?? 0) + 1 }));
      setSelected(null);
      setCedula("");
    }
    setSaving(false);
  };

  const loadMyReservations = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cedula.trim()) return;
    setLoading(true);
    setFeedback(null);
    const response = await fetch(`/api/public-gyms/${gymId}/classes/my-reservations?cedula=${encodeURIComponent(cedula)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setFeedback({ type: "error", text: payload?.error ?? "No pudimos cargar tus reservas." });
    else setMyReservations(payload?.reservations ?? []);
    setLoading(false);
  };

  const cancelReservation = async (occurrenceId: string) => {
    if (!window.confirm("¿Quieres cancelar esta reserva? El cupo volverá a quedar disponible.")) return;
    setSaving(true);
    setFeedback(null);
    const response = await fetch(`/api/public-gyms/${gymId}/classes/my-reservations`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occurrenceId, cedula }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setFeedback({ type: "error", text: payload?.error ?? "No se pudo cancelar la reserva." });
    else {
      setMyReservations((current) => current.filter((item) => item.id !== occurrenceId));
      setFeedback({ type: "success", text: "Reserva cancelada. El cupo volvió a quedar disponible." });
    }
    setSaving(false);
  };

  const goHome = () => { setScreen("home"); setFeedback(null); setSelected(null); };
  const canCancel = (startsAt: string) => new Date(startsAt).getTime() > Date.now() + 60 * 60 * 1000;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_42%,_#ecfdf5)] px-4 py-10 sm:px-6"><div className="mx-auto max-w-4xl"><header className="mb-8 text-center">{gym.logoUrl ? <img src={gym.logoUrl} alt={`Logo de ${gym.name ?? "gimnasio"}`} className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-white/80 bg-white object-contain p-1 shadow-sm" /> : null}<p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">Reservas online</p>{gym.name ? <p className="mt-2 text-lg font-bold text-slate-700">{gym.name}</p> : null}<h1 className="mt-1 text-4xl font-black tracking-tight text-slate-950">Clases</h1></header>
    {screen !== "home" ? <button type="button" onClick={goHome} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-blue-700"><ArrowLeft className="h-4 w-4" />Volver</button> : null}
    {feedback && !selected ? <Notice feedback={feedback} /> : null}
    {screen === "home" ? <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2"><Choice icon={<CalendarDays className="h-7 w-7" />} title="Reservar clases" description="Consulta los horarios disponibles y reservá tu lugar." action={openReservations} /><Choice icon={<TicketCheck className="h-7 w-7" />} title="Ver mis reservas" description="Ingresá tu cédula para consultar o cancelar tus próximas clases." action={() => { setFeedback(null); setScreen("mine"); }} /></div> : null}
    {screen === "reserve" ? <><p className="mb-5 text-center text-slate-600">Elegí una clase, ingresá tu cédula y reservá tu lugar.</p>{loading ? <EmptyState text="Cargando clases disponibles..." /> : !classes.length ? <EmptyState text="No hay clases disponibles por el momento." dashed /> : <div className="space-y-3">{Object.entries(days).map(([day, items]) => { const expanded = openDay === day; return <section key={day} className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_12px_32px_rgba(15,23,42,0.07)]"><button type="button" onClick={() => setOpenDay(expanded ? "" : day)} className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarDays className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-base font-bold capitalize text-slate-900">{dateFormatter.format(new Date(items[0].starts_at))}</span><span className="text-sm text-slate-500">{items.length} {items.length === 1 ? "clase disponible" : "clases disponibles"}</span></span><ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>{expanded ? <div className="border-t border-slate-100 px-3 py-2 sm:px-5">{items.map((item) => { const remaining = Math.max(item.capacity - (reserved[item.id] ?? 0), 0); return <article key={item.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"><div className="w-20 shrink-0 text-center"><p className="text-sm font-black tabular-nums text-slate-900">{timeFormatter.format(new Date(item.starts_at))}</p><p className="text-xs text-slate-500">hasta {timeFormatter.format(new Date(item.ends_at))}</p></div><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-slate-950">{item.title}</h3>{item.notes ? <p className="mt-0.5 truncate text-sm text-slate-500">{item.notes}</p> : null}</div><div className="hidden text-right sm:block"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${remaining ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{remaining ? `${remaining} cupos` : "Completa"}</span></div><button disabled={!remaining} onClick={() => { setSelected(item); setFeedback(null); }} className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{remaining ? "Reservar" : "Completa"}</button></article>; })}</div> : null}</section>; })}</div>}</> : null}
    {screen === "mine" ? <section className="mx-auto max-w-2xl rounded-3xl border border-white/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-7"><div className="text-center"><CalendarCheck2 className="mx-auto h-8 w-8 text-blue-600" /><h2 className="mt-3 text-2xl font-black text-slate-950">Mis reservas</h2><p className="mt-2 text-slate-600">Ingresá tu cédula para ver tus próximas clases.</p></div><form onSubmit={loadMyReservations} className="mt-6 flex gap-2"><input required inputMode="numeric" value={cedula} onChange={(event) => setCedula(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 outline-none focus:border-blue-500" placeholder="Tu cédula" /><button disabled={loading} className="rounded-xl bg-blue-600 px-4 font-bold text-white disabled:bg-blue-300">Buscar</button></form>{loading ? <p className="py-8 text-center text-sm text-slate-500">Buscando tus reservas...</p> : myReservations.length ? <div className="mt-6 space-y-3">{myReservations.map((item) => { const cancellable = canCancel(item.starts_at); return <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{item.title}</p><p className="mt-1 flex items-center gap-1 text-sm capitalize text-slate-600"><Clock3 className="h-4 w-4" />{dateFormatter.format(new Date(item.starts_at))} · {timeFormatter.format(new Date(item.starts_at))}</p>{item.notes ? <p className="mt-2 text-sm text-slate-500">{item.notes}</p> : null}</div><button disabled={!cancellable || saving} onClick={() => void cancelReservation(item.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">{cancellable ? "Cancelar" : "No cancelable"}</button></div>{!cancellable ? <p className="mt-3 text-xs text-slate-500">Las reservas se pueden cancelar hasta una hora antes.</p> : null}</article>; })}</div> : <p className="mt-6 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600">Ingresá tu cédula para consultar tus reservas. Si no aparecen clases, no tenés próximas reservas.</p>}</section> : null}
  </div>{selected ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-4 sm:items-center sm:justify-center"><form onSubmit={reserve} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5"><p className="text-sm font-bold text-blue-700">Confirmar reserva</p><h2 className="mt-1 text-2xl font-black text-slate-950">{selected.title}</h2><p className="mt-1 text-slate-600">{dateFormatter.format(new Date(selected.starts_at))} · {timeFormatter.format(new Date(selected.starts_at))}</p></div>{feedback ? <Notice feedback={feedback} /> : null}<label className="block text-sm font-bold text-slate-800">Tu cédula<input autoFocus required inputMode="numeric" value={cedula} onChange={(event) => setCedula(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg font-semibold tracking-wider text-slate-950 caret-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Ingresa tu cédula" /></label><div className="mt-6 flex gap-3"><button type="button" onClick={() => { setSelected(null); setFeedback(null); }} className="flex-1 rounded-xl border px-4 py-3 font-bold text-slate-700">Cancelar</button><button disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:bg-emerald-300"><CheckCircle2 className="h-5 w-5" />{saving ? "Reservando..." : "Confirmar"}</button></div></form></div> : null}</main>;
}

function Choice({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action: () => void }) { return <button type="button" onClick={action} className="rounded-3xl border border-white bg-white p-6 text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">{icon}</span><h2 className="mt-5 text-xl font-black text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><span className="mt-5 inline-block text-sm font-bold text-blue-700">Continuar →</span></button>; }
function Notice({ feedback }: { feedback: NonNullable<Feedback> }) { return <div className={`mb-6 rounded-2xl border p-4 text-center font-medium ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{feedback.text}</div>; }
function EmptyState({ text, dashed = false }: { text: string; dashed?: boolean }) { return <div className={`rounded-3xl bg-white p-10 text-center text-slate-600 shadow-sm ${dashed ? "border border-dashed border-slate-300" : ""}`}>{text}</div>; }
