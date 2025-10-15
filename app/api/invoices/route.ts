import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

const FACTURA_LIVE_BASE_ENDPOINT = process.env.FACTURA_LIVE_ENDPOINT?.trim();
const FACTURA_LIVE_TEST_ENDPOINT =
  process.env.FACTURA_LIVE_TEST_ENDPOINT?.trim() ||
  (FACTURA_LIVE_BASE_ENDPOINT &&
  FACTURA_LIVE_BASE_ENDPOINT.toLowerCase().includes("test")
    ? FACTURA_LIVE_BASE_ENDPOINT
    : undefined) ||
  "https://www.facturalive.com/api/envia-factura_test.php";
const FACTURA_LIVE_PROD_ENDPOINT =
  process.env.FACTURA_LIVE_PROD_ENDPOINT?.trim() ||
  (FACTURA_LIVE_BASE_ENDPOINT &&
  !FACTURA_LIVE_BASE_ENDPOINT.toLowerCase().includes("test")
    ? FACTURA_LIVE_BASE_ENDPOINT
    : undefined) ||
  "https://www.facturalive.com/api/envia-factura.php";

const FACTURA_LIVE_USER_ID = process.env.FACTURA_LIVE_USER_ID?.trim() || "1021";
const FACTURA_LIVE_COMPANY_ID =
  process.env.FACTURA_LIVE_COMPANY_ID?.trim() || "283";
const FACTURA_LIVE_BRANCH_CODE =
  process.env.FACTURA_LIVE_BRANCH_CODE?.trim() || "1";
const FACTURA_LIVE_BRANCH_ID =
  process.env.FACTURA_LIVE_BRANCH_ID?.trim() || "287";
const FACTURA_LIVE_PASSWORD =
  process.env.FACTURA_LIVE_PASSWORD?.trim() || "picoton";
const rawDefaultEnvironment = process.env.FACTURA_LIVE_ENVIRONMENT?.trim();

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


const resolveFacturaEndpoint = (environment: string | null | undefined) =>
  environment === "PROD"
    ? FACTURA_LIVE_PROD_ENDPOINT
    : FACTURA_LIVE_TEST_ENDPOINT;

  const ALLOW_EMPTY = new Set([
  "customerid",
  "contnumero",
  "contserie",
  "fechavencimiento",
  "additionalinfo",
  "terms_conditions",
  "ordencompra",
  "lugarentrega",
  "periododesde",
  "periodohasta",
  "indicadorfacturacion",
]);

const shouldIncludeFacturaField = (field: string, value: unknown) => {
  if (value === undefined || value === null) return false;

  // siempre incluir customerid aunque sea 0
  if (field === "customerid") return true;

  if (typeof value === "number") return Number.isFinite(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      // para estos campos, enviar aunque esté vacío
      return ALLOW_EMPTY.has(field);
    }
    return true;
  }
  return false;
};


const buildFacturaPayload = (
  invoice: InvoicePayload,
  overrides: InvoicePayload
) => {
  const merged: InvoicePayload = {};

  Object.entries(overrides).forEach(([key, value]) => {
    if (!shouldIncludeFacturaField(key, value)) {
      return;
    }
    merged[key as keyof InvoicePayload] = value;
  });

  Object.entries(invoice).forEach(([key, value]) => {
    if (!shouldIncludeFacturaField(key, value)) {
      return;
    }
    merged[key as keyof InvoicePayload] = value;
  });

  const payload: Record<string, string> = {};

  FACTURA_FIELD_ORDER.forEach((field) => {
    if (!(field in merged)) {
      return;
    }

    const value = merged[field];
    if (!shouldIncludeFacturaField(field, value)) {
      return;
    }
    payload[field] =
      typeof value === "string" ? value.trim() : String(value);
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

const collectStringValues = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item));
  }

  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => collectStringValues(item));
  }

  return [];
};

