import { createSign } from "node:crypto";

type ServiceAccount = { client_email?: string; private_key?: string; token_uri?: string };
type CalendarEventInput = { summary: string; description: string; startsAt: Date; endsAt: Date };
type BusyInterval = { start: string; end: string };

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const MONTEVIDEO_TIME_ZONE = "America/Montevideo";

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function serviceAccount() {
  const raw = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const account = JSON.parse(raw) as ServiceAccount;
    if (!account.client_email || !account.private_key) throw new Error("JSON incompleto");
    return account;
  } catch {
    throw new Error("GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON no tiene un JSON válido.");
  }
}

async function accessToken(account: ServiceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: account.client_email, scope: GOOGLE_CALENDAR_SCOPE, aud: tokenUri,
    iat: issuedAt, exp: issuedAt + 3600,
  }));
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${signer.sign(account.private_key!).toString("base64url")}`;
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const result = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "No se pudo autenticar con Google Calendar.");
  return result.access_token;
}

/** Returns null locally when Google Calendar secrets were not configured. */
export async function createGoogleCalendarEvent(input: CalendarEventInput) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const account = serviceAccount();
  if (!calendarId || !account) return null;
  const token = await accessToken(account);
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      summary: input.summary, description: input.description, visibility: "private",
      start: { dateTime: input.startsAt.toISOString(), timeZone: MONTEVIDEO_TIME_ZONE },
      end: { dateTime: input.endsAt.toISOString(), timeZone: MONTEVIDEO_TIME_ZONE },
    }),
  });
  const event = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !event.id) throw new Error(event.error?.message || "No se pudo crear el evento en Google Calendar.");
  return event.id;
}

/**
 * Obtiene los bloques ya ocupados del calendario compartido.
 * Devuelve null cuando el calendario no está configurado, para no impedir
 * el trabajo local de desarrollo.
 */
export async function getGoogleCalendarBusyIntervals(timeMin: Date, timeMax: Date): Promise<BusyInterval[] | null> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const account = serviceAccount();
  if (!calendarId || !account) return null;
  const token = await accessToken(account);
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: MONTEVIDEO_TIME_ZONE,
      items: [{ id: calendarId }],
    }),
  });
  const payload = await response.json().catch(() => ({})) as {
    calendars?: Record<string, { busy?: BusyInterval[]; errors?: Array<{ reason?: string }> }>;
    error?: { message?: string };
  };
  const calendar = payload.calendars?.[calendarId];
  if (!response.ok || calendar?.errors?.length) throw new Error(payload.error?.message || "No se pudo consultar la disponibilidad del calendario.");
  return calendar?.busy ?? [];
}
