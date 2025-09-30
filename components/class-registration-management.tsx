"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Calendar,
  Clock,
  Copy,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { ClassRegistration, ClassSession } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ClassRegistrationManagementProps {
  gymId: string;
  sessions: ClassSession[];
  setSessions: Dispatch<SetStateAction<ClassSession[]>>;
  registrations: ClassRegistration[];
  setRegistrations: Dispatch<SetStateAction<ClassRegistration[]>>;
  onReload?: () => Promise<void>;
}

interface ClassSessionFormState {
  title: string;
  date: string;
  start_time: string;
  capacity: number;
  notes: string;
}

const INITIAL_FORM_STATE: ClassSessionFormState = {
  title: "",
  date: "",
  start_time: "",
  capacity: 20,
  notes: "",
};

export function ClassRegistrationManagement({
  gymId,
  sessions,
  setSessions,
  registrations,
  setRegistrations,
  onReload,
}: ClassRegistrationManagementProps) {
  const [formState, setFormState] = useState<ClassSessionFormState>(
    INITIAL_FORM_STATE
  );
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<
    | {
        type: "success" | "error";
        message: string;
      }
    | null
  >(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [copyGeneralSuccess, setCopyGeneralSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareBaseUrl, setShareBaseUrl] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareBaseUrl(window.location.origin);
    }
  }, []);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.date === b.date) {
        return a.start_time.localeCompare(b.start_time);
      }
      return a.date.localeCompare(b.date);
    });
  }, [sessions]);

  const generalSignupLink = useMemo(() => {
    if (!shareBaseUrl || !gymId) return "";
    return `${shareBaseUrl}/inscripciones/${gymId}`;
  }, [gymId, shareBaseUrl]);

  const registrationsBySession = useMemo(() => {
    const map = new Map<string, ClassRegistration[]>();
    for (const registration of registrations) {
      if (!map.has(registration.session_id)) {
        map.set(registration.session_id, []);
      }
      map.get(registration.session_id)!.push(registration);
    }
    return map;
  }, [registrations]);

  const handleChange = (
    field: keyof ClassSessionFormState,
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]:
        field === "capacity" ? Math.max(1, Number(value) || 1) : value,
    }));
  };

  const resetForm = () => {
    setFormState(INITIAL_FORM_STATE);
  };

  const handleCreateSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gymId) return;

    if (!formState.title.trim()) {
      setFeedback({ type: "error", message: "Ingresa un título para la clase." });
      return;
    }

    if (!formState.date) {
      setFeedback({
        type: "error",
        message: "Selecciona una fecha para la clase.",
      });
      return;
    }

    if (!formState.start_time) {
      setFeedback({
        type: "error",
        message: "Selecciona un horario de inicio.",
      });
      return;
    }

    setCreating(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/class-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          title: formState.title.trim(),
          date: formState.date,
          startTime: formState.start_time,
          capacity: formState.capacity,
          notes: formState.notes.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { data: ClassSession; error?: string }
        | { error?: string }
        | null;

      if (!response.ok) {
        const error = payload && "error" in payload ? payload.error : undefined;
        throw new Error(
          error || "No se pudo crear la clase. Intenta nuevamente más tarde."
        );
      }

      if (!payload || !("data" in payload)) {
        throw new Error(
          "No se pudo crear la clase. Intenta nuevamente más tarde."
        );
      }
      const { data } = payload;

      setSessions([...sessions, data]);
      setFeedback({
        type: "success",
        message: "Clase creada correctamente.",
      });
      resetForm();
    } catch (error) {
      console.error("Error creando la clase", error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear la clase. Revisa la conexión e intenta nuevamente.",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!gymId) return;

    const confirmDelete = window.confirm(
      "¿Seguro que deseas eliminar esta clase y sus inscripciones?"
    );
    if (!confirmDelete) return;

    setDeletingId(sessionId);
    try {
      const { error: deleteRegistrationsError } = await supabase
        .from("class_registrations")
        .delete()
        .eq("session_id", sessionId)
        .eq("gym_id", gymId);

      if (deleteRegistrationsError) throw deleteRegistrationsError;

      const { error } = await supabase
        .from("class_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("gym_id", gymId);

      if (error) throw error;

      setSessions(sessions.filter((session) => session.id !== sessionId));
      setRegistrations(
        registrations.filter((registration) => registration.session_id !== sessionId)
      );
    } catch (error) {
      console.error("Error eliminando la clase", error);
      setFeedback({
        type: "error",
        message:
          "No se pudo eliminar la clase. Verifica la conexión e intenta nuevamente.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyGeneralLink = async () => {
    if (!generalSignupLink) return;

    try {
      await navigator.clipboard.writeText(generalSignupLink);
      setCopyGeneralSuccess(true);
      setTimeout(() => setCopyGeneralSuccess(false), 3000);
    } catch (error) {
      console.error("No se pudo copiar el link general", error);
      setFeedback({
        type: "error",
        message:
          "No se pudo copiar el enlace general. Copia manualmente desde: " +
          generalSignupLink,
      });
    }
  };

  const handleCopyLink = async (session: ClassSession) => {
    if (!shareBaseUrl) return;

    const url = `${shareBaseUrl}/inscripciones/${gymId}?clase=${session.id}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopySuccessId(session.id);
      setTimeout(() => setCopySuccessId((prev) => (prev === session.id ? null : prev)), 3000);
    } catch (error) {
      console.error("No se pudo copiar el link", error);
      setFeedback({
        type: "error",
        message: "No se pudo copiar el enlace. Copia manualmente desde: " + url,
      });
    }
  };

  const handleRefresh = async () => {
    if (!gymId) return;

    setRefreshing(true);
    try {
      if (onReload) {
        await onReload();
      } else {
        const [{ data: sessionsData }, { data: registrationsData }] = await Promise.all([
          supabase
            .from("class_sessions")
            .select("id, gym_id, title, date, start_time, capacity, notes, created_at")
            .eq("gym_id", gymId)
            .order("date", { ascending: true })
            .order("start_time", { ascending: true }),
          supabase
            .from("class_registrations")
            .select("id, session_id, gym_id, full_name, email, phone, created_at")
            .eq("gym_id", gymId),
        ]);

        setSessions((sessionsData ?? []) as ClassSession[]);
        setRegistrations((registrationsData ?? []) as ClassRegistration[]);
      }
    } catch (error) {
      console.error("Error actualizando las clases", error);
      setFeedback({
        type: "error",
        message: "No se pudieron refrescar los datos.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Clases registradas</h2>
        <p className="text-muted-foreground">
          Crea clases puntuales con cupos limitados y comparte el enlace con tus socios
          para que se anoten de forma sencilla.
        </p>
      </div>

      {feedback && (
        <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Crear nueva clase</CardTitle>
          <CardDescription>
            Completa los datos para agregar una clase especial y controlar su cupo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateSession}>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="class-title">Nombre de la clase</Label>
              <Input
                id="class-title"
                placeholder="Por ejemplo: Lunes 18 hs - Funcional"
                value={formState.title}
                onChange={(event) => handleChange("title", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-date">Fecha</Label>
              <Input
                id="class-date"
                type="date"
                value={formState.date}
                onChange={(event) => handleChange("date", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-time">Horario</Label>
              <Input
                id="class-time"
                type="time"
                value={formState.start_time}
                onChange={(event) => handleChange("start_time", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-capacity">Cupo máximo</Label>
              <Input
                id="class-capacity"
                type="number"
                min={1}
                value={formState.capacity}
                onChange={(event) => handleChange("capacity", event.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="class-notes">Notas (opcional)</Label>
              <Textarea
                id="class-notes"
                placeholder="Agrega detalles como nivel de la clase, qué llevar, etc."
                value={formState.notes}
                onChange={(event) => handleChange("notes", event.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar datos
              </Button>
              <Button type="submit" disabled={creating}>
                Crear clase
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Clases programadas</h3>
            <p className="text-sm text-muted-foreground">
              Comparte este enlace general con tus socios para que vean todas las
              clases y elijan su cupo.
            </p>
            {generalSignupLink && (
              <p className="text-sm font-medium break-all text-primary">
                {generalSignupLink}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyGeneralLink}
              disabled={!generalSignupLink}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar enlace general
            </Button>
            {copyGeneralSuccess && (
              <span className="text-xs text-muted-foreground">Copiado</span>
            )}
          </div>
        </div>

        {sortedSessions.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                Todavía no hay clases cargadas. Crea la primera para comenzar a tomar
                reservas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedSessions.map((session) => {
              const sessionRegistrations = registrationsBySession.get(session.id) ?? [];
              const spotsLeft = Math.max(session.capacity - sessionRegistrations.length, 0);
              const isFull = spotsLeft <= 0;

              return (
                <Card key={session.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{session.title}</CardTitle>
                        <CardDescription>
                          Cupo máximo: {session.capacity} personas
                        </CardDescription>
                      </div>
                      <Badge variant={isFull ? "destructive" : "secondary"}>
                        {isFull ? "Cupo completo" : `${spotsLeft} lugares libres`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(session.date + "T00:00:00").toLocaleDateString()}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {session.start_time} hs
                      </p>
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {sessionRegistrations.length} inscriptos
                      </p>
                    </div>

                    {session.notes && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <p className="font-medium">Notas para los socios</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {session.notes}
                        </p>
                      </div>
                    )}

                    {sessionRegistrations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Listado de inscriptos</p>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {sessionRegistrations.map((registration) => (
                            <li key={registration.id} className="flex justify-between gap-2">
                              <span>{registration.full_name}</span>
                              <span className="text-xs">
                                {registration.created_at
                                  ? new Date(registration.created_at).toLocaleString()
                                  : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      También puedes compartir el enlace general para que cada
                      socio elija su horario. Este botón copia un enlace directo
                      que abre esta clase seleccionada.
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCopyLink(session)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copySuccessId === session.id
                        ? "Link directo copiado"
                        : "Copiar enlace directo"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={deletingId === session.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}