const extractFacturaMessages = (parsed: unknown): string[] => {
  if (!parsed || typeof parsed !== "object") return [];

  const normalizedEntries = Object.entries(parsed).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]) as [string, unknown][];

  const interestingKeys = new Set(
    [
      "mensaje",
      "mensajes",
      "message",
      "messages",
      "error",
      "errors",
      "detalle",
      "detalle_error",
      "descripcion",
      "descripcion_error",
      "observaciones",
      "observacion",
      "causas",
      "causa",
    ].map((value) => value.toLowerCase())
  );

  const messages = normalizedEntries
    .filter(([key]) => interestingKeys.has(key))
    .flatMap(([, value]) => collectStringValues(value))
    .filter((value, index, array) => array.indexOf(value) === index);

  if (messages.length > 0) {
    return messages;
  }

  const statusValue =
    typeof (parsed as Record<string, unknown>).status === "string"
      ? (parsed as Record<string, string>).status.trim()
      : null;

  if (statusValue) {
    return [`Estado devuelto por FacturaLive: ${statusValue}`];
  }

  const codeValue =
    typeof (parsed as Record<string, unknown>).codigo === "string"
      ? (parsed as Record<string, string>).codigo.trim()
      : null;

  if (codeValue) {
    return [`Código devuelto por FacturaLive: ${codeValue}`];
  }

  return [];
};

const FACTURA_SUCCESS_KEYWORDS = [
  "procesado",
  "aceptado",
  "aprobado",
  "ok",
  "success",
  "emitido",
];

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
   if (["PROD", "PRODUCCION", "PRODUCCIÓN", "PRODUCTION"].includes(normalized)) {
    return "PROD";
  }

  if (
    [
      "TEST",
      "HOMOLOGACION",
      "HOMOLOGACIÓN",
      "HOMOLOGA",
      "HOMO",
    ].includes(normalized)
  ) {
    return "TEST";
  }

  return null;
};

const FACTURA_LIVE_DEFAULT_ENVIRONMENT =
  normalizeEnvironment(rawDefaultEnvironment) ?? "TEST";

  type DebugSource = "server" | "facturalive" | "database";

type DebugStep = {
  at: string;
  step: string;
  source: DebugSource;
  data?: unknown;
};

const sanitizeDebugData = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDebugData(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (key.toLowerCase().includes("password")) {
          return [key, "<hidden>"];
        }
        return [key, sanitizeDebugData(item)];
      })
    );
  }

  return value;
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

function enforceCfeConsistency(p: Record<string, string>) {
  const t = p.typecfe?.toString();

  // e-Ticket (consumidor final): no debe llevar RUT/typedoc
  if (t === "111") {
    delete p.rutneg;
    delete p.typedoc;
  }

  // e-Factura (empresa con RUT): debe llevar rutneg + typedoc=2
  if (t === "101") {
    if (!p.rutneg || p.rutneg.trim().length === 0) {
      throw new Error("Para e-Factura (typecfe=101) es obligatorio enviar rutneg.");
    }
    p.typedoc = "2";
  }
}


