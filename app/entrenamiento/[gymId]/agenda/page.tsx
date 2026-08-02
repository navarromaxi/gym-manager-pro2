"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Loader2 } from "lucide-react";

type Data = { clientName: string; slots: string[]; appointments: string[] };

function label(value: string) {
  return new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Montevideo" }).format(new Date(value));
}

export default function OnlineTrainingAgendaPage({ params }: { params: Promise<{ gymId: string }> }) {
  const [gymId, setGymId] = useState("");
  const [cedula, setCedula] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setMessage("");
    const id = gymId || (await params).gymId; setGymId(id);
    const response = await fetch(`/api/public-online-training/${id}/appointments?cedula=${encodeURIComponent(cedula)}`);
    const body = await response.json() as Data & { error?: string };
    setLoading(false);
    if (!response.ok) return setMessage(body.error || "No pudimos cargar la agenda.");
    setData(body);
  };
  const book = async (startsAt: string) => {
    setLoading(true); setMessage("");
    const id = gymId || (await params).gymId;
    const response = await fetch(`/api/public-online-training/${id}/appointments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula, startsAt }) });
    const body = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) return setMessage(body.error || "No pudimos confirmar el turno.");
    setMessage("Turno confirmado. Guardá este horario; el profesor tendrá registrada tu reserva.");
    await load({ preventDefault() {} } as FormEvent);
  };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_48%,_#e2e8f0)] p-5 sm:p-10"><section className="mx-auto max-w-3xl"><header className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg"><CalendarDays className="h-7 w-7" /></span><p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-blue-600">Llamada inicial</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Elegí tu horario</h1><p className="mx-auto mt-3 max-w-xl text-slate-600">Las llamadas son de 30 minutos, lunes, miércoles y jueves de 18:00 a 20:00.</p></header><form onSubmit={load} className="mx-auto mt-8 max-w-xl rounded-3xl border border-blue-100 bg-white p-5 shadow-xl"><label className="block text-sm font-bold text-slate-800">Ingresá tu cédula</label><div className="mt-2 flex gap-2"><input value={cedula} onChange={(event) => setCedula(event.target.value)} required placeholder="Sin puntos ni guiones" className="h-12 min-w-0 flex-1 rounded-xl border-2 border-blue-200 bg-white px-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button disabled={loading} className="rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700 disabled:bg-blue-300">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ver horarios"}</button></div></form>{message && <p className="mx-auto mt-5 max-w-xl rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700">{message}</p>}{data && <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-7"><div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-500" /><div><h2 className="font-bold text-slate-950">Hola, {data.clientName}</h2><p className="text-sm text-slate-600">Seleccioná el turno que te quede mejor.</p></div></div>{data.appointments.length > 0 && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Ya tenés agendado:</strong> {data.appointments.map(label).join(", ")}</div>}<div className="mt-5 grid gap-3 sm:grid-cols-2">{data.slots.map((slot) => <button key={slot} disabled={loading} onClick={() => void book(slot)} className="flex items-center justify-between rounded-xl border-2 border-blue-100 bg-white p-4 text-left transition hover:border-blue-500 hover:bg-blue-50"><span className="capitalize font-semibold text-slate-950">{label(slot)}</span><Clock3 className="h-5 w-5 text-blue-600" /></button>)}</div></section>}</section></main>;
}
