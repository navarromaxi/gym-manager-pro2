import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

const FACTURA_LIVE_ENDPOINT =
  process.env.FACTURA_LIVE_ENDPOINT?.trim() ||
  "https://www.facturalive.com/api/envia-factura_test.php";

const FACTURA_LIVE_USER_ID = process.env.FACTURA_LIVE_USER_ID?.trim() || "1021";
const FACTURA_LIVE_COMPANY_ID =
  process.env.FACTURA_LIVE_COMPANY_ID?.trim() || "283";
const FACTURA_LIVE_BRANCH_CODE =
  process.env.FACTURA_LIVE_BRANCH_CODE?.trim() || "1";
const FACTURA_LIVE_BRANCH_ID =
  process.env.FACTURA_LIVE_BRANCH_ID?.trim() || "287";
const FACTURA_LIVE_PASSWORD =
  process.env.FACTURA_LIVE_PASSWORD?.trim() || "picoton";
const FACTURA_LIVE_DEFAULT_ENVIRONMENT =
  process.env.FACTURA_LIVE_ENVIRONMENT?.trim() || "TEST";

type InvoicePayload = Record<string, string | number | undefined | null>;

type ResolvedCredentials = {
  userId: string | null;
  companyId: string | null;
  branchCode: string | null;
  branchId: string | null;
  password: string | null;
  environment: string | null;
  customerId: number | null;
  series: string | null;
  currency: string | null;
  cotizacion: number | null;
  typecfe: number | null;
  tipoTraslado: number | null;
  rutneg: string | null;
};

const buildFacturaPayload = (
  invoice: InvoicePayload,
  overrides: InvoicePayload
) => {
  const payload: Record<string, string> = {};

  const append = (key: string, value: string | number | undefined | null) => {
    if (value === undefined || value === null) {
      return;
    }
    payload[key] = typeof value === "string" ? value : String(value);
  };

  Object.entries(invoice).forEach(([key, value]) => append(key, value));
  Object.entries(overrides).forEach(([key, value]) => append(key, value));

  return payload;
};

const parseFacturaResponse = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const parseOptionalString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  return null;
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const normalizeEnvironment = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized === "PROD" || normalized === "TEST" ? normalized : null;
};

type CredentialKey = "userId" | "companyId" | "branchCode" | "branchId" | "password";

