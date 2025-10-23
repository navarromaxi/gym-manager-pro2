"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { Calendar, Clock, Users } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { ClassRegistration, ClassSession } from "@/lib/supabase";
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
  const [registrations, setRegistrations] = useState<ClassRegistration[]>([]);
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

  const registrationsBySession = useMemo(() => {
    const counts = new Map<string, ClassRegistration[]>();
    for (const registration of registrations) {
      if (!counts.has(registration.session_id)) {
        counts.set(registration.session_id, []);
      }
      counts.get(registration.session_id)!.push(registration);
    }
    return counts;
  }, [registrations]);

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
  const selectedSessionRegistrations = selectedSession
    ? registrationsBySession.get(selectedSession.id) ?? []
    : [];
  const spotsLeft = selectedSession
    ? Math.max(
        selectedSession.capacity - selectedSessionRegistrations.length,
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
        setRegistrations([]);
        setLoading(false);
        return;
      }

      try {
        const [sessionsResponse, registrationsResponse, gymResponse] =
          await Promise.all([
            supabase
              .from("class_sessions")
              .select(
                "id, gym_id, title, date, start_time, capacity, notes, created_at, accept_receipts"
              )
              .eq("gym_id", gymId ?? "")
              .order("date", { ascending: true })
              .order("start_time", { ascending: true }),
            supabase
              .from("class_registrations")
              .select(
                "id, session_id, gym_id, full_name, email, phone, created_at, receipt_url, receipt_storage_path"
              )
              .eq("gym_id", gymId ?? ""),
            supabase
              .from("gyms")
              .select("name, logo_url")
              .eq("id", gymId ?? "")
              .maybeSingle(),
          ]);

        if (sessionsResponse.error) throw sessionsResponse.error;
        if (registrationsResponse.error) throw registrationsResponse.error;

        setSessions((sessionsResponse.data ?? []) as ClassSession[]);
        setRegistrations(
          (registrationsResponse.data ?? []) as ClassRegistration[]
        );

        if (gymResponse?.error) throw gymResponse.error;

        if (gymResponse.data?.name) {
          setGymName(gymResponse.data.name);
        }
        if (gymResponse.data?.logo_url) {
          setGymLogoUrl(gymResponse.data.logo_url);
        } else {
          setGymLogoUrl(null);
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
    if (!gymId) {
      return;
    }

    const registrationsChannel = supabase
      .channel(`public:class_registrations:${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_registrations",
          filter: `gym_id=eq.${gymId}`,
        },
        () => fetchData(false)
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel(`public:class_sessions:${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_sessions",
          filter: `gym_id=eq.${gymId}`,
        },
        () => fetchData(false)
      )
      .subscribe();
      return () => {
      supabase.removeChannel(registrationsChannel);
      supabase.removeChannel(sessionsChannel);
    };
  }, [fetchData, gymId]);

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
        registration: ClassRegistration;
      };

      if (registration) {
        setRegistrations((prev) => [...prev, registration]);
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
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4">
        <header className="text-center space-y-3">
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-16 w-16">
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
            <p className="text-sm uppercase tracking-wide text-gray-500">
              {gymName
                ? `Sistema de reservas`
                : "Sistema de reservas del gimnasio"}
            </p>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
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
             <Card className="border-none shadow-lg">
              <CardHeader className="space-y-2 text-center md:text-left">
                <CardTitle className="text-2xl font-semibold text-white-900">
                  Reserva tu lugar
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-6 pt-0 sm:px-6">
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label>Elige Clase/Evento</Label>
                    <Select
                      value={selectedSessionId}
                      onValueChange={setSelectedSessionId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una clase" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedSessions.map((session) => {
                          const count =
                            registrationsBySession.get(session.id)?.length ?? 0;
                          const available = Math.max(
                            session.capacity - count,
                            0
                          );
                          const label = `${new Date(
                            `${session.date}T00:00:00`
                          ).toLocaleDateString()} • ${
                            session.start_time
                          } hs • ${available} libres`;
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
                    <div className="space-y-3 rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                      <div className="flex flex-wrap gap-4">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(
                            `${selectedSession.date}T00:00:00`
                          ).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {selectedSession.start_time} hs
                        </span>
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {selectedSession.capacity} cupos
                        </span>
                        <Badge
                           variant={
                            hasSelectedSessionStarted || spotsLeft <= 0
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {hasSelectedSessionStarted
                            ? "Clase iniciada"
                            : spotsLeft > 0
                            ? `${spotsLeft} lugares disponibles`
                            : "Sin cupos"}
                        </Badge>
                      </div>
                      {selectedSession.notes && (
                        <p className="whitespace-pre-wrap">
                          {selectedSession.notes}
                        </p>
                      )}
                      {selectedSession.accept_receipts && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-primary">
                          Esta clase solicita que adjuntes el comprobante de
                          pago al confirmar tu lugar.
                        </div>
                      )}
                       {hasSelectedSessionStarted && (
                        <Alert variant="destructive">
                          <AlertDescription className="text-sm">
                            Usted no se ha podido anotar a esta clase, la misma
                            ya ha iniciado.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="full-name">Nombre y apellido</Label>
                      <Input
                        id="full-name"
                        value={formState.fullName}
                        onChange={(event) =>
                          handleFormChange("fullName", event.target.value)
                        }
                        required
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
                      className={
                        formError
                          ? undefined
                          : "border-green-200 bg-green-50 text-green-800 [&>svg]:text-green-600"
                      }
                    >
                      <AlertDescription>
                        {formError ? formError : successMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
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