export async function POST(request: Request) {
  const debugSteps: DebugStep[] = [];
  const recordStep = (
    step: string,
    data?: unknown,
    source: DebugSource = "server"
  ) => {
    const entry: DebugStep = {
      at: new Date().toISOString(),
      step,
      source,
    };
    if (data !== undefined) {
      entry.data = sanitizeDebugData(data);
    }
    debugSteps.push(entry);
  };
  try {
    recordStep("Solicitud recibida en el backend de facturación");

    let body: unknown;
    try {
      body = await request.json();
      recordStep("Cuerpo de la solicitud convertido a JSON", {
        keys:
          body && typeof body === "object"
            ? Object.keys(body as Record<string, unknown>)
            : [],
      });
    } catch (parseError) {
      recordStep(
        "No se pudo interpretar el cuerpo de la solicitud",
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        }
      );
      return NextResponse.json(
        {
          error:
            "El servidor no pudo interpretar los datos enviados. Verifica la estructura del pedido.",
          debugSteps,
        },
        { status: 400 }
      );
    }

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
    } = (body as Record<string, unknown>) ?? {};

    recordStep("Datos recibidos para facturación", {
      gymId,
      paymentId,
      memberId,
      amount,
      hasInvoice: Boolean(invoice),
    });

    if (!gymId || !paymentId || !invoice || typeof amount !== "number") {
      recordStep("Solicitud rechazada por datos incompletos", {
        gymId,
        paymentId,
        amount,
        hasInvoice: Boolean(invoice),
        amountType: typeof amount,
      });
      return NextResponse.json(
        {
          error:
            "Faltan datos obligatorios para emitir la factura. Verifica la información enviada.",
          debugSteps,
        },
        { status: 400 }
      );
    }

    let sanitizedLineas = String(invoice.lineas ?? "");
    sanitizedLineas = sanitizedLineas.replace(/<\s*col\s*\/>/gi, "</col/>");
    sanitizedLineas = sanitizedLineas.trim().replace(/,+$/, "");
    sanitizedLineas = sanitizedLineas.trim();
    recordStep("Líneas sanitizadas", {
      length: sanitizedLineas.length,
      preview: sanitizedLineas.slice(0, 200),
    });
    if (!sanitizedLineas) {
      recordStep(
        "Solicitud rechazada: no se encontraron líneas de factura"
      );
      return NextResponse.json(
        {
          error:
            "No se encontraron ítems para la factura. Asegúrate de completar el detalle de líneas.",
            debugSteps,
        },
        { status: 400 }
      );
    }

    const supabase = createClient();
    recordStep("Obteniendo configuración de facturación del gimnasio", { gymId });

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
      recordStep(
        "Error al obtener la configuración del gimnasio",
        {
          message: gymConfigError.message,
          details: gymConfigError.details,
          hint: gymConfigError.hint,
        },
        "database"
      );
      return NextResponse.json(
        {
          error:
            "No pudimos obtener las credenciales de facturación del gimnasio. Revisa la configuración en Supabase e intenta nuevamente.",
          debugSteps,},
        { status: 500 }
      );
    }




    recordStep(
      "Configuración del gimnasio obtenida",
      { gymConfigRow },
      "database"
    );

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

    recordStep("Credenciales resueltas para FacturaLive", {
      resolvedCredentials,
    });

    const missingCredentials = REQUIRED_CREDENTIALS.filter(
      ({ key }) => !resolvedCredentials[key]
    );

    if (missingCredentials.length > 0) {
      const missingLabels = missingCredentials.map(
        (credential) => credential.label
      );
      recordStep("Faltan credenciales obligatorias", { missing: missingLabels });
      return NextResponse.json(
        {
          error: `Faltan credenciales obligatorias (${missingLabels.join(", ")}) para facturar este gimnasio. Completa la configuración en la tabla gyms de Supabase, incluyendo la contraseña invoice_password.`,
          missing: missingLabels,
          debugSteps,
        },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
const requestedIssueDate = sanitizeDateString(invoice.fechafacturacion);
const invoiceIssueDate =
  requestedIssueDate && requestedIssueDate <= today ? requestedIssueDate : today;
    const invoiceDueDate = sanitizeDateString(invoice.fechavencimiento);

    const invoiceEnvironmentOverride = normalizeEnvironment(
      parseOptionalString(invoice.environment)
    );
    const effectiveEnvironment =
      invoiceEnvironmentOverride ||
      resolvedCredentials.environment ||
      FACTURA_LIVE_DEFAULT_ENVIRONMENT;

      recordStep("Ambiente de facturación determinado", {
      invoiceEnvironmentOverride,
      effectiveEnvironment,
    });

    const defaults: InvoicePayload = {
      userid: resolvedCredentials.userId!,
      customerid:
  typeof invoice.customerid === "number" && Number.isFinite(invoice.customerid)
    ? invoice.customerid
    : (resolvedCredentials.customerId ?? 0),

      empresaid: resolvedCredentials.companyId!,
      codsucursal: resolvedCredentials.branchCode!,
      sucursal: resolvedCredentials.branchId!,
      password: resolvedCredentials.password!,
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
      //typedoc: invoice.typedoc ?? 2,
      environment: effectiveEnvironment,
      facturaext: (() => {
  // priorizá lo que viene en la request
  if (typeof invoice.facturaext === "string" && invoice.facturaext.trim().length > 0) {
    return invoice.facturaext;
  }
  if (typeof invoice.facturaext === "number" && Number.isFinite(invoice.facturaext)) {
    return String(invoice.facturaext);
  }
  // si la de Supabase parece contener líneas (</col/>), ignorarla
  if (resolvedCredentials.facturaext && resolvedCredentials.facturaext.includes("</col/>")) {
    return paymentId;
  }
  return resolvedCredentials.facturaext ?? paymentId;
})(),
      TipoTraslado:
        typeof invoice.TipoTraslado === "number" &&
        Number.isFinite(invoice.TipoTraslado) &&
        invoice.TipoTraslado > 0
          ? invoice.TipoTraslado
          : resolvedCredentials.tipoTraslado && resolvedCredentials.tipoTraslado > 0
          ? resolvedCredentials.tipoTraslado
          : undefined,
    };

    const payload = buildFacturaPayload(invoice, defaults);
    
    const facturaEndpoint = resolveFacturaEndpoint(effectiveEnvironment);
    const payloadForStorage: Record<string, string> = { ...payload };
    if (typeof payloadForStorage.password === "string") {
      payloadForStorage.password = "<hidden>";
    }
    payloadForStorage.endpoint = facturaEndpoint;

    recordStep(
      "Payload final armado para FacturaLive",
      { payload: payloadForStorage },
      "facturalive"
    );

    try {
  enforceCfeConsistency(payload);
  recordStep("Consistencia CFE aplicada", {
    typecfe: payload.typecfe,
    rutneg: payload.rutneg ? "<present>" : "<none>",
    typedoc: payload.typedoc ?? "<none>",
  }, "facturalive");
} catch (consistencyErr) {
  recordStep("Inconsistencia CFE detectada", { error: String(consistencyErr) }, "facturalive");
  return NextResponse.json(
    {
      error: String(consistencyErr),
      hint: "Si usás e-Ticket (111) no mandes RUT/typedoc. Si usás e-Factura (101) mandá rutneg y typedoc=2.",
      debugSteps,
    },
    { status: 400 }
  );
}

    //MOMENTO ANTES DE ENVIAR A FACTURALIVE
    const encoded = new URLSearchParams(payload);
    const encodedBody = encoded.toString();
    recordStep(
      "Enviando solicitud a FacturaLive",
       {
        endpoint: facturaEndpoint,
        payloadLength: encodedBody.length,
      },
      "facturalive"
    );

    const externalResponse = await fetch(facturaEndpoint, {
      method: "POST",
      headers: {
         "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json, text/plain, */*",
        "User-Agent": "gym-manager-pro/1.0 (+https://gym-manager-pro2.vercel.app)",
      },
      body: encodedBody,
    });

    const responseHeaders = Object.fromEntries(
      externalResponse.headers.entries()
    );

    recordStep(
      "Respuesta HTTP recibida de FacturaLive",
      {
        status: externalResponse.status,
        ok: externalResponse.ok,
        headers: responseHeaders,
      },
      "facturalive"
    );

    const responseClone = externalResponse.clone();
    const rawUtf8Response = await externalResponse.text();

    recordStep(
      "Cuerpo recibido de FacturaLive",
      {
        length: rawUtf8Response.length,
        preview: rawUtf8Response.slice(0, 500),
      },
      "facturalive"
    );

     let rawResponse = rawUtf8Response;
    let alternateDecoding:
      | { encoding: string; length: number; preview: string }
      | null = null;
    let binaryFallback:
      | { byteLength: number; base64Preview: string }
      | null = null;

    if (!rawUtf8Response || rawUtf8Response.trim().length === 0) {
      try {
        const fallbackBuffer = await responseClone.arrayBuffer();
        if (fallbackBuffer.byteLength > 0) {
          const latin1Decoded = new TextDecoder("latin1", {
            fatal: false,
            ignoreBOM: true,
          }).decode(fallbackBuffer);
          const sanitizedLatin1 = latin1Decoded.replace(/\u0000/g, "");
          if (sanitizedLatin1.trim().length > 0) {
            rawResponse = sanitizedLatin1;
            alternateDecoding = {
              encoding: "latin1",
              length: sanitizedLatin1.length,
              preview: sanitizedLatin1.slice(0, 500),
            };
            recordStep(
              "Cuerpo recuperado con decodificación Latin-1",
              alternateDecoding,
              "facturalive"
            );
          } else {
            binaryFallback = {
              byteLength: fallbackBuffer.byteLength,
              base64Preview: Buffer.from(fallbackBuffer)
                .toString("base64")
                .slice(0, 200),
            };
            recordStep(
              "FacturaLive devolvió payload binario sin contenido textual",
              binaryFallback,
              "facturalive"
            );
          }
        }
      } catch (fallbackError) {
        recordStep(
          "No se pudo obtener el cuerpo bruto de FacturaLive",
          {
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
          },
          "facturalive"
        );
      }
    }

    const parsedResponse = parseFacturaResponse(rawResponse);
    recordStep(
      "Respuesta de FacturaLive interpretada",
      { parsedResponse },
      "facturalive"
    );

    if (!rawResponse || rawResponse.trim().length === 0) {
      recordStep(
        "FacturaLive no devolvió contenido",
        {
          headers: responseHeaders,
          alternateDecoding,
          binaryFallback,
        },
        "facturalive"
      );
      return NextResponse.json(
        {
          error:
            "FacturaLive respondió sin cuerpo aunque confirmó la recepción HTTP. Esto suele ocurrir cuando las credenciales o el formato del payload fueron rechazados antes de generar el comprobante.",
          rawResponse,
          rawUtf8Response,
          endpoint: facturaEndpoint,
          
          debugSteps,
        },
        { status: 502 }
      );
    }

    const responsePayload =
      parsedResponse && typeof parsedResponse === "object"
        ? { raw: rawResponse, parsed: parsedResponse, endpoint: facturaEndpoint }
        : { raw: rawResponse, endpoint: facturaEndpoint };

    if (!externalResponse.ok) {
      recordStep(
        "FacturaLive respondió con estado HTTP de error",
        { status: externalResponse.status },
        "facturalive"
      );
      return NextResponse.json(
        {
          error:
            "El servicio de facturación devolvió un error. Intenta nuevamente en unos minutos.",
          rawResponse,
          endpoint: facturaEndpoint,
          debugSteps,
        },
        { status: 502 }
      );
    }

    const status =
      (parsedResponse?.status as string | undefined) ||
      (parsedResponse?.resultado as string | undefined) ||
      "procesado";
    const normalizedStatus =
      typeof status === "string" ? status.trim().toLowerCase() : "";
    const isSuccessfulStatus =
      normalizedStatus.length === 0 ||
      FACTURA_SUCCESS_KEYWORDS.some((keyword) =>
        normalizedStatus.includes(keyword)
      );

      recordStep(
      "Estado devuelto por FacturaLive",
      { status, normalizedStatus, isSuccessfulStatus },
      "facturalive"
    );

    if (!isSuccessfulStatus) {
      const errorMessages = extractFacturaMessages(parsedResponse);
      const errorMessage =
        errorMessages.length > 0
          ? errorMessages.join(". ")
          : "La factura fue rechazada por FacturaLive. Revisa los datos enviados.";

      console.error("FacturaLive rechazó la factura", {
        status,
        parsedResponse,
        rawResponse,
      });
      recordStep(
        "FacturaLive rechazó la factura",
        { status, errorMessages },
        "facturalive"
      );
      return NextResponse.json(
        {
          error: errorMessage,
          rawResponse,
          externalResponse: responsePayload,
          endpoint: facturaEndpoint,
          debugSteps,
        },
        { status: 502 }
      );
    }
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
      environment: effectiveEnvironment,
      typecfe:
        typeof invoice.typecfe === "number" && Number.isFinite(invoice.typecfe)
          ? invoice.typecfe
          : resolvedCredentials.typecfe ?? 111,
      issued_at: invoiceIssueDate ?? today,
      due_date: invoiceDueDate,
      request_payload: payloadForStorage,
      response_payload: responsePayload,
    };


    recordStep(
      "Registrando factura en Supabase",
      { invoiceRecord },
      "database"
    );

    const { data: storedInvoice, error: insertError } = await supabase
      .from("invoices")
      .insert(invoiceRecord)
      .select(selection)
      .single();

    if (insertError) {
      console.error("Error guardando la factura en la base de datos", insertError);
      recordStep(
        "Error guardando la factura en Supabase",
        {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
        },
        "database"
      );

      if (insertError.code === "23505") {
        recordStep(
          "Intentando actualizar factura existente tras conflicto",
          { gymId, paymentId },
          "database"
        );
        const { data: updatedInvoice, error: updateError } = await supabase
          .from("invoices")
          .update(invoiceRecord)
          .eq("gym_id", gymId)
          .eq("payment_id", paymentId)
          .select(selection)
          .single();

        if (!updateError && updatedInvoice) {
           recordStep(
            "Factura existente actualizada",
            { invoiceId: updatedInvoice.id },
            "database"
          );
          return NextResponse.json({
            invoice: updatedInvoice,
            externalResponse: responsePayload,
            rawResponse,
            reusedExistingInvoice: true,
            endpoint: facturaEndpoint,
            debugSteps,
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
          externalResponse: responsePayload,
          endpoint: facturaEndpoint,
          debugSteps,
        },
        { status: 500 }
      );
    }

    recordStep(
      "Factura guardada correctamente en Supabase",
      { invoiceId: storedInvoice.id },
      "database"
    );

    return NextResponse.json({
      invoice: storedInvoice,
      externalResponse: responsePayload,
      rawResponse,
      endpoint: facturaEndpoint,
      debugSteps,
    });
  } catch (error) {
    console.error("Error inesperado al emitir factura", error);
    recordStep("Error inesperado en el backend", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al emitir la factura. Intenta nuevamente en unos momentos.",
          debugSteps
      },
      { status: 500 }
    );
  }
}