import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGymRequest } from "@/lib/api-auth";
import { evaluateMemberAccess } from "@/lib/member-access";
import {
  createFusionarSession,
  FusionarApiError,
  fusionarRequest,
  getFusionarCredentials,
} from "@/lib/fusionar";
import { createClient } from "@/lib/supabase-server";

const querySchema = z.object({ gymId: z.string().min(1) });
const bodySchema = z.object({
  gymId: z.string().min(1),
  action: z.enum(["connection_check", "sync_members", "sync_accesses"]),
  memberId: z.string().min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const isMissingRelation = (message?: string) =>
  /does not exist|could not find the table|schema cache|relation/i.test(message ?? "");

type FusionarEmployee = {
  IdFuncionario?: string | number;
  idFuncionario?: string | number;
  data?: FusionarEmployee;
};

type LocalMember = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cedula: string | null;
  next_payment: string | null;
  status: string | null;
};

type FusionarMark = {
  IdMarca?: string | number;
  idMarca?: string | number;
  IdAcceso?: string | number;
  idAcceso?: string | number;
  Acceso?: { IdAcceso?: string | number; idAcceso?: string | number };
  IdFuncionario?: string | number;
  idFuncionario?: string | number;
  Funcionario?: { IdFuncionario?: string | number; idFuncionario?: string | number };
  FechaHora?: string;
  fechaHora?: string;
};

type FusionarAccess = {
  IdAcceso?: string | number;
  idAcceso?: string | number;
  Nombre?: string;
  nombre?: string;
};

const normalizeCedula = (value?: string | null) => (value ?? "").replace(/\D+/g, "");

const toFusionarDate = (value?: string | null) => {
  const date = value ? new Date(`${value}T23:59:59`) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${value} 23:59:59`;
};

const splitName = (value?: string | null) => {
  const names = (value ?? "Socio sin nombre").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: names.slice(0, Math.max(1, Math.ceil(names.length / 2))).join(" "),
    lastName: names.slice(Math.max(1, Math.ceil(names.length / 2))).join(" ") || "-",
  };
};

const employeeIdFrom = (value: FusionarEmployee | null | undefined): string | null => {
  const record = value?.data ?? value;
  const id = record?.IdFuncionario ?? record?.idFuncionario;
  return id === null || id === undefined ? null : String(id);
};

const markIdFrom = (mark: FusionarMark) =>
  mark.IdMarca ?? mark.idMarca ?? null;

const markEmployeeIdFrom = (mark: FusionarMark) => {
  const id =
    mark.IdFuncionario ??
    mark.idFuncionario ??
    mark.Funcionario?.IdFuncionario ??
    mark.Funcionario?.idFuncionario ??
    null;
  return id === null || id === undefined ? null : String(id);
};

const markDateFrom = (mark: FusionarMark) => mark.FechaHora ?? mark.fechaHora ?? null;

const markAccessIdFrom = (mark: FusionarMark) => {
  const id =
    mark.IdAcceso ??
    mark.idAcceso ??
    mark.Acceso?.IdAcceso ??
    mark.Acceso?.idAcceso ??
    null;
  return id === null || id === undefined ? null : String(id);
};

const accessIdFrom = (access: FusionarAccess | null | undefined) => {
  const id = access?.IdAcceso ?? access?.idAcceso;
  return id === null || id === undefined ? null : String(id);
};

const accessNameFrom = (access: FusionarAccess | null | undefined) =>
  access?.Nombre ?? access?.nombre ?? null;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const toFusionarId = (value: string) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : value;
};

const buildEmployeePayload = (member: LocalMember, accessId: string) => {
  const names = splitName(member.name);
  const cedula = normalizeCedula(member.cedula);
  const validUntil = toFusionarDate(member.next_payment);
  const isActive = member.status !== "inactive" && member.status !== "expired" && Boolean(validUntil);

  return {
    TieneAutocon: false,
    PuedeMarcarAutoges: false,
    ForzarCambioClaveAutocon: false,
    Documento: cedula,
    IdRegimenHorario: null,
    Nombres: names.firstName,
    Apellidos: names.lastName,
    Correo: member.email?.trim() || "",
    Telefono: member.phone?.trim() || "",
    EmpresaNombre: "",
    IdEmpresa2: null,
    IdTorre: null,
    IdUnidad: null,
    IdSector: null,
    IMEI: "",
    NroTarjeta: null,
    // El acceso es el que vincula al socio con el equipo/molinete de Fusionar.
    // Sin esta asociación el funcionario puede existir en FSClock pero el
    // terminal no tendría por qué autorizarle el ingreso.
    Accesos: [{ IdAcceso: toFusionarId(accessId) }],
    Observacion: "Sincronizado desde GymManagerPro",
    Activo: isActive,
    // Fusionar marca este campo como obligatorio. Un socio sin vencimiento
    // cargado queda explícitamente inactivo en vez de habilitarse por error.
    VigenciaHasta: validUntil ?? "2000-01-01 00:00:00",
    AdministraEquipos: false,
    NroSocio: null,
    IdTipoCuota: null,
    PasaCeroHoras: false,
    AjustaMarcasHasta: null,
    VtoCarneSalud: null,
    UltimaCuota: member.next_payment || null,
  };
};

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Debes indicar el gimnasio." }, { status: 400 });
  }

  const authorization = await authorizeGymRequest(request, parsed.data.gymId);
  if ("error" in authorization) return authorization.error;

  const supabase = createClient();
  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("uses_facial_access")
    .eq("id", parsed.data.gymId)
    .maybeSingle();

  if (gymError || !gym?.uses_facial_access) {
    return NextResponse.json({ enabled: false });
  }

  const { data: config, error: configError } = await supabase
    .from("fusionar_integration_configs")
    .select("is_enabled, api_base_url, access_id, last_member_sync_at, last_access_sync_at, last_error")
    .eq("gym_id", parsed.data.gymId)
    .maybeSingle();

  if (configError) {
    if (isMissingRelation(configError.message)) {
      return NextResponse.json({ enabled: false, setupRequired: true });
    }
    console.error("Error loading Fusionar config", configError);
    return NextResponse.json({ error: "No se pudo leer la configuracion facial." }, { status: 500 });
  }

  const { count: linkedMembers } = await supabase
    .from("fusionar_member_links")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", parsed.data.gymId);

  return NextResponse.json({
    enabled: Boolean(config?.is_enabled),
    configured: Boolean(config?.api_base_url),
    accessConfigured: Boolean(config?.access_id),
    credentialsConfigured: Boolean(getFusionarCredentials(parsed.data.gymId)),
    linkedMembers: linkedMembers ?? 0,
    lastMemberSyncAt: config?.last_member_sync_at ?? null,
    lastAccessSyncAt: config?.last_access_sync_at ?? null,
    lastError: config?.last_error ?? null,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud facial invalida." }, { status: 400 });
  }

  const authorization = await authorizeGymRequest(request, parsed.data.gymId);
  if ("error" in authorization) return authorization.error;

  const supabase = createClient();
  const { data: config, error: configError } = await supabase
    .from("fusionar_integration_configs")
    .select("is_enabled, api_base_url, access_id, last_access_sync_at")
    .eq("gym_id", parsed.data.gymId)
    .maybeSingle();

  if (configError || !config?.is_enabled) {
    return NextResponse.json({ error: "La integracion facial no esta habilitada." }, { status: 403 });
  }

  const credentials = getFusionarCredentials(parsed.data.gymId);
  if (!credentials) {
    return NextResponse.json(
      { error: "Faltan las credenciales privadas de Fusionar en el servidor." },
      { status: 409 }
    );
  }

  try {
    const session = await createFusionarSession(credentials, config.api_base_url);

    if (parsed.data.action === "connection_check") {
      if (!config.access_id) {
        return NextResponse.json(
          { error: "Falta configurar el ID de acceso de Fusionar para este gimnasio." },
          { status: 409 }
        );
      }

      const access = await fusionarRequest<FusionarAccess>(
        session,
        `/accesos/${encodeURIComponent(String(config.access_id))}`
      );
      const receivedAccessId = accessIdFrom(access);
      if (receivedAccessId && receivedAccessId !== String(config.access_id)) {
        throw new Error("Fusionar devolvió un acceso diferente al configurado.");
      }

      await supabase
        .from("fusionar_integration_configs")
        .update({ last_error: null, updated_at: new Date().toISOString() })
        .eq("gym_id", parsed.data.gymId);
      return NextResponse.json({
        ok: true,
        message: "Conexión con Fusionar confirmada.",
        access: {
          id: receivedAccessId ?? String(config.access_id),
          name: accessNameFrom(access) ?? null,
        },
      });
    }

    if (parsed.data.action === "sync_accesses") {
      if (!config.access_id) {
        return NextResponse.json(
          { error: "Falta configurar el ID de acceso de Fusionar para importar las marcas del molinete." },
          { status: 409 }
        );
      }

      const { data: links, error: linksError } = await supabase
        .from("fusionar_member_links")
        .select("member_id, fusionar_employee_id")
        .eq("gym_id", parsed.data.gymId)
        .not("fusionar_employee_id", "is", null);
      if (linksError) throw new Error("No se pudieron leer los vínculos de Fusionar.");

      const externalToMember = new Map(
        (links ?? []).map((link) => [String(link.fusionar_employee_id), String(link.member_id)])
      );
      const startDate =
        parsed.data.startDate ??
        (config.last_access_sync_at
          ? isoDate(new Date(config.last_access_sync_at))
          : isoDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)));
      const endDate = parsed.data.endDate ?? isoDate(new Date());

      const marks = await fusionarRequest<{ data?: FusionarMark[] }>(
        session,
        `/marcas/acceso?FechaDesde=${encodeURIComponent(startDate)}&FechaHasta=${encodeURIComponent(endDate)}&IdAcceso=${encodeURIComponent(String(config.access_id))}`
      );
      const receivedMarks = Array.isArray(marks?.data) ? marks.data : [];
      const unscopedMarks = receivedMarks.filter((mark) => !markAccessIdFrom(mark));
      if (unscopedMarks.length > 0) {
        throw new Error(
          "Fusionar devolvió marcas sin identificar el acceso. Confirmá con su soporte el campo o filtro del molinete antes de importarlas."
        );
      }
      const selectedMarks = receivedMarks.filter(
        (mark) => markAccessIdFrom(mark) === String(config.access_id)
      );
      const memberIds = [...new Set([...externalToMember.values()])];
      const { data: members, error: membersError } = memberIds.length
        ? await supabase
            .from("members")
            .select("id, name, cedula, next_payment")
            .eq("gym_id", parsed.data.gymId)
            .in("id", memberIds)
        : { data: [], error: null };
      if (membersError) throw new Error("No se pudieron preparar los accesos para importar.");
      const membersById = new Map((members ?? []).map((member) => [String(member.id), member]));

      const { data: run } = await supabase
        .from("fusionar_sync_runs")
        .insert({
          gym_id: parsed.data.gymId,
          run_type: "accesses",
          status: "started",
          processed_count: selectedMarks.length,
          details: { startDate, endDate },
        })
        .select("id")
        .maybeSingle();

      let successCount = 0;
      let skippedCount = 0;
      const failures: string[] = [];
      for (const mark of selectedMarks) {
        const externalMarkId = markIdFrom(mark);
        const externalEmployeeId = markEmployeeIdFrom(mark);
        const member = externalEmployeeId ? membersById.get(externalToMember.get(externalEmployeeId) ?? "") : null;
        const occurredAt = markDateFrom(mark);
        if (!externalMarkId || !member || !occurredAt) {
          skippedCount += 1;
          continue;
        }
        try {
          const evaluation = evaluateMemberAccess({
            id: String(member.id),
            name: member.name ?? "Socio",
            next_payment: member.next_payment,
          });
          const { error: insertError } = await supabase.from("member_access_logs").upsert(
            {
              id: `fusionar:${parsed.data.gymId}:${externalMarkId}`,
              gym_id: parsed.data.gymId,
              member_id: evaluation.memberId,
              member_name: evaluation.memberName,
              cedula_entered: member.cedula ?? "",
              normalized_cedula: normalizeCedula(member.cedula),
              result: evaluation.status,
              status_color: evaluation.color,
              message: evaluation.message,
              days_remaining: evaluation.daysRemaining,
              days_expired: evaluation.daysExpired,
              created_at: occurredAt,
              source: "fusionar_facial",
              external_event_id: String(externalMarkId),
            },
            { onConflict: "id" }
          );
          if (insertError) throw insertError;
          successCount += 1;
        } catch (error) {
          failures.push(error instanceof Error ? error.message : "No se pudo importar una marca.");
        }
      }

      const runStatus = failures.length === 0 ? "success" : successCount > 0 ? "partial" : "error";
      if (run?.id) {
        await supabase
          .from("fusionar_sync_runs")
          .update({
            status: runStatus,
            success_count: successCount,
            error_count: failures.length,
            details: {
              startDate,
              endDate,
              ignoredOtherAccesses: receivedMarks.length - selectedMarks.length,
              skippedWithoutLink: skippedCount,
              failures: failures.slice(0, 20),
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);
      }
      await supabase
        .from("fusionar_integration_configs")
        .update({
          last_access_sync_at: new Date().toISOString(),
          last_error: failures.length ? failures.slice(0, 2).join(" | ") : null,
          updated_at: new Date().toISOString(),
        })
        .eq("gym_id", parsed.data.gymId);
      return NextResponse.json({
        ok: failures.length === 0,
        message: `Importación terminada: ${successCount} acceso(s) agregados${skippedCount ? `; ${skippedCount} sin socio vinculado.` : "."}`,
        processed: selectedMarks.length,
        successCount,
        skippedCount,
        failures,
      });
    }

    if (!config.access_id) {
      return NextResponse.json(
        { error: "Falta configurar el ID de acceso de Fusionar para sincronizar socios con el molinete." },
        { status: 409 }
      );
    }

    let memberQuery = supabase
      .from("members")
      .select("id, name, email, phone, cedula, next_payment, status")
      .eq("gym_id", parsed.data.gymId)
      .not("cedula", "is", null);

    if (parsed.data.memberId) memberQuery = memberQuery.eq("id", parsed.data.memberId);

    const { data: members, error: membersError } = await memberQuery;
    if (membersError) throw new Error("No se pudieron leer los socios para sincronizar.");

    const eligibleMembers = ((members ?? []) as LocalMember[]).filter(
      (member) => normalizeCedula(member.cedula).length >= 6
    );
    const { data: run } = await supabase
      .from("fusionar_sync_runs")
      .insert({
        gym_id: parsed.data.gymId,
        run_type: "members",
        status: "started",
        processed_count: eligibleMembers.length,
      })
      .select("id")
      .maybeSingle();

    let successCount = 0;
    const failures: string[] = [];

    for (const member of eligibleMembers) {
      const cedula = normalizeCedula(member.cedula);
      try {
        let existing: FusionarEmployee | null = null;
        try {
          existing = await fusionarRequest<FusionarEmployee>(
            session,
            `/funcionarios/get-by-documento/${encodeURIComponent(cedula)}`
          );
        } catch (error) {
          if (!(error instanceof FusionarApiError) || error.status !== 404) throw error;
        }

        const knownExternalId = employeeIdFrom(existing);
        const payload = buildEmployeePayload(member, String(config.access_id));
        const saved = knownExternalId
          ? await fusionarRequest<FusionarEmployee>(session, `/funcionarios/${knownExternalId}`, {
              method: "PUT",
              body: { ...payload, ActualizarFoto: false },
            })
          : await fusionarRequest<FusionarEmployee>(session, "/funcionarios", {
              method: "POST",
              body: payload,
            });
        const externalId = employeeIdFrom(saved) ?? knownExternalId;

        const { error: linkError } = await supabase.from("fusionar_member_links").upsert(
          {
            gym_id: parsed.data.gymId,
            member_id: member.id,
            normalized_cedula: cedula,
            fusionar_employee_id: externalId,
            sync_status: "manual_enrollment_pending",
            face_enrollment_status: "pending",
            last_synced_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "gym_id,member_id" }
        );
        if (linkError) throw new Error("Fusionar respondió, pero no se pudo guardar el vínculo local.");
        successCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        failures.push(`${member.name || cedula}: ${message}`);
        await supabase.from("fusionar_member_links").upsert(
          {
            gym_id: parsed.data.gymId,
            member_id: member.id,
            normalized_cedula: cedula,
            sync_status: "error",
            face_enrollment_status: "unknown",
            last_error: message,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "gym_id,member_id" }
        );
      }
    }

    const runStatus = failures.length === 0 ? "success" : successCount > 0 ? "partial" : "error";
    if (run?.id) {
      await supabase
        .from("fusionar_sync_runs")
        .update({
          status: runStatus,
          success_count: successCount,
          error_count: failures.length,
          details: { failures: failures.slice(0, 20) },
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    await supabase
      .from("fusionar_integration_configs")
      .update({
        last_member_sync_at: new Date().toISOString(),
        last_error: failures.length ? failures.slice(0, 2).join(" | ") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("gym_id", parsed.data.gymId);
    return NextResponse.json({
      ok: failures.length === 0,
      message: `Sincronización terminada: ${successCount} socio(s) enviados a Fusionar${failures.length ? `; ${failures.length} con aviso.` : "."}`,
      processed: eligibleMembers.length,
      successCount,
      failures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo conectar con Fusionar.";
    await supabase
      .from("fusionar_integration_configs")
      .update({ last_error: message, updated_at: new Date().toISOString() })
      .eq("gym_id", parsed.data.gymId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
