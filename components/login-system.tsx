"use client";

import type React from "react";
import {
  supabase,
  mapGymInvoiceConfig,
  type GymInvoiceConfig,
} from "@/lib/supabase";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Clock, Lock, ShieldCheck, TrendingUp, User } from "lucide-react";

interface LoginSystemProps {
  onLogin: (gymData: {
    name: string;
    id: string;
    logo_url?: string | null;
    invoiceConfig?: GymInvoiceConfig | null;
  }) => void;
}

export function LoginSystem({ onLogin }: LoginSystemProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1) Autenticación con Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data?.user) {
        throw new Error("Usuario o contraseña incorrectos.");
      }
      const user = data.user;

      // 2) Traer el gimnasio vinculado al usuario logueado
      const { data: gym, error: gymErr } = await supabase
        .from("gyms")
        .select(
          "id, name, subscription, logo_url, invoice_user_id, invoice_company_id, invoice_branch_code, invoice_branch_id, invoice_environment, invoice_customer_id, invoice_series, invoice_currency, invoice_typecfe, invoice_tipo_traslado, invoice_rutneg, invoice_dirneg, invoice_cityneg, invoice_stateneg, invoice_addinfoneg"
        )
        .eq("user_id", user.id)
        .single();

      if (gymErr || !gym) {
        throw new Error("No se encontró el gimnasio vinculado a este usuario.");
      }

      // 3) Validar suscripción (tu lógica actual)
      if (gym.subscription !== "active" && gym.subscription !== "trial") {
        throw new Error("Tu suscripción ha expirado.");
      }

      const invoiceConfig: GymInvoiceConfig = mapGymInvoiceConfig(gym as any);

      // 4) Guardar el id del gimnasio en los metadatos del usuario
      let { error: updateError } = await supabase.auth.updateUser({
        data: { gym_id: gym.id },
      });

      if (updateError) {
        const { error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError) {
          throw new Error("No se pudo refrescar la sesión.");
        }
        ({ error: updateError } = await supabase.auth.updateUser({
          data: { gym_id: gym.id },
        }));
        if (updateError) {
          throw new Error(
            "No se pudo asociar el gimnasio al usuario."
          );
        }
      }

      // 5) Refrescar sesión para obtener un JWT con gym_id
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error("No se pudo actualizar la sesión.");
      }if (refreshData.session) {
        await supabase.auth.setSession(refreshData.session);
      }

      // 6) Continuar: usar el id de gym (text) para filtrar en toda la app
      
      onLogin({
        name: gym.name,
        id: gym.id,
        logo_url: gym.logo_url ?? null,
        invoiceConfig,
      });
    } catch (err: any) {
      setError(err.message ?? "Error al iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-[30rem] w-[30rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(15,23,42,0.4)_0%,_rgba(2,6,23,0.95)_60%)]" />
      </div>

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between px-6 py-12 sm:px-12 lg:px-20">
          <div className="max-w-xl space-y-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[0.65rem] uppercase tracking-[0.35em] text-emerald-200">
              <span>ManagerPro</span>
              <span className="font-semibold text-white">2.0</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <img
                  src="https://tvrwpwmuqxhqgjtmjoip.supabase.co/storage/v1/object/public/logos/Manager%20Pro%20Logo.png"
                  alt="Logo ManagerPro 2.0"
                  className="h-14 w-14 object-contain"
                  draggable={false}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
                  Plataforma integral para gimnasios visionarios
                </p>
                <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                  Centralizá todas tus sedes en un único panel inteligente.
                </h1>
              </div>
            </div>

            <p className="max-w-lg text-sm text-slate-300 sm:text-base">
              Diseñamos una experiencia de acceso exclusiva para cada franquicia. Coordiná cobros, socios, campañas y facturación en segundos con un tablero pensado para equipos en constante movimiento.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">Acceso seguro</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Autenticación multi-gym con auditorías y renovaciones automáticas de sesión.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">Datos en vivo</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Estadísticas consolidadas de membresías, facturación y retención en tiempo real.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">Operación ágil</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Automatizá recordatorios, vencimientos y cobranzas en toda tu red.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">Multi-sede ilimitado</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Configurá ilimitados gimnasios y mantené un branding cohesivo en cada punto de contacto.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-14 hidden gap-6 text-xs text-slate-400 sm:flex">
            <span>© {new Date().getFullYear()} ManagerPro 2.0</span>
            <span>Impulsando cadenas fitness en Latinoamérica</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-12 lg:px-20">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <div className="mb-10 space-y-3 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-emerald-200">
                <span>Portal privado</span>
              </div>
              <h2 className="text-3xl font-semibold text-white">Iniciá sesión en tu ecosistema</h2>
              <p className="text-sm text-slate-300">
                Conectate con tu panel personalizado y coordiná a tus equipos, socios y campañas en un mismo lugar.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">
                  Usuario (Email)
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu-email@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-white/10 bg-white/10 text-white placeholder:text-slate-400 focus-visible:ring-emerald-400"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 border-white/10 bg-white/10 text-white placeholder:text-slate-400 focus-visible:ring-emerald-400"
                    required
                  />
                </div>
              </div>

              {error && (
                <Alert
                  variant="destructive"
                  className="border-rose-400/40 bg-rose-500/10 text-rose-100"
                >
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-400 text-slate-950 transition hover:bg-emerald-300"
                disabled={isLoading}
                suppressHydrationWarning
              >
                {isLoading ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>

            <div className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <p className="font-medium text-slate-200">Sesiones protegidas y trazables.</p>
              </div>
              <p>
                ¿Necesitás ayuda con el acceso? Escribinos a
                <a
                  href="mailto:manager2comercial@gmail.com"
                  className="ml-1 font-semibold text-emerald-300 underline-offset-2 hover:underline"
                >
                  manager2comercial@gmail.com
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
