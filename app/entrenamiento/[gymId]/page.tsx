"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, Loader2, MessageCircle, ShieldCheck, Sparkles, Video } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type PublicConfig = { monthly_price: number; payment_url: string | null; whatsapp_url: string | null };
const fieldClass = "mt-2 !h-12 !rounded-xl !border-2 !border-blue-200 !bg-white !px-4 !text-slate-950 shadow-sm placeholder:!text-slate-400 focus-visible:!border-blue-500 focus-visible:!ring-2 focus-visible:!ring-blue-200";
const labelClass = "font-semibold text-slate-800";

export default function OnlineTrainingIntakePage({ params }: { params: Promise<{ gymId: string }> }) {
  const [gymId, setGymId] = useState("");
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: "", cedula: "", email: "", phone: "", source: "", sourceDetail: "", consent: false,
    goal: "", trainingPlace: "", experience: "", injuries: "", availableTime: "", weeklyDays: "",
  });

  useEffect(() => {
    void params.then(async ({ gymId: id }) => {
      setGymId(id);
      const { data } = await supabase.rpc("get_online_training_public_config", { p_gym_id: id });
      if (Array.isArray(data) && data[0]) setConfig(data[0] as PublicConfig);
      setLoading(false);
    });
  }, [params]);

  const update = (key: Exclude<keyof typeof form, "consent">, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const next = () => {
    const missingStepOne = !form.fullName || !form.cedula || !form.email || !form.phone;
    const missingStepTwo = !form.goal || !form.trainingPlace || !form.experience || !form.injuries || !form.availableTime || !form.weeklyDays;
    if ((step === 1 && missingStepOne) || (step === 2 && missingStepTwo)) return setError("Completá todos los campos obligatorios antes de continuar.");
    setError(""); setStep((current) => Math.min(3, current + 1));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.fullName || !form.cedula || !form.email || !form.phone || !form.goal || !form.trainingPlace || !form.experience || !form.injuries || !form.availableTime || !form.weeklyDays || !form.source || (form.source === "Otro" && !form.sourceDetail) || !form.consent) {
      setError("Completá los campos obligatorios antes de continuar.");
      return setStep(!form.fullName || !form.cedula || !form.email || !form.phone ? 1 : !form.goal || !form.trainingPlace || !form.experience || !form.injuries || !form.availableTime || !form.weeklyDays ? 2 : 3);
    }
    setSubmitting(true); setError("");
    const { data: clientId, error: rpcError } = await supabase.rpc("submit_online_training_intake", {
      p_gym_id: gymId, p_full_name: form.fullName, p_cedula: form.cedula, p_email: form.email, p_phone: form.phone,
      p_source: form.source, p_source_detail: form.sourceDetail,
      p_intake: { objetivo: form.goal, lugar_entrenamiento: form.trainingPlace, experiencia: form.experience, lesiones_o_limitaciones: form.injuries, tiempo_diario: form.availableTime, dias_por_semana: form.weeklyDays },
    });
    if (rpcError) { setSubmitting(false); return setError("No pudimos guardar tus datos. Intentá nuevamente."); }
    const payment = await fetch("/api/online-training/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, gymId }),
    }).then(async (response) => response.ok ? await response.json() as { paymentUrl?: string | null } : null).catch(() => null);
    setSubmitting(false);
    if (payment?.paymentUrl) { window.location.assign(payment.paymentUrl); return; }
    setDone(true);
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></main>;
  if (!config) return <main className="grid min-h-screen place-items-center bg-[#07172e] p-6 text-center text-white"><div><Sparkles className="mx-auto mb-4 h-10 w-10 text-cyan-300" /><h1 className="text-2xl font-bold">Las inscripciones todavía no están disponibles.</h1><p className="mt-2 text-slate-300">Probá nuevamente más tarde.</p></div></main>;
  if (done) return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_#1d4ed8,_#07172e_46%,_#04101f)] p-5"><section className="w-full max-w-xl rounded-[2rem] border border-white/20 bg-white p-8 text-center shadow-2xl sm:p-10"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-9 w-9" /></span><p className="mt-6 text-xs font-extrabold uppercase tracking-[0.24em] text-blue-700">Solicitud recibida</p><h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Ya tenemos tus datos.</h1><p className="mx-auto mt-3 max-w-md text-slate-600">El siguiente paso es completar la suscripción. Después podrás coordinar la charla inicial con el profesor.</p>{config.payment_url ? <a href={config.payment_url} className="mt-7 inline-flex w-full justify-center rounded-xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">Continuar al pago mensual</a> : <p className="mt-7 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Estamos preparando el cobro. Te contactaremos para continuar.</p>}{config.whatsapp_url && <a href={config.whatsapp_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><MessageCircle className="h-4 w-4" />Tengo una consulta</a>}</section></main>;

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_0%,_#dbeafe,_transparent_33%),radial-gradient(circle_at_92%_8%,_#bae6fd,_transparent_28%),linear-gradient(145deg,_#f8fbff,_#edf4ff_55%,_#f8fafc)] px-4 py-5 sm:py-10">
      <section className="mx-auto max-w-6xl">
        <header className="relative overflow-hidden rounded-[2.5rem] bg-[#07162d] px-6 py-9 text-white shadow-[0_30px_85px_rgba(8,30,65,.25)] sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-200/25 bg-white/10 text-cyan-200"><Sparkles className="h-5 w-5" /></span><p className="text-xs font-extrabold uppercase tracking-[0.24em] text-cyan-200">Plan personal online</p></div><h1 className="mt-6 max-w-xl text-4xl font-black leading-[.98] tracking-tight sm:text-6xl">Entrená con dirección, no con dudas.</h1><p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">Contanos un poco sobre vos y el profesor prepara tu rutina mensual, con videos para entender cada ejercicio.</p></div>
            <div className="flex w-fit items-center gap-3 rounded-2xl border border-emerald-200/25 bg-white/10 px-5 py-3 backdrop-blur"><span className="text-3xl font-black text-emerald-300">$ {config.monthly_price}</span><span className="border-l border-white/20 pl-3 text-sm font-medium leading-5 text-slate-200">por mes<br /><span className="text-xs text-slate-300">plan personalizado</span></span></div>
          </div>
          <div className="relative mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3"><p className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white"><CalendarDays className="h-4 w-4 text-cyan-300" />Charla inicial online</p><p className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-cyan-300" />Rutina hecha para vos</p><p className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white"><Video className="h-4 w-4 text-cyan-300" />Videos en cada ejercicio</p></div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50 sm:w-fit"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" /><span><b>Sin permanencia obligatoria.</b> Podés cancelar cuando quieras desde Mercado Pago.</span></div>
        </header>
        <form onSubmit={submit} className="relative mt-5 overflow-hidden rounded-[2.25rem] border border-blue-100 bg-white shadow-[0_24px_70px_rgba(30,64,175,.15)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(120deg,_#f8fbff,_#eff6ff)] px-5 py-5 sm:px-8"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">Paso {step} de 3</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{step === 1 ? "Para conocerte" : step === 2 ? "Tu entrenamiento" : "Confirmación y pago"}</h2></div><span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-extrabold text-blue-700">{step === 1 ? "33%" : step === 2 ? "66%" : "100%"}</span></div><div className="mt-5 flex gap-2">{[1, 2, 3].map((number) => <button key={number} type="button" onClick={() => setStep(number)} className={`h-2.5 flex-1 rounded-full transition ${number <= step ? "bg-blue-600" : "bg-slate-200"}`} aria-label={`Ir al paso ${number}`} />)}</div></div>
          <div className="p-5 sm:p-8">
            <div className="mb-7 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="font-bold text-slate-900">Te lleva menos de 2 minutos.</span><span className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Después seguís al pago seguro.</span></div>
            {step === 1 && <div className="grid gap-5 sm:grid-cols-2"><div><Label className={labelClass}>Nombre y apellido</Label><Input required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Tu nombre completo" className={fieldClass} /></div><div><Label className={labelClass}>Cédula</Label><Input required value={form.cedula} onChange={(e) => update("cedula", e.target.value)} placeholder="Sin puntos ni guiones" className={fieldClass} /></div><div><Label className={labelClass}>Email</Label><Input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="tu@email.com" className={fieldClass} /></div><div><Label className={labelClass}>Teléfono / WhatsApp</Label><Input required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Ej.: 099 123 456" className={fieldClass} /></div></div>}
            {step === 2 && <div className="grid gap-5 sm:grid-cols-2"><div><Label className={labelClass}>¿Cuál es tu objetivo?</Label><Input value={form.goal} onChange={(e) => update("goal", e.target.value)} placeholder="Ej.: ganar fuerza" className={fieldClass} /></div><div><Label className={labelClass}>¿Dónde vas a entrenar?</Label><Select value={form.trainingPlace} onValueChange={(value) => update("trainingPlace", value)}><SelectTrigger className="mt-2 !h-12 !rounded-xl !border-2 !border-blue-200 !bg-white !px-4 !text-slate-950 shadow-sm focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-200"><SelectValue placeholder="Elegí una opción" /></SelectTrigger><SelectContent className="!bg-white !text-slate-950"><SelectItem value="Gimnasio">Gimnasio</SelectItem><SelectItem value="Casa">En casa</SelectItem><SelectItem value="Aire libre">Al aire libre</SelectItem><SelectItem value="Otro">Otro</SelectItem></SelectContent></Select></div><div><Label className={labelClass}>Tiempo disponible por día</Label><Input value={form.availableTime} onChange={(e) => update("availableTime", e.target.value)} placeholder="Ej.: 45 minutos" className={fieldClass} /></div><div><Label className={labelClass}>Días por semana</Label><Input value={form.weeklyDays} onChange={(e) => update("weeklyDays", e.target.value)} placeholder="Ej.: 3 días" className={fieldClass} /></div><div className="sm:col-span-2"><Label className={labelClass}>Experiencia entrenando</Label><Textarea value={form.experience} onChange={(e) => update("experience", e.target.value)} placeholder="Contanos si entrenaste antes y qué tipo de entrenamiento hiciste." className={fieldClass + " !min-h-28 !py-3"} /></div><div className="sm:col-span-2"><Label className={labelClass}>Lesiones, molestias o consideraciones</Label><Textarea value={form.injuries} onChange={(e) => update("injuries", e.target.value)} placeholder="Si no tenés, escribí “ninguna”." className={fieldClass + " !min-h-28 !py-3"} /></div></div>}
            {step === 3 && <div className="space-y-5"><div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-5"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Confirmación y pago</p><h3 className="mt-2 text-xl font-black text-slate-950">Tu plan personalizado: $ {config.monthly_price} UYU por mes</h3><p className="mt-2 text-sm leading-6 text-slate-700">Al continuar te redirigiremos a Mercado Pago para completar el pago seguro de tu suscripción mensual. Podés cancelarla cuando quieras desde Mercado Pago.</p></div><div><Label className={labelClass}>¿Cómo nos conociste?</Label><Select value={form.source} onValueChange={(value) => update("source", value)}><SelectTrigger className="mt-2 !h-12 !rounded-xl !border-2 !border-blue-200 !bg-white !px-4 !text-slate-950 shadow-sm"><SelectValue placeholder="Elegí una opción" /></SelectTrigger><SelectContent className="!bg-white !text-slate-950"><SelectItem value="Redes sociales PymesSistemas">Redes sociales PymesSistemas</SelectItem><SelectItem value="Recomendación">Recomendación de alguien</SelectItem><SelectItem value="Google">Google</SelectItem><SelectItem value="Otro">Otro</SelectItem></SelectContent></Select></div>{form.source === "Otro" && <div><Label className={labelClass}>Contanos dónde</Label><Input required value={form.sourceDetail} onChange={(e) => update("sourceDetail", e.target.value)} className={fieldClass} /></div>}<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm((current) => ({ ...current, consent: event.target.checked }))} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" /><span>Acepto que mis datos sean utilizados únicamente para gestionar mi suscripción, preparar mi rutina y coordinar el seguimiento con el profesor. No se usarán para fines ajenos al servicio.</span></label></div>}
            {error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 text-emerald-600" />Datos protegidos y usados sólo para tu servicio.</p><div className="flex gap-2">{step > 1 && <Button type="button" variant="outline" onClick={() => { setError(""); setStep((current) => current - 1); }} className="border-slate-300 bg-white text-slate-800"><ChevronLeft className="mr-1 h-4 w-4" />Volver</Button>}{step < 3 ? <Button type="button" onClick={next} className="bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">Continuar</Button> : <Button type="submit" disabled={submitting} className="bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitting ? "Preparando pago..." : "Ir a Mercado Pago"}</Button>}</div></div>
          </div>
        </form>
      </section>
    </main>
  );
}
