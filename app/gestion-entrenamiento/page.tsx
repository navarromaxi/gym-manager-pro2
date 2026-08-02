"use client";

import { FormEvent, useEffect, useState } from "react";
import { Dumbbell, Loader2, LockKeyhole, LogOut } from "lucide-react";
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

  if (state.type === "loading") return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></main>;

  if (state.type === "login") return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5">
      <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 text-white shadow-2xl">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600"><Dumbbell className="h-6 w-6" /></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Portal privado</p>
        <h1 className="mt-2 text-3xl font-bold">Gestión de entrenamiento</h1>
        <p className="mt-2 text-sm text-slate-300">Acceso exclusivo para el equipo de rutinas personalizadas.</p>
        <div className="mt-7 space-y-4">
          <div><Label htmlFor="portal-email" className="text-slate-200">Email</Label><Input id="portal-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 border-slate-700 bg-slate-800 text-white" /></div>
          <div><Label htmlFor="portal-password" className="text-slate-200">Contraseña</Label><Input id="portal-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 border-slate-700 bg-slate-800 text-white" /></div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <Button type="submit" disabled={submitting} className="mt-6 w-full bg-blue-600 hover:bg-blue-500">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ingresar</Button>
      </form>
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
