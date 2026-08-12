"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Appointment = { id: string; startsAt: string };
type Data = { clientName: string; slots: string[]; appointments: Appointment[] };

function label(value: string, includeTime = true) {
  return new Intl.DateTimeFormat("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    timeZone: "America/Montevideo",
  }).format(new Date(value));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Montevideo",
  }).format(new Date(value));
}

export default function OnlineTrainingAgendaPage({ params }: { params: Promise<{ gymId: string }> }) {
  const [gymId, setGymId] = useState("");
  const [cedula, setCedula] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedSlotGroup, setSelectedSlotGroup] = useState(0);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [cancelingAppointmentId, setCancelingAppointmentId] = useState<string | null>(null);

  const groupedSlots = useMemo(() => {
    const grouped = new Map<string, string[]>();
    data?.slots.forEach((slot) => {
      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(slot));
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    });
    return [...grouped.values()];
  }, [data]);

  const load = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const id = gymId || (await params).gymId;
    setGymId(id);
    const response = await fetch(`/api/public-online-training/${id}/appointments?cedula=${encodeURIComponent(cedula)}`);
    const body = await response.json() as Data & { error?: string };
    setLoading(false);
    if (!response.ok) return setMessage(body.error || "No pudimos cargar la agenda.");
    setData(body);
    setSelectedSlotGroup(0);
  };

  const book = async (startsAt: string) => {
    setLoading(true);
    setMessage("");
    const id = gymId || (await params).gymId;
    const response = await fetch(`/api/public-online-training/${id}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula, startsAt }),
    });
    const body = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) return setMessage(body.error || "No pudimos confirmar el turno.");
    await load({ preventDefault() {} } as FormEvent);
    setMessage("Tu reunión quedó confirmada. Te enviaremos un recordatorio antes de la llamada.");
  };

  const cancelAppointment = async (appointment: Appointment) => {
    if (!window.confirm(`¿Cancelar la reunión del ${label(appointment.startsAt)}?`)) return;
    setCancelingAppointmentId(appointment.id);
    setMessage("");
    const id = gymId || (await params).gymId;
    const response = await fetch(`/api/public-online-training/${id}/appointments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula, appointmentId: appointment.id }),
    });
    const body = await response.json() as { error?: string };
    setCancelingAppointmentId(null);
    if (!response.ok) return setMessage(body.error || "No pudimos cancelar el turno.");
    await load({ preventDefault() {} } as FormEvent);
    setMessage("Tu reunión fue cancelada. Ya podés elegir otro horario disponible.");
  };

  const visibleSlots = groupedSlots[selectedSlotGroup] ?? [];

  return (
    <main id="gestionar-reunion" className="relative min-h-screen overflow-hidden bg-[#07152b] px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-28 h-96 w-96 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute -bottom-36 right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="flex items-center justify-between py-3 text-white sm:py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-blue-950/30 backdrop-blur">
              <Sparkles className="h-5 w-5 text-cyan-200" />
            </span>
            <div>
              <p className="text-sm font-black tracking-tight">ManagerPro</p>
              <p className="text-xs text-blue-200">Entrenamiento personalizado</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-100 sm:inline-flex">Seguimiento mensual</span>
        </header>

        <section className="grid items-start gap-8 py-8 lg:grid-cols-[0.86fr_1.14fr] lg:py-16">
          <div className="pt-2 text-white lg:pt-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">
              <CalendarDays className="h-3.5 w-3.5" /> Tu espacio de seguimiento
            </div>
            <h1 className="mt-6 max-w-xl text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl">
              Elegí el momento para avanzar.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
              Reservá tu encuentro individual de 30 minutos con el profesor y llevá tu plan al siguiente nivel.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ["01", "Ingresá tu cédula", "Identificamos tu suscripción."],
                ["02", "Elegí un horario", "Mostramos espacios disponibles."],
                ["03", "Confirmá tu lugar", "Recibís el recordatorio."],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                  <span className="text-xs font-black text-cyan-200">{number}</span>
                  <p className="mt-3 text-sm font-bold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-[0_28px_80px_rgba(2,12,27,0.42)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Tu reunión</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Agendá tu llamada</h2>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25"><CalendarDays className="h-5 w-5" /></span>
            </div>

            <form onSubmit={load} className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <label className="text-sm font-bold text-slate-800">Tu cédula</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={cedula}
                  onChange={(event) => setCedula(event.target.value)}
                  required
                  placeholder="Sin puntos ni guiones"
                  className="h-12 min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
                <button disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Ver horarios <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </form>

            {message ? <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${message.startsWith("Tu reunión") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{message}</p> : null}

            {data ? <div className="mt-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span>
                <div><p className="font-bold text-slate-950">Hola, {data.clientName}</p><p className="text-sm text-slate-600">Elegí el horario que te resulte más cómodo.</p></div>
              </div>

              {data.appointments.length > 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Tus reuniones agendadas</p><div className="mt-3 space-y-2">{data.appointments.map((appointment) => <div key={appointment.id} className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="capitalize font-bold text-emerald-950">{label(appointment.startsAt)}</p><button type="button" disabled={cancelingAppointmentId === appointment.id} onClick={() => void cancelAppointment(appointment)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60">{cancelingAppointmentId === appointment.id ? "Cancelando..." : "Cancelar turno"}</button></div>)}</div><p className="mt-3 text-xs text-emerald-800">Tenés una reunión por mes. Si necesitás cambiarla, cancelala y elegí otro horario.</p></div> : null}

              <div>
                <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-slate-950">Horarios disponibles</h3><span className="text-xs font-semibold text-slate-500">30 min por reunión</span></div>
                {groupedSlots.length ? <div className="mt-3">
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{groupedSlots.map((slots, index) => <button key={slots[0]} type="button" onClick={() => setSelectedSlotGroup(index)} className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${selectedSlotGroup === index ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}><span className="block text-[11px] font-bold uppercase tracking-wide opacity-75">{index === 0 ? "Próximo" : `Fecha ${index + 1}`}</span><span className="block text-sm font-black capitalize">{label(slots[0], false)}</span></button>)}</div>
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><button type="button" aria-label="Ver fecha anterior" disabled={selectedSlotGroup === 0} onClick={() => setSelectedSlotGroup((current) => Math.max(0, current - 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft className="h-4 w-4" /></button><p className="capitalize text-center text-sm font-black text-slate-950">{visibleSlots[0] ? label(visibleSlots[0], false) : ""}</p><button type="button" aria-label="Ver fecha siguiente" disabled={selectedSlotGroup === groupedSlots.length - 1} onClick={() => setSelectedSlotGroup((current) => Math.min(groupedSlots.length - 1, current + 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{visibleSlots.map((slot) => <button key={slot} type="button" disabled={loading} onClick={() => setPendingSlot(slot)} className="rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm font-black text-blue-800 transition hover:-translate-y-0.5 hover:border-blue-500 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50">{timeLabel(slot)}</button>)}</div></section>
                </div> : <div className="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">No hay horarios disponibles por el momento. Volvé a intentar más tarde.</div>}
              </div>
            </div> : <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><p className="text-sm leading-6 text-slate-600">Para cuidar tu servicio, verificamos que la suscripción esté activa antes de mostrar los horarios.</p></div>}
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-center text-xs text-slate-400 sm:flex-row sm:text-left"><span>© {new Date().getFullYear()} ManagerPro · Entrenamiento online</span><span>Tu información se utiliza únicamente para gestionar tu seguimiento.</span></footer>
      </div>
      <Dialog open={Boolean(pendingSlot)} onOpenChange={(open) => { if (!open) setPendingSlot(null); }}>
        <DialogContent className="rounded-3xl border-slate-200 bg-white p-6 text-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">¿Confirmás tu reunión?</DialogTitle>
            <DialogDescription className="text-slate-600">Vas a reservar tu encuentro individual de 30 minutos con el profesor.</DialogDescription>
          </DialogHeader>
          {pendingSlot ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Fecha elegida</p><p className="mt-2 capitalize text-lg font-black text-slate-950">{label(pendingSlot)}</p><p className="mt-1 text-sm text-slate-600">Podrás tener una reunión por mes.</p></div> : null}
          <DialogFooter className="gap-2 sm:gap-2"><button type="button" onClick={() => setPendingSlot(null)} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancelar</button><button type="button" disabled={loading || !pendingSlot} onClick={() => { const slot = pendingSlot; setPendingSlot(null); if (slot) void book(slot); }} className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">{loading ? "Confirmando..." : "Sí, confirmar reunión"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
