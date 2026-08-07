"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Fingerprint, RefreshCcw } from "lucide-react";

import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FusionarStatus = {
  enabled: boolean;
  setupRequired?: boolean;
  configured?: boolean;
  accessConfigured?: boolean;
  credentialsConfigured?: boolean;
  linkedMembers?: number;
  lastMemberSyncAt?: string | null;
  lastAccessSyncAt?: string | null;
  lastError?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Todavía no";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Todavía no"
    : date.toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" });
};

export function FusionarAccessPanel({ gymId }: { gymId: string }) {
  const [status, setStatus] = useState<FusionarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingMembers, setSyncingMembers] = useState(false);
  const [syncingAccesses, setSyncingAccesses] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pendingSyncAttemptedForGym = useRef<string | null>(null);

  const load = async () => {
    if (!gymId) return;
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/facial-access?gymId=${encodeURIComponent(gymId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as FusionarStatus | null;
      setStatus(payload);
    } catch (error) {
      console.error("No se pudo cargar el estado facial", error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [gymId]);

  useEffect(() => {
    const ready = Boolean(
      status?.enabled && status.configured && status.accessConfigured && status.credentialsConfigured
    );
    if (!ready || pendingSyncAttemptedForGym.current === gymId) return;

    pendingSyncAttemptedForGym.current = gymId;
    const syncPendingMembers = async () => {
      setSyncingMembers(true);
      try {
        const response = await authenticatedFetch("/api/facial-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gymId, action: "sync_pending_members" }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setMessage(payload?.error ?? "No se pudieron sincronizar los socios pendientes automáticamente.");
        }
        await load();
      } catch {
        setMessage("No se pudieron sincronizar los socios pendientes automáticamente.");
      } finally {
        setSyncingMembers(false);
      }
    };

    void syncPendingMembers();
  }, [gymId, status?.enabled, status?.configured, status?.accessConfigured, status?.credentialsConfigured]);

  const syncMembers = async () => {
    const confirmed = window.confirm(
      "Se sincronizarán los socios que tengan cédula con el sistema de acceso. ¿Continuar?"
    );
    if (!confirmed) return;

    setSyncingMembers(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/facial-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, action: "sync_members" }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      setMessage(payload?.message ?? payload?.error ?? "No se pudo sincronizar los socios.");
      await load();
    } catch {
      setMessage("No se pudo sincronizar los socios.");
    } finally {
      setSyncingMembers(false);
    }
  };

  const syncAccesses = async () => {
    setSyncingAccesses(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/facial-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, action: "sync_accesses" }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      setMessage(payload?.message ?? payload?.error ?? "No se pudieron importar los accesos.");
      await load();
    } catch {
      setMessage("No se pudieron importar los accesos.");
    } finally {
      setSyncingAccesses(false);
    }
  };

  if (loading || !status?.enabled) return null;

  const ready = Boolean(
    status.configured && status.accessConfigured && status.credentialsConfigured
  );

  return (
    <Card className="border-blue-200 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-slate-950">
            <Fingerprint className="h-5 w-5 text-blue-700" />
            Acceso facial conectado
          </CardTitle>
        </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          <BadgeCheck className="h-4 w-4" /> {ready ? "Listo para utilizar" : "Configuración pendiente"}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-100 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Socios vinculados</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{status.linkedMembers ?? 0}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Última sincronización de socios</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(status.lastMemberSyncAt)}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Última importación de accesos</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(status.lastAccessSyncAt)}</p>
          </div>
        </div>

        {!ready ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Para la primera prueba faltan: {!status.configured ? "URL de producción" : ""}{!status.configured && (!status.accessConfigured || !status.credentialsConfigured) ? ", " : ""}{!status.accessConfigured ? "ID del molinete" : ""}{!status.accessConfigured && !status.credentialsConfigured ? " y " : ""}{!status.credentialsConfigured ? "credenciales privadas en Vercel" : ""}.
          </p>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Fingerprint className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-950">Socios sincronizados automáticamente</p>
                <Button type="button" variant="ghost" className="mt-2 h-8 px-0 text-xs font-semibold text-emerald-800 hover:bg-transparent hover:text-emerald-950" onClick={syncMembers} disabled={!ready || syncingMembers || syncingAccesses}>
                  <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${syncingMembers ? "animate-spin" : ""}`} />
                  {syncingMembers ? "Sincronizando..." : "Sincronizar pendientes"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-700 text-white shadow-sm">
                <RefreshCcw className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-950">Historial de ingresos</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">Actualiza las pasadas registradas por el molinete en los reportes del gimnasio.</p>
                <Button type="button" variant="ghost" className="mt-2 h-8 px-0 text-xs font-semibold text-blue-800 hover:bg-transparent hover:text-blue-950" onClick={syncAccesses} disabled={!ready || syncingMembers || syncingAccesses}>
                  <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${syncingAccesses ? "animate-spin" : ""}`} />
                  {syncingAccesses ? "Actualizando..." : "Actualizar ingresos"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {message ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-950">{message}</p>
        ) : null}
        {status.lastError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Último aviso técnico: {status.lastError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
