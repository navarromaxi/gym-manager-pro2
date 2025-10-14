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

const FACTURA_FIELD_ORDER: string[] = [
  "userid",
  "customerid",
  "empresaid",
  "codsucursal",
  "sucursal",
  "facturareferencia",
  "contnumero",
  "contserie",
  "seriereferencia",
  "fechavencimiento",
  "fechafacturacion",
  "moneda",
  "additionalinfo",
  "terms_conditions",
  "payment_type",
  "cotizacion",
  "typecfe",
  "ordencompra",
  "lugarentrega",
  "periododesde",
  "periodohasta",
  "clicountry",
  "nomneg",
  "rutneg",
  "dirneg",
  "cityneg",
  "stateneg",
  "addinfoneg",
  "lineas",
  "indicadorfacturacion",
  "password",
  "typedoc",
  "environment",
  "facturaext",
  "TipoTraslado",
];

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
  paymentType: number | null;
  rutneg: string | null;
  dirneg: string | null;
  cityneg: string | null;
  stateneg: string | null;
  addinfoneg: string | null;
  facturaext: string | null;
};

const buildFacturaPayload = (
  invoice: InvoicePayload,
  overrides: InvoicePayload
) => {
  const merged: InvoicePayload = { ...invoice };

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    merged[key] = value;
  });

  const payload: Record<string, string> = {};

  FACTURA_FIELD_ORDER.forEach((field) => {
    if (!(field in merged)) {
      return;
    }

    const value = merged[field];
    if (value === undefined || value === null) {
      return;
    }
    payload[field] = typeof value === "string" ? value : String(value);
  });


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

const sanitizeDateString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

    let sanitizedLineas = String(invoice.lineas ?? "");
    sanitizedLineas = sanitizedLineas.replace(/<\s*col\s*\/>/gi, "</col/>");
    sanitizedLineas = sanitizedLineas.trim().replace(/,+$/, "");
    sanitizedLineas = sanitizedLineas.trim();
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
         "invoice_user_id, invoice_company_id, invoice_branch_code, invoice_branch_id, invoice_password, invoice_environment, invoice_customer_id, invoice_series, invoice_currency, invoice_cotizacion, invoice_typecfe, invoice_tipo_traslado, invoice_payment_type, invoice_rutneg, invoice_dirneg, invoice_cityneg, invoice_stateneg, invoice_addinfoneg, invoice_facturaext"
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
      paymentType: parseOptionalNumber(gymConfigRow?.invoice_payment_type),
      rutneg: parseOptionalString(gymConfigRow?.invoice_rutneg),
      dirneg: parseOptionalString(gymConfigRow?.invoice_dirneg),
      cityneg: parseOptionalString(gymConfigRow?.invoice_cityneg),
      stateneg: parseOptionalString(gymConfigRow?.invoice_stateneg),
      addinfoneg: parseOptionalString(gymConfigRow?.invoice_addinfoneg),
      facturaext: parseOptionalString(gymConfigRow?.invoice_facturaext),
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

    const today = new Date().toISOString().split("T")[0];
    const invoiceIssueDate = sanitizeDateString(invoice.fechafacturacion);
    const invoiceDueDate = sanitizeDateString(invoice.fechavencimiento);

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
      fechavencimiento: invoiceDueDate ?? "",
      fechafacturacion: invoiceIssueDate ?? today,
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
          : resolvedCredentials.paymentType ?? 1,
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
      dirneg:
        typeof invoice.dirneg === "string" && invoice.dirneg.trim().length > 0
          ? invoice.dirneg
          : resolvedCredentials.dirneg ?? "",
      cityneg:
        typeof invoice.cityneg === "string" && invoice.cityneg.trim().length > 0
          ? invoice.cityneg
          : resolvedCredentials.cityneg ?? "",
      stateneg:
        typeof invoice.stateneg === "string" &&
        invoice.stateneg.trim().length > 0
          ? invoice.stateneg
          : resolvedCredentials.stateneg ?? "",
      addinfoneg:
        typeof invoice.addinfoneg === "string" &&
        invoice.addinfoneg.trim().length > 0
          ? invoice.addinfoneg
          : resolvedCredentials.addinfoneg ?? "",
      lineas: sanitizedLineas,
      indicadorfacturacion: invoice.indicadorfacturacion ?? "",
      typedoc: invoice.typedoc ?? 2,
      environment:
        typeof invoice.environment === "string" &&
        invoice.environment.trim().length > 0
          ? invoice.environment
          : resolvedCredentials.environment ?? FACTURA_LIVE_DEFAULT_ENVIRONMENT,
      facturaext:
        typeof invoice.facturaext === "string" && invoice.facturaext.trim().length > 0
          ? invoice.facturaext
          : typeof invoice.facturaext === "number" && Number.isFinite(invoice.facturaext)
          ? String(invoice.facturaext)
          : resolvedCredentials.facturaext ?? paymentId,
      TipoTraslado:
        typeof invoice.TipoTraslado === "number" &&
        Number.isFinite(invoice.TipoTraslado)
          ? invoice.TipoTraslado
          : resolvedCredentials.tipoTraslado ?? 1,
    };

    const payload = buildFacturaPayload(invoice, defaults);
    const payloadForStorage: Record<string, string> = { ...payload };
    if (typeof payloadForStorage.password === "string") {
      payloadForStorage.password = "<hidden>";
    }

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

      const selection =
      "id, gym_id, payment_id, member_id, member_name, total, currency, status, invoice_number, invoice_series, external_invoice_id, environment, typecfe, issued_at, due_date, request_payload, response_payload, created_at, updated_at";

    const invoiceRecord = {
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
      issued_at: invoiceIssueDate ?? today,
      due_date: invoiceDueDate,
      request_payload: payloadForStorage,
      response_payload: parsedResponse ?? { raw: rawResponse },
    };

    const { data: storedInvoice, error: insertError } = await supabase
      .from("invoices")
      .insert(invoiceRecord)
      .select(selection)
      .single();

    if (insertError) {
      console.error("Error guardando la factura en la base de datos", insertError);

      if (insertError.code === "23505") {
        const { data: updatedInvoice, error: updateError } = await supabase
          .from("invoices")
          .update(invoiceRecord)
          .eq("gym_id", gymId)
          .eq("payment_id", paymentId)
          .select(selection)
          .single();

        if (!updateError && updatedInvoice) {
          return NextResponse.json({
            invoice: updatedInvoice,
            externalResponse: parsedResponse,
            rawResponse,
            reusedExistingInvoice: true,
          });
        }

        console.error(
          "Error actualizando la factura existente tras un conflicto de duplicado",
          updateError
        );
      }
      
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