const REQUIRED_CREDENTIALS: { key: CredentialKey; label: string }[] = [
  { key: "userId", label: "userid" },
  { key: "companyId", label: "empresaid" },
  { key: "branchCode", label: "codsucursal" },
  { key: "branchId", label: "sucursal" },
  { key: "password", label: "password" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      gymId,
      paymentId,
      memberId,
      memberName,
      amount,
      invoice,
    }: {
      gymId?: string;
      paymentId?: string;
      memberId?: string | null;
      memberName?: string;
      amount?: number;
      invoice?: InvoicePayload;
    } = body ?? {};

    if (!gymId || !paymentId || !invoice || typeof amount !== "number") {
      return NextResponse.json(
        {
          error:
            "Faltan datos obligatorios para emitir la factura. Verifica la información enviada.",
        },
        { status: 400 }
      );
    }

    const sanitizedLineas = String(invoice.lineas ?? "").trim();
    if (!sanitizedLineas) {
      return NextResponse.json(
        {
          error:
            "No se encontraron ítems para la factura. Asegúrate de completar el detalle de líneas.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: gymConfigRow, error: gymConfigError } = await supabase
      .from("gyms")
      .select(
        "invoice_user_id, invoice_company_id, invoice_branch_code, invoice_branch_id, invoice_password, invoice_environment, invoice_customer_id, invoice_series, invoice_currency, invoice_cotizacion, invoice_typecfe, invoice_tipo_traslado, invoice_rutneg"
      )
      .eq("id", gymId)
      .maybeSingle();

    if (gymConfigError) {
      console.error(
        "Error obteniendo la configuración de facturación del gimnasio",
        gymConfigError
      );
      return NextResponse.json(
        {
          error:
            "No pudimos obtener las credenciales de facturación del gimnasio. Revisa la configuración en Supabase e intenta nuevamente.",
        },
        { status: 500 }
      );
    }

    const resolvedCredentials: ResolvedCredentials = {
      userId:
        parseOptionalString(gymConfigRow?.invoice_user_id) ||
        parseOptionalString(FACTURA_LIVE_USER_ID) ||
        null,
      companyId:
        parseOptionalString(gymConfigRow?.invoice_company_id) ||
        parseOptionalString(FACTURA_LIVE_COMPANY_ID) ||
        null,
      branchCode:
        parseOptionalString(gymConfigRow?.invoice_branch_code) ||
        parseOptionalString(FACTURA_LIVE_BRANCH_CODE) ||
        null,
      branchId:
        parseOptionalString(gymConfigRow?.invoice_branch_id) ||
        parseOptionalString(FACTURA_LIVE_BRANCH_ID) ||
        null,
      password:
        parseOptionalString(gymConfigRow?.invoice_password) ||
        parseOptionalString(FACTURA_LIVE_PASSWORD) ||
        null,
      environment: normalizeEnvironment(
        parseOptionalString(gymConfigRow?.invoice_environment)
      ),
      customerId: parseOptionalNumber(gymConfigRow?.invoice_customer_id),
      series: parseOptionalString(gymConfigRow?.invoice_series),
      currency: parseOptionalString(gymConfigRow?.invoice_currency),
      cotizacion: parseOptionalNumber(gymConfigRow?.invoice_cotizacion),
      typecfe: parseOptionalNumber(gymConfigRow?.invoice_typecfe),
      tipoTraslado: parseOptionalNumber(gymConfigRow?.invoice_tipo_traslado),
      rutneg: parseOptionalString(gymConfigRow?.invoice_rutneg),
    };

    const missingCredentials = REQUIRED_CREDENTIALS.filter(
      ({ key }) => !resolvedCredentials[key]
    );

    if (missingCredentials.length > 0) {
      const missingLabels = missingCredentials.map(
        (credential) => credential.label
      );
      return NextResponse.json(
        {
          error: `Faltan credenciales obligatorias (${missingLabels.join(", ")}) para facturar este gimnasio. Completa la configuración en la tabla gyms de Supabase, incluyendo la contraseña invoice_password.`,
          missing: missingLabels,
        },
        { status: 400 }
      );
    }

    const defaults: InvoicePayload = {
      userid: resolvedCredentials.userId!,
      empresaid: resolvedCredentials.companyId!,
      codsucursal: resolvedCredentials.branchCode!,
      sucursal: resolvedCredentials.branchId!,
      password: resolvedCredentials.password!,
      customerid:
        typeof invoice.customerid === "number" && Number.isFinite(invoice.customerid)
          ? invoice.customerid
          : resolvedCredentials.customerId ?? 0,
      facturareferencia: invoice.facturareferencia ?? paymentId,
      contnumero: invoice.contnumero ?? "",
      contserie: invoice.contserie ?? "",
      seriereferencia:
        typeof invoice.seriereferencia === "string" &&
        invoice.seriereferencia.trim().length > 0
          ? invoice.seriereferencia
          : resolvedCredentials.series ?? "A-A-A",
      fechavencimiento: invoice.fechavencimiento ?? "",
      fechafacturacion:
        invoice.fechafacturacion ?? new Date().toISOString().split("T")[0],
      moneda:
        typeof invoice.moneda === "string" && invoice.moneda.trim().length > 0
          ? invoice.moneda
          : resolvedCredentials.currency ?? "UYU",
      additionalinfo: invoice.additionalinfo ?? "",
      terms_conditions: invoice.terms_conditions ?? "",
      payment_type:
        typeof invoice.payment_type === "number" &&
        Number.isFinite(invoice.payment_type)
          ? invoice.payment_type
          : 1,
      cotizacion:
        typeof invoice.cotizacion === "number" &&
        Number.isFinite(invoice.cotizacion)
          ? invoice.cotizacion
          : resolvedCredentials.cotizacion ?? 1,
      typecfe:
        typeof invoice.typecfe === "number" && Number.isFinite(invoice.typecfe)
          ? invoice.typecfe
          : resolvedCredentials.typecfe ?? 111,
      ordencompra: invoice.ordencompra ?? "",
      lugarentrega: invoice.lugarentrega ?? "",
      periododesde: invoice.periododesde ?? "",
      periodohasta: invoice.periodohasta ?? "",
      clicountry: invoice.clicountry ?? "UY",
      nomneg: invoice.nomneg ?? memberName ?? "Cliente",
      rutneg:
        typeof invoice.rutneg === "string" && invoice.rutneg.trim().length > 0
          ? invoice.rutneg
          : resolvedCredentials.rutneg ?? "",
      dirneg: invoice.dirneg ?? "",
      cityneg: invoice.cityneg ?? "",
      stateneg: invoice.stateneg ?? "",
      addinfoneg: invoice.addinfoneg ?? "",
      lineas: sanitizedLineas,
      indicadorfacturacion: invoice.indicadorfacturacion ?? "",
      typedoc: invoice.typedoc ?? 2,
      environment:
        typeof invoice.environment === "string" &&
        invoice.environment.trim().length > 0
          ? invoice.environment
          : resolvedCredentials.environment ?? FACTURA_LIVE_DEFAULT_ENVIRONMENT,
      facturaext: invoice.facturaext ?? paymentId,
      TipoTraslado:
        typeof invoice.TipoTraslado === "number" &&
        Number.isFinite(invoice.TipoTraslado)
          ? invoice.TipoTraslado
          : resolvedCredentials.tipoTraslado ?? 1,
    };

    const payload = buildFacturaPayload(invoice, defaults);

    const encoded = new URLSearchParams(payload);
    const externalResponse = await fetch(FACTURA_LIVE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded.toString(),
    });

    const rawResponse = await externalResponse.text();
    const parsedResponse = parseFacturaResponse(rawResponse);

    if (!externalResponse.ok) {
      return NextResponse.json(
        {
          error:
            "El servicio de facturación devolvió un error. Intenta nuevamente en unos minutos.",
          rawResponse,
        },
        { status: 502 }
      );
    }

    const status =
      (parsedResponse?.status as string | undefined) ||
      (parsedResponse?.resultado as string | undefined) ||
      "procesado";
    const invoiceNumber =
      (parsedResponse?.numeroCFE as string | undefined) ||
      (parsedResponse?.invoice_number as string | undefined) ||
      null;
    const invoiceSeries =
      (parsedResponse?.serieCFE as string | undefined) ||
      (parsedResponse?.invoice_series as string | undefined) ||
      (typeof defaults.seriereferencia === "string"
        ? defaults.seriereferencia
        : null);
    const externalInvoiceId =
      (parsedResponse?.idCFE as string | undefined) ||
      (parsedResponse?.external_invoice_id as string | undefined) ||
      null;

    const { data: storedInvoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        gym_id: gymId,
        payment_id: paymentId,
        member_id: memberId ?? null,
        member_name: memberName ?? "",
        total: amount,
        currency:
          typeof payload.moneda === "string" && payload.moneda.length > 0
            ? payload.moneda
            : resolvedCredentials.currency ?? "UYU",
        status,
        invoice_number: invoiceNumber,
        invoice_series: invoiceSeries,
        external_invoice_id: externalInvoiceId,
        environment: payload.environment ?? FACTURA_LIVE_DEFAULT_ENVIRONMENT,
        typecfe:
          typeof invoice.typecfe === "number" && Number.isFinite(invoice.typecfe)
            ? invoice.typecfe
            : resolvedCredentials.typecfe ?? 111,
        issued_at:
          (typeof invoice.fechafacturacion === "string"
            ? invoice.fechafacturacion
            : null) ?? new Date().toISOString().split("T")[0],
        due_date:
          typeof invoice.fechavencimiento === "string"
            ? invoice.fechavencimiento
            : null,
        request_payload: payload,
        response_payload: parsedResponse ?? { raw: rawResponse },
      })
      .select(
        "id, gym_id, payment_id, member_id, member_name, total, currency, status, invoice_number, invoice_series, external_invoice_id, environment, typecfe, issued_at, due_date, request_payload, response_payload, created_at, updated_at"
      )
      .single();

    if (insertError) {
      console.error("Error guardando la factura en la base de datos", insertError);
      return NextResponse.json(
        {
          error:
            "La factura fue emitida pero no pudo guardarse. Revisa la solapa de Facturas más tarde.",
          rawResponse,
          externalResponse: parsedResponse,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      invoice: storedInvoice,
      externalResponse: parsedResponse,
      rawResponse,
    });
  } catch (error) {
    console.error("Error inesperado al emitir factura", error);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al emitir la factura. Intenta nuevamente en unos momentos.",
      },
      { status: 500 }
    );
  }
}