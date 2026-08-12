"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Dumbbell, Loader2, LockKeyhole, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { OnlineTrainingManagement } from "@/components/online-training-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type PortalState =
  | { type: "loading" }
  | { type: "login" }
  | { type: "denied"; message: string }
  | { type: "ready"; gymId: string; gymName: string };

export default function OnlineTrainingPortalPage() {
  const [state, setState] = useState<PortalState>({ type: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const verifyAccess = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setState({ type: "login" });

    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("id, name")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (gymError || !gym) return setState({ type: "denied", message: "Esta cuenta no tiene acceso al portal de entrenamiento." });

    const { data: config, error: configError } = await supabase
      .from("online_training_config")
      .select("is_enabled")
      .eq("gym_id", gym.id)
      .maybeSingle();
    if (configError || !config?.is_enabled) return setState({ type: "denied", message: "Esta cuenta no está habilitada para administrar el servicio de rutina personalizada." });

    setState({ type: "ready", gymId: gym.id, gymName: gym.name });
  };

  useEffect(() => { void verifyAccess(); }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (authError) return setError("Email o contraseña incorrectos.");
    setState({ type: "loading" });
    await verifyAccess();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setState({ type: "login" });
  };

  if (state.type === "loading") return <main className="grid min-h-screen place-items-center bg-[#07152b] text-white"><div className="grid place-items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-100/20 bg-white/10"><Loader2 className="h-6 w-6 animate-spin text-cyan-200" /></span><p className="text-sm font-medium text-slate-400">Preparando tu espacio de trabajo…</p></div></main>;

  if (state.type === "login") return (
    <main className="relative min-h-screen overflow-hidden bg-[#07152b] p-4 text-white sm:p-7">
      <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-40 top-[-9rem] h-[34rem] w-[34rem] rounded-full bg-blue-600/25 blur-3xl" /><div className="absolute -bottom-40 right-[-8rem] h-[32rem] w-[32rem] rounded-full bg-cyan-400/15 blur-3xl" /><div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:34px_34px]" /></div>
      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/20 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-sm lg:grid-cols-[1.08fr_.92fr]">
        <section className="hidden flex-col justify-between border-r border-white/10 p-10 lg:flex xl:p-14">
          <div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100"><Sparkles className="h-3.5 w-3.5" /> Rutina Online</div><h1 className="mt-8 max-w-md text-5xl font-black leading-[1.02] tracking-tight">El control de cada plan, en un solo lugar.</h1><p className="mt-6 max-w-md text-lg leading-8 text-slate-300">Organizá clientes, pagos, reuniones y entregas de rutinas desde un espacio pensado para el equipo.</p></div>
          <div className="grid max-w-md gap-3">{[["Clientes y suscripciones", "Toda la información para dar seguimiento."], ["Agenda sincronizada", "Reuniones y disponibilidad del profesor."], ["Rutinas personalizadas", "Un flujo claro desde la charla hasta la entrega."]].map(([title, description]) => <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="font-bold text-white">{title}</p><p className="mt-1 text-sm text-slate-400">{description}</p></div></div>)}</div>
        </section>
        <section className="flex items-center justify-center bg-white/[0.035] p-5 sm:p-10">
          <form onSubmit={login} className="w-full max-w-md rounded-[1.7rem] border border-white/10 bg-[#101b32]/90 p-6 shadow-2xl shadow-black/20 sm:p-9">
            <div className="flex items-start justify-between gap-4"><div className="grid h-13 w-13 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-slate-950 shadow-lg shadow-blue-500/20"><Dumbbell className="h-6 w-6" /></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-bold text-emerald-100"><ShieldCheck className="h-3.5 w-3.5" /> Acceso seguro</span></div>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Portal del equipo</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Gestión de entrenamiento</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Ingresá con tus credenciales para administrar el servicio de rutinas personalizadas.</p>
            <div className="mt-8 space-y-5"><div><Label htmlFor="portal-email" className="text-sm font-bold text-slate-200">Email</Label><Input id="portal-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" className="mt-2 h-12 border-slate-600/70 bg-slate-900/80 text-white placeholder:text-slate-500 focus-visible:ring-cyan-300" /></div><div><Label htmlFor="portal-password" className="text-sm font-bold text-slate-200">Contraseña</Label><Input id="portal-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" className="mt-2 h-12 border-slate-600/70 bg-slate-900/80 text-white placeholder:text-slate-500 focus-visible:ring-cyan-300" /></div></div>
            {error && <p className="mt-5 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-100">{error}</p>}
            <Button type="submit" disabled={submitting} className="mt-7 h-12 w-full bg-gradient-to-r from-blue-500 to-cyan-400 font-bold text-slate-950 shadow-lg shadow-blue-500/20 hover:from-blue-400 hover:to-cyan-300">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}{submitting ? "Verificando acceso…" : "Ingresar al portal"}</Button>
            <p className="mt-5 text-center text-xs text-slate-500">Acceso exclusivo para el equipo autorizado.</p>
          </form>
        </section>
      </div>
    </main>
  );

  if (state.type === "denied") return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-5 text-center text-white">
      <div className="max-w-md"><LockKeyhole className="mx-auto mb-4 h-10 w-10 text-amber-400" /><h1 className="text-2xl font-bold">Acceso no habilitado</h1><p className="mt-3 text-slate-300">{state.message}</p><Button variant="outline" className="mt-6 border-slate-600 bg-transparent text-white hover:bg-slate-800 hover:text-white" onClick={() => void logout()}>Salir</Button></div>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Portal privado</p><h1 className="text-xl font-bold text-slate-950">Gestión de entrenamiento</h1><p className="text-sm text-slate-500">{state.gymName}</p></div><Button variant="outline" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Cerrar sesión</Button></div></header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><OnlineTrainingManagement gymId={state.gymId} /></div>
    </main>
  );
}
