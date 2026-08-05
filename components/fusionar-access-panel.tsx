"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Fingerprint, RefreshCcw, ShieldCheck } from "lucide-react";

import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FusionarStatus = {
  enabled: boolean;
  setupRequired?: boolean;
  configured?: boolean;
  accessConfigured?: boolean;
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
  const [checking, setChecking] = useState(false);
  const [syncingMembers, setSyncingMembers] = useState(false);
  const [syncingAccesses, setSyncingAccesses] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const checkConnection = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/facial-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, action: "connection_check" }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      setMessage(payload?.message ?? payload?.error ?? "No se pudo comprobar la conexión.");
      await load();
    } catch {
      setMessage("No se pudo comprobar la conexión.");
    } finally {
      setChecking(false);
    }
  };

  const syncMembers = async () => {
    const confirmed = window.confirm(
      "Se enviarán a Fusionar los socios que tengan cédula. Los nuevos quedarán pendientes de enrolamiento facial presencial. ¿Continuar?"
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

  return (
    <Card className="border-blue-200 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-slate-950">
            <Fingerprint className="h-5 w-5 text-blue-700" />
            Acceso facial conectado
          </CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Integración privada con Fusionar. La cédula sigue siendo el vínculo entre cada socio y su registro facial.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          <BadgeCheck className="h-4 w-4" /> Habilitado
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white/90 p-3">
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <span>
              El enrolamiento facial se realiza presencialmente en el equipo de Fusionar. Este panel no almacena fotos biométricas.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={checkConnection} disabled={checking || syncingMembers || syncingAccesses}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Comprobando..." : "Probar conexión"}
            </Button>
            <Button type="button" onClick={syncMembers} disabled={checking || syncingMembers || syncingAccesses}>
              <Fingerprint className={`mr-2 h-4 w-4 ${syncingMembers ? "animate-pulse" : ""}`} />
              {syncingMembers ? "Sincronizando..." : "Sincronizar socios"}
            </Button>
            <Button type="button" variant="outline" onClick={syncAccesses} disabled={checking || syncingMembers || syncingAccesses}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${syncingAccesses ? "animate-spin" : ""}`} />
              {syncingAccesses ? "Importando..." : "Importar accesos"}
            </Button>
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
