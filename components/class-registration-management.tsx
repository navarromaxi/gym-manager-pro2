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
  Download,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  accept_receipts: boolean;
}

const INITIAL_FORM_STATE: ClassSessionFormState = {
  title: "",
  date: "",
  start_time: "",
  capacity: 20,
  notes: "",
  accept_receipts: false,
};

export function ClassRegistrationManagement({
  gymId,
  sessions,
  setSessions,
  registrations,
  setRegistrations,
  onReload,
}: ClassRegistrationManagementProps) {
  const [formState, setFormState] =
    useState<ClassSessionFormState>(INITIAL_FORM_STATE);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [copyGeneralSuccess, setCopyGeneralSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareBaseUrl, setShareBaseUrl] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [isRegistrationsDialogOpen, setIsRegistrationsDialogOpen] =
    useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingRegistrationId, setDeletingRegistrationId] = useState<string | null>(
    null
  );
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

  const fetchLatestData = async () => {
    if (!gymId) return;

    if (onReload) {
      await onReload();
      return;
    }

    const [sessionsResponse, registrationsResponse] = await Promise.all([
      supabase
        .from("class_sessions")
        .select(
          "id, gym_id, title, date, start_time, capacity, notes, created_at, accept_receipts"
        )
        .eq("gym_id", gymId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("class_registrations")
        .select(
          "id, session_id, gym_id, full_name, email, phone, created_at, receipt_url, receipt_storage_path"
        )
        .eq("gym_id", gymId),
    ]);

    if (sessionsResponse.error) throw sessionsResponse.error;
    if (registrationsResponse.error) throw registrationsResponse.error;

    setSessions((sessionsResponse.data ?? []) as ClassSession[]);
    setRegistrations((registrationsResponse.data ?? []) as ClassRegistration[]);
  };

  const handleChange = <K extends keyof ClassSessionFormState>(
    field: K,
    value: ClassSessionFormState[K]
  ) => {
    setFormState((prev) => {
      if (field === "capacity") {
        const numericValue =
          typeof value === "number" ? value : Number(value) || 1;
        return {
          ...prev,
          capacity: Math.max(1, Math.floor(numericValue)),
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const resetForm = () => {
    setFormState(INITIAL_FORM_STATE);
  };

  const handleCreateSession = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!gymId) return;

    if (!formState.title.trim()) {
      setFeedback({
        type: "error",
        message: "Ingresa un título para la clase.",
      });
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
          acceptReceipts: formState.accept_receipts,
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

      setSessions((prev) => [...prev, data]);
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

    const previousSessions = sessions;
    const previousRegistrations = registrations;
    setDeletingId(sessionId);
    try {
      const response = await fetch("/api/class-sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          sessionId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        const message = payload?.error;
        throw new Error(
          message ||
            "No se pudo eliminar la clase. Verifica la conexión e intenta nuevamente."
        );
      }

      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      setRegistrations((prev) =>
        prev.filter((registration) => registration.session_id !== sessionId)
      );
      try {
        await fetchLatestData();
      } catch (refreshError) {
        console.error(
          "Error recargando las clases tras eliminar",
          refreshError
        );
        setSessions(previousSessions);
        setRegistrations(previousRegistrations);
        throw refreshError;
      }
      setFeedback({
        type: "success",
        message: "Clase eliminada correctamente.",
      });
    } catch (error) {
      console.error("Error eliminando la clase", error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la clase. Verifica la conexión e intenta nuevamente.",
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
      setTimeout(
        () => setCopySuccessId((prev) => (prev === session.id ? null : prev)),
        3000
      );
    } catch (error) {
      console.error("No se pudo copiar el link", error);
      setFeedback({
        type: "error",
        message: "No se pudo copiar el enlace. Copia manualmente desde: " + url,
      });
    }
  };

  const handleOpenRegistrations = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsRegistrationsDialogOpen(true);
  };

  const handleCloseRegistrations = (open: boolean) => {
    setIsRegistrationsDialogOpen(open);
    if (!open) {
      setSelectedSessionId(null);
    }
  };


  const handleDeleteRegistration = async (registrationId: string) => {
    if (!gymId) return;

    const confirmDelete = window.confirm(
      "¿Seguro que deseas eliminar esta inscripción?"
    );
    if (!confirmDelete) return;

    const previousRegistrations = registrations;
    setDeletingRegistrationId(registrationId);
    setRegistrations((prev) =>
      prev.filter((registration) => registration.id !== registrationId)
    );

    try {
      const response = await fetch("/api/class-registrations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          registrationId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || payload?.error) {
        const message =
          payload?.error ||
          "No se pudo eliminar la inscripción. Intenta nuevamente.";
        throw new Error(message);
      }

      setFeedback({
        type: "success",
        message: "Inscripción eliminada correctamente.",
      });
    } catch (error) {
      console.error("Error eliminando la inscripción", error);
      setRegistrations(previousRegistrations);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la inscripción. Intenta nuevamente.",
      });
    } finally {
      setDeletingRegistrationId(null);
    }
  };

  const handleDownloadRegistrations = (
    session: ClassSession,
    sessionRegistrations: ClassRegistration[]
  ) => {
    setDownloadingId(session.id);
    try {
      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const tableRows = sessionRegistrations.map((registration, index) => {
        const formattedDate = registration.created_at
          ? new Date(registration.created_at).toLocaleString()
          : "";
        const receiptCell = registration.receipt_url
          ? `<a href="${escapeHtml(registration.receipt_url)}" target="_blank" rel="noopener noreferrer">Ver comprobante</a>`
          : "-";

        return `<tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(registration.full_name)}</td>
            <td>${escapeHtml(registration.email ?? "")}</td>
            <td>${escapeHtml(registration.phone ?? "")}</td>
            <td>${escapeHtml(formattedDate)}</td>
            <td>${receiptCell}</td>
          </tr>`;
      });

      if (tableRows.length === 0) {
        tableRows.push(
          `<tr>
            <td colspan="6">Sin inscriptos aún</td>
          </tr>`
        );
      }

      const tableHtml = `<!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charSet="utf-8" />
          </head>
          <body>
            <table border="1">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Fecha de inscripción</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows.join("")}
              </tbody>
            </table>
          </body>
        </html>`;

      const sanitizedTitle = session.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");

      const fileName = `inscriptos-${sanitizedTitle || session.id}.xls`;
      const blob = new Blob([tableHtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando la lista", error);
      setFeedback({
        type: "error",
        message: "No se pudo descargar la lista. Intenta nuevamente.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRefresh = async () => {
    if (!gymId) return;

    setRefreshing(true);
    try {
      await fetchLatestData();
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
        <h2 className="text-3xl font-bold tracking-tight">
          Clases registradas
        </h2>
        <p className="text-muted-foreground">
          Crea clases puntuales con cupos limitados y comparte el enlace con tus
          socios para que se anoten de forma sencilla.
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
            Completa los datos para agregar una clase especial y controlar su
            cupo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={handleCreateSession}
          >
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
                onChange={(event) =>
                  handleChange("start_time", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-capacity">Cupo máximo</Label>
              <Input
                id="class-capacity"
                type="number"
                min={1}
                value={formState.capacity}
                onChange={(event) =>
                  handleChange("capacity", Number(event.target.value))
                }
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

            <div className="md:col-span-2 flex items-start gap-3 rounded-lg border border-dashed border-primary/30 bg-muted/30 p-4">
              <Checkbox
                id="accept-receipts"
                checked={formState.accept_receipts}
                onCheckedChange={(checked) =>
                  handleChange("accept_receipts", checked === true)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="accept-receipts" className="font-semibold">
                  Aceptar comprobantes
                </Label>
                <p className="text-sm text-muted-foreground">
                  Cuando está activo, los socios podrán adjuntar una imagen o
                  PDF del pago al inscribirse. El comprobante quedará disponible
                  en la lista de inscriptos.
                </p>
              </div>
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
              Comparte este enlace general con tus socios para que vean todas
              las clases y elijan su cupo.
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
                Todavía no hay clases cargadas. Crea la primera para comenzar a
                tomar reservas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Cupo</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Inscriptos</TableHead>
                      <TableHead>Notas para los socios</TableHead>
                      <TableHead>Comprobantes</TableHead>
                      <TableHead className="w-[260px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSessions.map((session) => {
                      const sessionRegistrations =
                        registrationsBySession.get(session.id) ?? [];
                      const spotsLeft = Math.max(
                        session.capacity - sessionRegistrations.length,
                        0
                      );
                      const isFull = spotsLeft <= 0;

                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.title}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{session.capacity}</span>
                              <Badge
                                variant={isFull ? "destructive" : "secondary"}
                              >
                                {isFull
                                  ? "Cupo completo"
                                  : `${spotsLeft} lugares libres`}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(
                              `${session.date}T00:00:00`
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{session.start_time} hs</TableCell>
                          <TableCell className="font-semibold">
                            {sessionRegistrations.length}
                          </TableCell>
                          <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">
                            {session.notes?.trim() ? session.notes : "-"}
                          </TableCell>
                          <TableCell>
                            {session.accept_receipts ? (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                                Solicita comprobante
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No solicitado
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyLink(session)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                {copySuccessId === session.id
                                  ? "Link copiado"
                                  : "Copiar enlace"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleOpenRegistrations(session.id)
                                }
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Ver lista
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteSession(session.id)}
                                disabled={deletingId === session.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={isRegistrationsDialogOpen}
        onOpenChange={handleCloseRegistrations}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSessionId
                ? `Inscriptos - ${
                    sessions.find((session) => session.id === selectedSessionId)
                      ?.title ?? ""
                  }`
                : "Inscriptos"}
            </DialogTitle>
            {selectedSessionId && (
              <DialogDescription>
                {(() => {
                  const selectedSession = sessions.find(
                    (session) => session.id === selectedSessionId
                  );
                  if (!selectedSession) return null;
                  return `Fecha: ${new Date(
                    `${selectedSession.date}T00:00:00`
                  ).toLocaleDateString()} - ${selectedSession.start_time} hs`;
                })()}
              </DialogDescription>
            )}
            {(() => {
              if (!selectedSessionId) return null;
              const selectedSession = sessions.find(
                (session) => session.id === selectedSessionId
              );
              if (!selectedSession?.accept_receipts) return null;
              return (
                <p className="text-sm text-muted-foreground">
                  Esta clase solicita que los socios adjunten el comprobante de
                  pago al registrarse.
                </p>
              );
            })()}
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            {(() => {
              const sessionRegistrations = selectedSessionId
                ? registrationsBySession.get(selectedSessionId) ?? []
                : [];

              if (sessionRegistrations.length === 0) {
                return (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Aún no hay inscriptos para esta clase.
                  </div>
                );
              }

              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Fecha de inscripción</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead className="w-40">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionRegistrations.map((registration, index) => (
                      <TableRow key={registration.id}>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>{registration.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {registration.email || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {registration.phone || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {registration.created_at
                            ? new Date(registration.created_at).toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {registration.receipt_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a
                                href={registration.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Ver
                              </a>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No adjunto
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleDeleteRegistration(registration.id)
                            }
                            disabled={
                              deletingRegistrationId === registration.id
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingRegistrationId === registration.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
          <DialogFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Descarga la lista en formato Excel para gestionarla fuera de la
              plataforma.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  if (!selectedSessionId) return;
                  const session = sessions.find(
                    (current) => current.id === selectedSessionId
                  );
                  if (!session) return;
                  const sessionRegistrations =
                    registrationsBySession.get(selectedSessionId) ?? [];
                  handleDownloadRegistrations(session, sessionRegistrations);
                }}
                disabled={
                  !selectedSessionId || downloadingId === selectedSessionId
                }
              >
                <Download className="mr-2 h-4 w-4" />
                {downloadingId === selectedSessionId
                  ? "Generando archivo..."
                  : "Descargar lista"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
