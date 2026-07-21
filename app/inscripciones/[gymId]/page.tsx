"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { Calendar, Clock, Ticket, Users } from "lucide-react";

import type { ClassSession } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return currencyFormatter.format(value);
};

interface RegistrationFormState {
  fullName: string;
  email: string;
  phone: string;
}

const INITIAL_FORM_STATE: RegistrationFormState = {
  fullName: "",
  email: "",
  phone: "",
};

const MAX_RECEIPT_SIZE_MB = 5;
const MAX_RECEIPT_SIZE_BYTES = MAX_RECEIPT_SIZE_MB * 1024 * 1024;

function PublicClassRegistrationPageContent() {
  const params = useParams<{ gymId: string }>();
  const gymId = params?.gymId;
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [occupiedSeats, setOccupiedSeats] = useState<Record<string, number>>({});
  const [gymName, setGymName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [formState, setFormState] =
    useState<RegistrationFormState>(INITIAL_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [gymLogoUrl, setGymLogoUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptInputKey, setReceiptInputKey] = useState(0);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.date === b.date) {
        return a.start_time.localeCompare(b.start_time);
      }
      return a.date.localeCompare(b.date);
    });
  }, [sessions]);

  const selectedSession = sortedSessions.find(
    (session) => session.id === selectedSessionId
  );
  const spotsLeft = selectedSession
    ? Math.max(
        selectedSession.capacity - (occupiedSeats[selectedSession.id] ?? 0),
        0
      )
    : 0;
    const selectedSessionStart = useMemo(() => {
    if (!selectedSession) {
      return null;
    }
    const rawDateTime = `${selectedSession.date}T${selectedSession.start_time}`;
    const normalizedDateTime =
      rawDateTime.length === 16 ? `${rawDateTime}:00` : rawDateTime;
    const parsedDate = new Date(normalizedDateTime);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }, [selectedSession]);
  const hasSelectedSessionStarted = useMemo(() => {
    if (!selectedSessionStart) {
      return false;
    }
    return selectedSessionStart.getTime() <= now.getTime();
  }, [selectedSessionStart, now]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }
      setLoadError(null);

      if (!gymId) {
        setLoadError(
          "El enlace utilizado no es válido. Revisa la dirección e inténtalo nuevamente."
        );
        setSessions([]);
        setOccupiedSeats({});
        setLoading(false);
        return;
      }

      try {
        const classesResponse = await fetch(
          `/api/public-gyms/${gymId}/class-sessions`,
          { method: "GET", cache: "no-store" }
        );
        const classesPayload = (await classesResponse.json().catch(() => null)) as
          | { sessions?: ClassSession[]; occupiedSeats?: Record<string, number>; error?: string }
          | null;

        if (!classesResponse.ok) {
          throw new Error(classesPayload?.error ?? "No se pudieron cargar las clases.");
        }

        setSessions(classesPayload?.sessions ?? []);
        setOccupiedSeats(classesPayload?.occupiedSeats ?? {});

        let resolvedGymName: string | null | undefined = undefined;
        let resolvedGymLogoUrl: string | null | undefined = undefined;

        try {
          const response = await fetch(`/api/public-gyms/${gymId}`, {
            method: "GET",
            cache: "no-store",
          });

          if (response.ok) {
            const payload = (await response.json()) as {
              data?: { name?: string | null; logoUrl?: string | null };
            };

            resolvedGymName = payload.data?.name ?? null;
            resolvedGymLogoUrl = payload.data?.logoUrl ?? null;
          } else if (response.status === 404) {
            resolvedGymName = null;
            resolvedGymLogoUrl = null;
          } else {
            const errorPayload = (await response
              .json()
              .catch(() => null)) as { error?: string } | null;
            throw new Error(
              errorPayload?.error ??
                "No se pudo obtener la información del gimnasio."
            );
          }
        } catch (gymInfoError) {
          console.error("Error fetching gym info", gymInfoError);
        }

        if (resolvedGymName !== undefined) {
          setGymName(resolvedGymName);
        }
        if (resolvedGymLogoUrl !== undefined) {
          setGymLogoUrl(resolvedGymLogoUrl);
        }
      } catch (fetchError) {
        console.error("Error cargando la información", fetchError);
        setLoadError(
          "No se pudieron cargar las clases. Revisa el enlace o intenta más tarde."
        );
      } finally {
        setLoading(false);
      }
    },
    [gymId]
  );

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchData(false);
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };


  }, [fetchData]);

  useEffect(() => {
    setReceiptFile(null);
    setReceiptError(null);
    setReceiptInputKey((prev) => prev + 1);
  }, [selectedSessionId]);

  useEffect(() => {
    if (sortedSessions.length === 0) {
      setSelectedSessionId("");
      return;
    }

    const sessionFromQuery = searchParams?.get("clase");
    if (
      sessionFromQuery &&
      sortedSessions.some((s) => s.id === sessionFromQuery)
    ) {
      setSelectedSessionId(sessionFromQuery);
      return;
    }

    if (!selectedSessionId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = sortedSessions.find((session) => {
        const sessionDate = new Date(`${session.date}T00:00:00`);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() >= today.getTime();
      });

      setSelectedSessionId((upcoming ?? sortedSessions[0]).id);
    }
  }, [searchParams, sortedSessions, selectedSessionId]);

  const handleFormChange = (
    field: keyof RegistrationFormState,
    value: string
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleReceiptFileChange = (file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      setReceiptError(null);
      return;
    }

    const isImage = file.type?.startsWith("image/") ?? false;
    const isPdf = file.type === "application/pdf";

    if (!isImage && !isPdf) {
      setReceiptFile(null);
      setReceiptError("El archivo debe ser una imagen o un PDF.");
      return;
    }

    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      setReceiptFile(null);
      setReceiptError(
        `El archivo supera el máximo permitido de ${MAX_RECEIPT_SIZE_MB} MB.`
      );
      return;
    }

    setReceiptError(null);
    setReceiptFile(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);
    setFormError(null);

    if (!selectedSession) {
      setFormError("Selecciona una clase para continuar.");
      return;
    }

    if (hasSelectedSessionStarted) {
      setFormError(
        "Usted no se ha podido anotar a esta clase, la misma ya ha iniciado."
      );
      return;
    }

    if (!formState.fullName.trim()) {
      setFormError("Ingresa tu nombre y apellido.");
      return;
    }

     if (selectedSession.accept_receipts && !receiptFile) {
      const message =
        "Adjunta el comprobante de pago para completar tu inscripción.";
      setReceiptError(message);
      setFormError(message);
      return;
    }

    setSubmitting(true);

    try {
      if (!gymId) {
        setFormError("No se pudo identificar el gimnasio.");
        return;
      }

      if (receiptError) {
        setFormError(receiptError);
        return;
      }

      const trimmedEmail = formState.email.trim();
      const trimmedPhone = formState.phone.trim();

      const formData = new FormData();
      formData.append("sessionId", selectedSession.id);
      formData.append("gymId", gymId);
      formData.append("fullName", formState.fullName.trim());
      if (trimmedEmail) {
        formData.append("email", trimmedEmail);
      }
      if (trimmedPhone) {
        formData.append("phone", trimmedPhone);
      }
      if (receiptFile) {
        formData.append("receipt", receiptFile);
      }

      const response = await fetch("/api/class-registrations", {
        method: "POST",
        body: formData,
      });

      if (response.status === 409) {
        const errorData = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setFormError(
          errorData?.error ?? "Esta clase ya alcanzó su cupo máximo."
        );
        return;
      }

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errorData?.error ?? "Error registrando la clase");
      }

      const { registration } = (await response.json()) as {
        registration: { session_id: string };
      };

      if (registration?.session_id) {
        setOccupiedSeats((current) => ({
          ...current,
          [registration.session_id]: (current[registration.session_id] ?? 0) + 1,
        }));
      }

      setSuccessMessage(
        `¡Listo! Te anotaste en "${selectedSession.title}" para el ${new Date(
          `${selectedSession.date}T00:00:00`
        ).toLocaleDateString()} a las ${selectedSession.start_time} hs.`
      );
      setFormState(INITIAL_FORM_STATE);
      setReceiptFile(null);
      setReceiptError(null);
      setReceiptInputKey((prev) => prev + 1);
    } catch (submitError) {
      console.error("Error registrando al socio", submitError);
      if (submitError instanceof Error && submitError.message) {
        setFormError(submitError.message);
      } else {
        setFormError(
          "No pudimos registrar tu lugar. Intenta nuevamente en unos segundos."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_42%,_#f0fdf4_100%)] py-8 text-slate-900 sm:py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 sm:px-6">
        <header className="text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <Image
                src={gymLogoUrl ?? "/logos/demo-gym-logo.svg"}
                alt={
                  gymName
                    ? `Logo del gimnasio ${gymName}`
                    : "Logo del gimnasio"
                }
                fill
                sizes="64px"
                className="object-contain"
                priority
                unoptimized={Boolean(gymLogoUrl)}
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              {gymName
                ? `Sistema de reservas`
                : "Sistema de reservas del gimnasio"}
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {gymName ? `${gymName}` : "Reserva tu clase"}
          </h1>
        </header>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Cargando clases disponibles…
            </CardContent>
          </Card>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : sortedSessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Todavía no hay clases disponibles para reservar. Consulta
              nuevamente más tarde.
            </CardContent>
          </Card>
        ) : (
          <>
             <Card className="overflow-hidden border border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.10)]">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-emerald-50 px-5 py-6 sm:px-8">
                <CardTitle className="text-2xl font-bold text-slate-950">
                  Reserva tu lugar
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Elegí una actividad y completá tus datos para confirmar tu cupo.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
                <form className="space-y-7" onSubmit={handleSubmit}>
                  <div className="space-y-2.5">
                    <Label className="text-sm font-semibold text-slate-800">Elegí clase o evento</Label>
                    <Select
                      value={selectedSessionId}
                      onValueChange={setSelectedSessionId}
                    >
                      <SelectTrigger className="h-12 border-slate-300 bg-white text-slate-950 shadow-sm focus:ring-sky-500">
                        <SelectValue placeholder="Selecciona una clase" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedSessions.map((session) => {
                          const count = occupiedSeats[session.id] ?? 0;
                          const available = Math.max(
                            session.capacity - count,
                            0
                          );
            const label = `${new Date(
                            `${session.date}T00:00:00`
                          ).toLocaleDateString()} • ${
                            session.start_time
                          } hs • ${available} libres${
                            formatCurrency(session.price)
                              ? ` • ${formatCurrency(session.price)}`
                              : ""
                          }`;
                          return (
                            <SelectItem key={session.id} value={session.id}>
                              {session.title}
                              <span className="block text-xs text-muted-foreground">
                                {label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSession && (
                    <div className="space-y-5 rounded-2xl border border-sky-100 bg-slate-50 p-4 text-sm sm:p-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-slate-700 shadow-sm">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(
                            `${selectedSession.date}T00:00:00`
                          ).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-slate-700 shadow-sm">
                          <Clock className="h-4 w-4" />
                          <span>{selectedSession.start_time} hs</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-sky-100 p-3 font-semibold text-sky-800">
                          <Users className="h-4 w-4" />
                          <span>{selectedSession.capacity} cupos</span>
                        </div>
                        {formatCurrency(selectedSession.price) && (
                          <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 font-semibold text-amber-800">
                            <Ticket className="h-4 w-4" />
                            <span>{formatCurrency(selectedSession.price)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge className={hasSelectedSessionStarted || spotsLeft <= 0 ? "rounded-full bg-rose-100 px-3 py-1.5 text-rose-700 hover:bg-rose-100" : "rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800 hover:bg-emerald-100"}>
                          {hasSelectedSessionStarted
                            ? "Clase iniciada"
                            : spotsLeft > 0
                            ? `${spotsLeft} lugares disponibles`
                            : "Sin cupos"}
                        </Badge>
                        {spotsLeft > 0 && !hasSelectedSessionStarted && (
                          <span className="text-xs font-medium text-slate-500">
                            Quedan {spotsLeft} de {selectedSession.capacity} lugares
                          </span>
                        )}
                      </div>
                      {selectedSession.notes && (
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-600">
                          {selectedSession.notes}
                        </p>
                      )}
                      {selectedSession.accept_receipts && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                          Se solicita que adjuntes el comprobante de
                          pago al confirmar tu lugar.
                        </div>
                      )}
                       {hasSelectedSessionStarted && (
                        <Alert variant="destructive">
                          <AlertDescription className="text-sm">
                            No has podido anotarte, el evento ya ha iniciado.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="full-name">Nombre y apellido</Label>
                      <Input
                        id="full-name"
                        value={formState.fullName}
                        onChange={(event) =>
                          handleFormChange("fullName", event.target.value)
                        }
                        required
                        className="h-11 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (opcional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formState.email}
                        onChange={(event) =>
                          handleFormChange("email", event.target.value)
                        }
                        placeholder="nombre@correo.com"
                        className="h-11 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono (opcional)</Label>
                      <Input
                        id="phone"
                        value={formState.phone}
                        onChange={(event) =>
                          handleFormChange("phone", event.target.value)
                        }
                        placeholder="54911..."
                        className="h-11 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-sky-500"
                      />
                    </div>
                  </div>

                  {selectedSession?.accept_receipts && (
                    <div className="space-y-2">
                      <Label htmlFor="payment-receipt">
                        Comprobante de pago (imagen o PDF)
                      </Label>
                      <Input
                        key={receiptInputKey}
                        id="payment-receipt"
                        type="file"
                        accept="image/*,.pdf"
                        required={selectedSession?.accept_receipts ?? false}
                        onChange={(event) =>
                          handleReceiptFileChange(
                            event.target.files?.[0] ?? null
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Adjunta tu comprobante para agilizar la validación. Tamaño
                        máximo {MAX_RECEIPT_SIZE_MB} MB.
                      </p>
                      {receiptFile && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{receiptFile.name}</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary underline hover:text-primary/80"
                            onClick={() => handleReceiptFileChange(null)}
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                      {receiptError && (
                        <p className="text-sm text-destructive">{receiptError}</p>
                      )}
                    </div>
                  )}

                   {(formError || successMessage) && (
                    <Alert
                      variant={formError ? "destructive" : "default"}
                    className={formError ? undefined : "border-emerald-200 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-600"}
                    >
                      <AlertDescription>
                        {formError ? formError : successMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-sky-600 text-base font-semibold text-white shadow-sm hover:bg-sky-700 disabled:bg-slate-300"
                    disabled={
                      submitting || spotsLeft <= 0 || hasSelectedSessionStarted
                    }
                  >
                   {hasSelectedSessionStarted
                      ? "Clase iniciada"
                      : spotsLeft <= 0
                      ? "Sin cupos disponibles"
                      : submitting
                      ? "Registrando…"
                      : "Confirmar reserva"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function PublicClassRegistrationFallback() {
  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Cargando página…
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PublicClassRegistrationPage() {
  return (
    <Suspense fallback={<PublicClassRegistrationFallback />}>
      <PublicClassRegistrationPageContent />
    </Suspense>
  );
}
