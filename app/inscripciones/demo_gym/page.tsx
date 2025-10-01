"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const fetchData = async () => {
        if (!gymId) {
        setLoadError(
          "El enlace utilizado no es válido. Revisa la dirección e inténtalo nuevamente."
        );
        setSessions([]);
        setRegistrations([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const [sessionsResponse, registrationsResponse, gymResponse] =
          await Promise.all([
            supabase
              .from("class_sessions")
              .select(
                "id, gym_id, title, date, start_time, capacity, notes, created_at"
              )
              .eq("gym_id", gymId ?? "")
              .order("date", { ascending: true })
              .order("start_time", { ascending: true }),
            supabase
              .from("class_registrations")
              .select(
                "id, session_id, gym_id, full_name, email, phone, created_at"
              )
              .eq("gym_id", gymId ?? ""),
            supabase
              .from("gyms")
              .select("name")
              .eq("id", gymId ?? "")
              .maybeSingle(),
          ]);

        if (sessionsResponse.error) throw sessionsResponse.error;
        if (registrationsResponse.error) throw registrationsResponse.error;

        setSessions((sessionsResponse.data ?? []) as ClassSession[]);
        setRegistrations(
          (registrationsResponse.data ?? []) as ClassRegistration[]
        );

        if (gymResponse.data?.name) {
          setGymName(gymResponse.data.name);
        }
      } catch (fetchError) {
        console.error("Error cargando la información", fetchError);
        setLoadError(
          "No se pudieron cargar las clases. Revisa el enlace o intenta más tarde."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gymId]);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);
    setFormError(null);

    if (!selectedSession) {
      setFormError("Selecciona una clase para continuar.");
      return;
    }

    if (!formState.fullName.trim()) {
      setFormError("Ingresa tu nombre y apellido.");
      return;
    }

    setSubmitting(true);

    try {
      const { count: currentCount, error: countError } = await supabase
        .from("class_registrations")
        .select("id", { count: "exact", head: true })
        .eq("session_id", selectedSession.id)
        .eq("gym_id", gymId ?? "");

      if (countError) throw countError;

      if ((currentCount ?? 0) >= selectedSession.capacity) {
        setFormError("Esta clase ya alcanzó su cupo máximo.");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("class_registrations")
        .insert({
          session_id: selectedSession.id,
          gym_id: gymId ?? "",
          full_name: formState.fullName.trim(),
          email: formState.email.trim() || null,
          phone: formState.phone.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setRegistrations((prev) => [...prev, data as ClassRegistration]);
      }

      setSuccessMessage(
        `¡Listo! Te anotaste en "${selectedSession.title}" para el ${new Date(
          `${selectedSession.date}T00:00:00`
        ).toLocaleDateString()} a las ${selectedSession.start_time} hs.`
      );
      setFormState(INITIAL_FORM_STATE);
    } catch (submitError) {
      console.error("Error registrando al socio", submitError);
      setFormError(
        "No pudimos registrar tu lugar. Intenta nuevamente en unos segundos."
      );
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
                src="/logos/demo-gym-logo.svg"
                alt="Logo del gimnasio"
                fill
                sizes="64px"
                className="object-contain"
                priority
              />
            </div>
            <p className="text-sm uppercase tracking-wide text-gray-500">
              {gymName
                ? `Sistema de reservas de ${gymName}`
                : "Sistema de reservas del gimnasio"}
            </p>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {gymName ? `${gymName} - Clases especiales` : "Reserva tu clase"}
          </h1>
          <p className="text-muted-foreground">
            Elegí la clase que quieres tomar y deja tus datos para asegurar tu
            lugar.
          </p>
        </header>

        <Alert>
          <AlertDescription>
            Este enlace funciona para todos los socios del gimnasio. Aquí verán
            la lista completa de clases disponibles y podrán elegir su horario.
            Si llegan mediante un enlace directo con el parámetro "clase",
            seleccionaremos esa clase automáticamente.
          </AlertDescription>
        </Alert>

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
            {(successMessage || formError) && (
              <Alert variant={formError ? "destructive" : "default"}>
                <AlertDescription>
                  {formError ? formError : successMessage}
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Reserva tu lugar</CardTitle>
                <CardDescription>
                  Elige una clase y completa tus datos. Recibirás confirmación
                  inmediata.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label>Clase</Label>
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
                    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
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
                          variant={spotsLeft > 0 ? "secondary" : "destructive"}
                        >
                          {spotsLeft > 0
                            ? `${spotsLeft} lugares disponibles`
                            : "Sin cupos"}
                        </Badge>
                      </div>
                      {selectedSession.notes && (
                        <p className="whitespace-pre-wrap">
                          {selectedSession.notes}
                        </p>
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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting || spotsLeft <= 0}
                  >
                    {spotsLeft <= 0
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
