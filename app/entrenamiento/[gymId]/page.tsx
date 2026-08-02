"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, Dumbbell, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
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
    fullName: "", cedula: "", email: "", phone: "", source: "Redes sociales PymesSistemas", sourceDetail: "",
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

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const next = () => { setError(""); setStep((current) => Math.min(3, current + 1)); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.fullName || !form.cedula || !form.email || !form.goal || !form.trainingPlace || !form.availableTime || !form.weeklyDays) {
      setError("Completá los campos obligatorios antes de continuar.");
      return setStep(1);
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
  if (!config) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white"><div><Dumbbell className="mx-auto mb-4 h-10 w-10 text-blue-400" /><h1 className="text-2xl font-bold">Las inscripciones todavía no están disponibles.</h1><p className="mt-2 text-slate-300">Probá nuevamente más tarde.</p></div></main>;
  if (done) return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /><p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Solicitud recibida</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Ya tenemos tus datos.</h1><p className="mt-3 text-slate-600">Completá tu suscripción para continuar con tu plan personalizado.</p>{config.payment_url ? <a href={config.payment_url} className="mt-6 inline-flex w-full justify-center rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">Continuar al pago mensual</a> : <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Estamos preparando el cobro. Te contactaremos para continuar.</p>}{config.whatsapp_url && <a href={config.whatsapp_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><MessageCircle className="h-4 w-4" />Tengo una consulta</a>}</section></main>;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_42%,_#e2e8f0)] px-4 py-10 sm:py-16">
      <section className="mx-auto max-w-3xl">
        <div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg"><Dumbbell className="h-7 w-7" /></div><p className="mt-5 text-sm font-bold uppercase tracking-[0.24em] text-blue-600">Rutina personalizada</p><h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">Un plan pensado para vos.</h1><p className="mx-auto mt-4 max-w-xl text-slate-600">Respondé unas preguntas cortas y empezá a entrenar con claridad.</p><div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-5 py-2 shadow-sm"><span className="text-2xl font-bold text-emerald-600">$ {config.monthly_price}</span><span className="text-sm font-medium text-slate-600">por mes</span></div></div>
        <form onSubmit={submit} className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-8"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Paso {step} de 3</p><h2 className="mt-1 text-xl font-bold text-slate-950">{step === 1 ? "Para conocerte" : step === 2 ? "Tu entrenamiento" : "Último detalle"}</h2></div><span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">{step === 1 ? "33%" : step === 2 ? "66%" : "100%"}</span></div><div className="mt-4 flex gap-2">{[1, 2, 3].map((number) => <button key={number} type="button" onClick={() => setStep(number)} className={`h-2 flex-1 rounded-full ${number <= step ? "bg-blue-600" : "bg-slate-200"}`} aria-label={`Ir al paso ${number}`} />)}</div></div>
          <div className="p-5 sm:p-8">
            {step === 1 && <div className="grid gap-5 sm:grid-cols-2"><div><Label className={labelClass}>Nombre y apellido</Label><Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Tu nombre completo" className={fieldClass} /></div><div><Label className={labelClass}>Cédula</Label><Input value={form.cedula} onChange={(e) => update("cedula", e.target.value)} placeholder="Sin puntos ni guiones" className={fieldClass} /></div><div><Label className={labelClass}>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="tu@email.com" className={fieldClass} /></div><div><Label className={labelClass}>Teléfono / WhatsApp</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Opcional" className={fieldClass} /></div></div>}
            {step === 2 && <div className="grid gap-5 sm:grid-cols-2"><div><Label className={labelClass}>¿Cuál es tu objetivo?</Label><Input value={form.goal} onChange={(e) => update("goal", e.target.value)} placeholder="Ej.: ganar fuerza" className={fieldClass} /></div><div><Label className={labelClass}>¿Dónde vas a entrenar?</Label><Select value={form.trainingPlace} onValueChange={(value) => update("trainingPlace", value)}><SelectTrigger className="mt-2 !h-12 !rounded-xl !border-2 !border-blue-200 !bg-white !px-4 !text-slate-950 shadow-sm focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-200"><SelectValue placeholder="Elegí una opción" /></SelectTrigger><SelectContent className="!bg-white !text-slate-950"><SelectItem value="Gimnasio">Gimnasio</SelectItem><SelectItem value="Casa">En casa</SelectItem><SelectItem value="Aire libre">Al aire libre</SelectItem><SelectItem value="Otro">Otro</SelectItem></SelectContent></Select></div><div><Label className={labelClass}>Tiempo disponible por día</Label><Input value={form.availableTime} onChange={(e) => update("availableTime", e.target.value)} placeholder="Ej.: 45 minutos" className={fieldClass} /></div><div><Label className={labelClass}>Días por semana</Label><Input value={form.weeklyDays} onChange={(e) => update("weeklyDays", e.target.value)} placeholder="Ej.: 3 días" className={fieldClass} /></div><div className="sm:col-span-2"><Label className={labelClass}>Experiencia entrenando</Label><Textarea value={form.experience} onChange={(e) => update("experience", e.target.value)} placeholder="Contanos si entrenaste antes y qué tipo de entrenamiento hiciste." className={fieldClass + " !min-h-28 !py-3"} /></div><div className="sm:col-span-2"><Label className={labelClass}>Lesiones, molestias o consideraciones</Label><Textarea value={form.injuries} onChange={(e) => update("injuries", e.target.value)} placeholder="Si no tenés, escribí “ninguna”." className={fieldClass + " !min-h-28 !py-3"} /></div></div>}
            {step === 3 && <div className="space-y-5"><div className="rounded-2xl bg-blue-50 p-5"><h3 className="font-bold text-slate-950">Ya casi está</h3><p className="mt-1 text-sm text-slate-600">Con estos datos el profesor prepara tu punto de partida.</p></div><div><Label className={labelClass}>¿Cómo nos conociste?</Label><Select value={form.source} onValueChange={(value) => update("source", value)}><SelectTrigger className="mt-2 !h-12 !rounded-xl !border-2 !border-blue-200 !bg-white !px-4 !text-slate-950 shadow-sm"><SelectValue /></SelectTrigger><SelectContent className="!bg-white !text-slate-950"><SelectItem value="Redes sociales PymesSistemas">Redes sociales PymesSistemas</SelectItem><SelectItem value="Influencers">Influencers</SelectItem><SelectItem value="Otro">Otro</SelectItem></SelectContent></Select></div>{form.source === "Otro" && <div><Label className={labelClass}>Contanos dónde</Label><Input value={form.sourceDetail} onChange={(e) => update("sourceDetail", e.target.value)} className={fieldClass} /></div>}</div>}
            {error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
            <div className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Tus datos se usan sólo para preparar tu servicio.</p><div className="flex gap-2">{step > 1 && <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} className="border-slate-300 bg-white text-slate-800"><ChevronLeft className="mr-1 h-4 w-4" />Volver</Button>}{step < 3 ? <Button type="button" onClick={next} className="bg-blue-600 text-white hover:bg-blue-700">Continuar</Button> : <Button type="submit" disabled={submitting} className="bg-blue-600 text-white hover:bg-blue-700">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitting ? "Enviando..." : "Continuar al pago"}</Button>}</div></div>
          </div>
        </form>
      </section>
    </main>
  );
}
