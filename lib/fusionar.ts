import "server-only";

export type FusionarCredentials = {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
};

type FusionarCredentialMap = Record<string, FusionarCredentials>;

type FusionarLoginResponse = {
  token?: string;
};

export class FusionarApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "FusionarApiError";
  }
}

const DEFAULT_BASE_URL = "";

const normalizeBaseUrl = (value?: string | null) =>
  (value ?? DEFAULT_BASE_URL).trim().replace(/\/$/, "");

export const getFusionarCredentials = (gymId: string): FusionarCredentials | null => {
  const raw = process.env.FUSIONAR_CREDENTIALS_JSON;
  if (!raw) return null;

  try {
    const values = JSON.parse(raw) as FusionarCredentialMap;
    const credentials = values[gymId];
    if (!credentials?.apiKey?.trim() || !credentials?.secretKey?.trim()) {
      return null;
    }
    return credentials;
  } catch (error) {
    console.error("FUSIONAR_CREDENTIALS_JSON no contiene JSON valido", error);
    return null;
  }
};

export async function createFusionarSession(
  credentials: FusionarCredentials,
  configuredBaseUrl?: string | null
) {
  const baseUrl = normalizeBaseUrl(configuredBaseUrl || credentials.baseUrl);
  if (!baseUrl.startsWith("https://")) {
    throw new Error(
      "Falta confirmar y configurar la URL HTTPS de produccion de Fusionar."
    );
  }

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: credentials.apiKey,
      secretKey: credentials.secretKey,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | FusionarLoginResponse
    | { message?: string; error?: string }
    | null;

  if (!response.ok || !payload || !("token" in payload) || !payload.token) {
    throw new Error(
      (payload && "message" in payload && payload.message) ||
        (payload && "error" in payload && payload.error) ||
        "Fusionar no acepto las credenciales configuradas."
    );
  }

  return { token: payload.token, baseUrl };
}

export async function fusionarRequest<T>(
  session: { token: string; baseUrl: string },
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}
) {
  const response = await fetch(`${session.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-FS-Auth-Token": session.token,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" ? (payload as { message?: string; error?: string }) : null;
    const message =
      errorPayload?.message ||
      errorPayload?.error ||
      `Fusionar respondió ${response.status}.`;
    throw new FusionarApiError(message, response.status);
  }

  return payload as T;
}
