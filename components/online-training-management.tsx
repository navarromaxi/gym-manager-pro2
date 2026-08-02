"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, ExternalLink, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type OnlineClient = {
  id: string;
  full_name: string;
  cedula: string;
  email: string;
  phone: string | null;
  source: string;
  status: string;
  intake: Record<string, unknown>;
  created_at: string;
  current_period_ends_at: string | null;
  internal_notes: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  active: "Activo",
  payment_due: "Pago próximo",
  grace: "En espera de pago",
  expired: "Vencido",
  cancelled: "Cancelado",
};

const STATUS_CLASS: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  payment_due: "bg-blue-100 text-blue-800",
  grace: "bg-orange-100 text-orange-800",
  expired: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-200 text-slate-700",
};

export function OnlineTrainingManagement({ gymId }: { gymId: string }) {
  const [clients, setClients] = useState<OnlineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [config, setConfig] = useState({ enabled: false, price: 549, paymentUrl: "", whatsappUrl: "" });
  const [query, setQuery] = useState("");

  const publicUrl = typeof window === "undefined" ? "" : `${window.location.origin}/entrenamiento/${gymId}`;

  const load = async () => {
    setLoading(true);
    const [{ data: configData, error: configError }, { data: clientsData, error: clientsError }] = await Promise.all([
      supabase.from("online_training_config").select("is_enabled, monthly_price, payment_url, whatsapp_url").eq("gym_id", gymId).maybeSingle(),
      supabase.from("online_training_clients").select("id, full_name, cedula, email, phone, source, status, intake, created_at, current_period_ends_at, internal_notes").eq("gym_id", gymId).order("created_at", { ascending: false }),
    ]);
    if (configError || clientsError) {
      setMessage("No pudimos cargar el módulo online. Verificá que el SQL se haya ejecutado completo.");
    } else {
      setConfig({
        enabled: configData?.is_enabled ?? false,
        price: configData?.monthly_price ?? 549,
        paymentUrl: configData?.payment_url ?? "",
        whatsappUrl: configData?.whatsapp_url ?? "",
      });
      setClients((clientsData ?? []) as OnlineClient[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [gymId]);

  const updateClient = async (client: OnlineClient, update: Partial<OnlineClient>) => {
    const { error } = await supabase.from("online_training_clients").update(update).eq("id", client.id).eq("gym_id", gymId);
    if (error) return setMessage("No pudimos actualizar este cliente.");
    setClients((current) => current.map((item) => item.id === client.id ? { ...item, ...update } : item));
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clients;
    return clients.filter((client) => [client.full_name, client.cedula, client.email].some((value) => value.toLowerCase().includes(normalized)));
  }, [clients, query]);

  const copyPublicUrl = async () => {
    try { await navigator.clipboard.writeText(publicUrl); setMessage("Link público copiado."); }
    catch { window.prompt("Copiá este link:", publicUrl); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">Portal de entrenamiento</p>
          <h2 className="mt-1 text-4xl font-bold tracking-tight text-slate-950">Clientes finales</h2>
        </div>
        <Button onClick={() => void load()} disabled={loading} className="rounded-xl bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
      </div>

      <Card className="overflow-hidden border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 !text-white shadow-lg">
        <CardContent className="flex flex-col items-center justify-between gap-5 p-6 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Plan mensual</p>
            <p className="mt-1 text-3xl font-bold">$ {config.price} UYU</p>
          </div>
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <Button onClick={() => void copyPublicUrl()} className="rounded-xl bg-white !text-blue-700 shadow-sm hover:bg-blue-50"><ExternalLink className="mr-2 h-4 w-4" />Copiar link de inscripción</Button>
            {publicUrl && <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-white/40 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">Abrir vista pública</a>}
          </div>
          {message && <p className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white">{message}</p>}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200 bg-white !text-slate-950 shadow-sm">
        <CardHeader className="items-center space-y-3 text-center">
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><Users className="h-6 w-6 text-blue-600" />Solicitudes recibidas</CardTitle>
          <CardDescription className="text-slate-600">{clients.length} clientes o solicitudes en este servicio.</CardDescription>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, cédula o email" className="h-12 w-full max-w-xl rounded-xl border-2 border-blue-200 bg-white px-4 text-slate-950 shadow-sm placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200" />
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-8 text-center text-slate-500">Cargando...</p> : filtered.length === 0 ? <div className="py-10 text-center text-slate-500"><ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-400" />Todavía no hay solicitudes.</div> : (
            <div className="space-y-3">
              {filtered.map((client) => (
                <div key={client.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{client.full_name}</h3><Badge className={STATUS_CLASS[client.status] ?? "bg-slate-100 text-slate-700"}>{STATUS_LABEL[client.status] ?? client.status}</Badge></div>
                      <p className="mt-1 text-sm text-slate-600">{client.cedula} · {client.email}{client.phone ? ` · ${client.phone}` : ""}</p>
                      <p className="mt-1 text-xs text-slate-500">Origen: {client.source} · recibido {new Date(client.created_at).toLocaleDateString("es-UY")}</p>
                    </div>
                    <Select value={client.status} onValueChange={(status) => void updateClient(client, { status })}>
                      <SelectTrigger className="w-full border-slate-300 bg-white text-slate-950 md:w-48"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white text-slate-950">{Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Textarea value={client.internal_notes ?? ""} onChange={(event) => setClients((current) => current.map((item) => item.id === client.id ? { ...item, internal_notes: event.target.value } : item))} onBlur={(event) => void updateClient(client, { internal_notes: event.target.value })} placeholder="Notas internas para el profe (no las ve el cliente)" className="mt-3 min-h-16 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400" />
                  {Object.keys(client.intake ?? {}).length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-blue-700">Ver cuestionario inicial</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(client.intake, null, 2)}</pre></details>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
