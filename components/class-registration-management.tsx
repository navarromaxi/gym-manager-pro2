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
  Edit,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  CalendarDays,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type { ClassRegistration, ClassSession, DailyEvent } from "@/lib/supabase";
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
  price: number;
  notes: string;
  accept_receipts: boolean;
}

const INITIAL_FORM_STATE: ClassSessionFormState = {
  title: "",
  date: "",
  start_time: "",
  capacity: 20,
  price: 0,
  notes: "",
  accept_receipts: false,
};

interface DailyEventFormState {
  title: string; date: string; start_time: string; end_time: string;
  slot_interval_minutes: number; capacity_per_slot: number; notes: string; accept_receipts: boolean;
}

const INITIAL_DAILY_EVENT_FORM: DailyEventFormState = {
  title: "", date: "", start_time: "", end_time: "", slot_interval_minutes: 30,
  capacity_per_slot: 1, notes: "", accept_receipts: false,
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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
  const [deletingRegistrationId, setDeletingRegistrationId] = useState<
    string | null
  >(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editFormState, setEditFormState] =
    useState<ClassSessionFormState>(INITIAL_FORM_STATE);
  const [updating, setUpdating] = useState(false);
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [dailyEventForm, setDailyEventForm] = useState<DailyEventFormState>(INITIAL_DAILY_EVENT_FORM);
  const [dailyDialogOpen, setDailyDialogOpen] = useState(false);
  const [creatingDailyEvent, setCreatingDailyEvent] = useState(false);
  const [selectedDailyEventId, setSelectedDailyEventId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareBaseUrl(window.location.origin);
    }
  }, []);

  const loadDailyEvents = async () => {
    if (!gymId) return;
    const response = await authenticatedFetch(`/api/daily-events?gymId=${encodeURIComponent(gymId)}`);
    const payload = await response.json().catch(() => null) as { events?: DailyEvent[]; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "No se pudieron cargar los eventos diarios.");
    setDailyEvents(payload?.events ?? []);
  };

  useEffect(() => {
    void loadDailyEvents().catch((error) => console.error("Error cargando eventos diarios", error));
  }, [gymId]);

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
          "id, gym_id, title, date, start_time, capacity, price, notes, created_at, accept_receipts, daily_event_id"
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

  const createFormStateUpdater = (
    setter: Dispatch<SetStateAction<ClassSessionFormState>>
  ) => {
    return <K extends keyof ClassSessionFormState>(
      field: K,
      value: ClassSessionFormState[K]
    ) => {
      setter((prev) => {
        if (field === "capacity") {
          const numericValue =
            typeof value === "number" ? value : Number(value) || 1;
          return {
            ...prev,
            capacity: Math.max(1, Math.floor(numericValue)),
          };
        }

        if (field === "price") {
          const numericValue =
            typeof value === "number" ? value : Number(value);
          const sanitized = Number.isFinite(numericValue)
            ? Math.max(0, numericValue)
            : 0;
          return {
            ...prev,
            price: sanitized,
          };
        }

        return {
          ...prev,
          [field]: value,
        };
      });
    };
  };

  const handleChange = createFormStateUpdater(setFormState);
  const handleEditChange = createFormStateUpdater(setEditFormState);

  const resetForm = () => {
    setFormState(INITIAL_FORM_STATE);
  };

  const resetEditForm = () => {
    setEditFormState(INITIAL_FORM_STATE);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingSessionId(null);
    resetEditForm();
  };

  const validateFormState = (state: ClassSessionFormState) => {
    if (!state.title.trim()) {
      return "Ingresa un título para la clase.";
    }

    if (!state.date) {
      return "Selecciona una fecha para la clase.";
    }

    if (!state.start_time) {
      return "Selecciona un horario de inicio.";
    }

    if (!Number.isFinite(state.price) || state.price < 0) {
      return "Ingresa un precio válido (0 o mayor).";
    }

    return null;
  };

  const handleEditDialogChange = (open: boolean) => {
    if (open) {
      setIsEditDialogOpen(true);
      return;
    }

    closeEditDialog();
  };

  const handleOpenEditDialog = (session: ClassSession) => {
    setEditingSessionId(session.id);
    setEditFormState({
      title: session.title,
      date: session.date,
      start_time: session.start_time,
      capacity: session.capacity,
      price: typeof session.price === "number" ? session.price : 0,
      notes: session.notes ?? "",
      accept_receipts: session.accept_receipts ?? false,
    });
    setFeedback(null);
    setIsEditDialogOpen(true);
  };

  const handleCreateSession = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!gymId) return;

    const validationError = validateFormState(formState);
    if (validationError) {
      setFeedback({
        type: "error",
        message: validationError,
      });
      return;
    }

    setCreating(true);
    setFeedback(null);

    try {
      const response = await authenticatedFetch("/api/class-sessions", {
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
          price: formState.price,
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
        message: "Evento creado correctamente.",
      });
      resetForm();
      setIsCreateDialogOpen(false);
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

  const handleUpdateSession = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!gymId || !editingSessionId) return;

    const validationError = validateFormState(editFormState);
    if (validationError) {
      setFeedback({
        type: "error",
        message: validationError,
      });
      return;
    }

    setUpdating(true);
    setFeedback(null);

    try {
      const response = await authenticatedFetch("/api/class-sessions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          sessionId: editingSessionId,
          title: editFormState.title.trim(),
          date: editFormState.date,
          startTime: editFormState.start_time,
          capacity: editFormState.capacity,
          price: editFormState.price,
          notes: editFormState.notes.trim() || null,
          acceptReceipts: editFormState.accept_receipts,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { data: ClassSession; error?: string }
        | { error?: string }
        | null;

      if (!response.ok) {
        const error = payload && "error" in payload ? payload.error : undefined;
        throw new Error(
          error ||
            "No se pudo actualizar la clase. Intenta nuevamente más tarde."
        );
      }

      if (!payload || !("data" in payload)) {
        throw new Error(
          "No se pudo actualizar la clase. Intenta nuevamente más tarde."
        );
      }

      const { data } = payload;

      setSessions((prev) =>
        prev.map((session) => (session.id === data.id ? data : session))
      );
      setFeedback({
        type: "success",
        message: "Clase actualizada correctamente.",
      });
      closeEditDialog();
    } catch (error) {
      console.error("Error actualizando la clase", error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la clase. Revisa la conexión e intenta nuevamente.",
      });
    } finally {
      setUpdating(false);
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
      const response = await authenticatedFetch("/api/class-sessions", {
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
      const response = await authenticatedFetch("/api/class-registrations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          registrationId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

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
          ? `<a href="${escapeHtml(
              registration.receipt_url
            )}" target="_blank" rel="noopener noreferrer">Ver comprobante</a>`
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
      await Promise.all([fetchLatestData(), loadDailyEvents()]);
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

  const handleCreateDailyEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gymId) return;
    if (!dailyEventForm.title.trim() || !dailyEventForm.date || !dailyEventForm.start_time || !dailyEventForm.end_time) {
      setFeedback({ type: "error", message: "Completa el nombre, la fecha y ambos horarios." }); return;
    }
    if (dailyEventForm.end_time <= dailyEventForm.start_time) {
      setFeedback({ type: "error", message: "La hora de fin debe ser posterior a la de inicio." }); return;
    }
    setCreatingDailyEvent(true); setFeedback(null);
    try {
      const response = await authenticatedFetch("/api/daily-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gymId, ...dailyEventForm, title: dailyEventForm.title.trim(), notes: dailyEventForm.notes.trim() || null }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo crear el evento diario.");
      setDailyEventForm(INITIAL_DAILY_EVENT_FORM); setDailyDialogOpen(false);
      await Promise.all([fetchLatestData(), loadDailyEvents()]);
      setFeedback({ type: "success", message: "Agenda diaria creada. Ya puedes copiar y compartir su enlace." });
    } catch (error) { setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo crear el evento diario." }); }
    finally { setCreatingDailyEvent(false); }
  };

  const handleCopyDailyLink = async (dailyEvent: DailyEvent) => {
    const url = `${shareBaseUrl}/inscripciones/${gymId}?diario=${dailyEvent.id}`;
    try { await navigator.clipboard.writeText(url); setCopySuccessId(dailyEvent.id); setTimeout(() => setCopySuccessId((current) => current === dailyEvent.id ? null : current), 3000); }
    catch { setFeedback({ type: "error", message: `No se pudo copiar el enlace. Copia manualmente: ${url}` }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Eventos</h2>
        <p className="text-muted-foreground">
          Organiza eventos con cupos limitados y comparte el enlace con tus
          socios para que reserven su lugar de forma sencilla.
        </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md shadow-violet-200 hover:from-violet-700 hover:to-fuchsia-700" onClick={() => { resetForm(); setFeedback(null); setIsCreateDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Crear evento
          </Button>
          <Button type="button" className="rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-950 shadow-sm hover:bg-cyan-100" onClick={() => { setDailyEventForm(INITIAL_DAILY_EVENT_FORM); setFeedback(null); setDailyDialogOpen(true); }}>
            <CalendarDays className="mr-2 h-4 w-4" /> Crear evento diario
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle>Crear nuevo evento</CardTitle>
          <CardDescription>
            Completa los datos para agregar un evento y controlar su
            cupo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={handleCreateSession}
          >
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="class-title">Nombre del evento</Label>
              <Input
                id="class-title"
                placeholder="Por ejemplo: Ida a Colonia"
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

            <div className="space-y-2">
              <Label htmlFor="class-price">Precio del ticket</Label>
              <Input
                id="class-price"
                type="number"
                min={0}
                step="0.01"
                value={formState.price}
                onChange={(event) =>
                  handleChange("price", Number(event.target.value))
                }
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="class-notes">Notas (opcional)</Label>
              <Textarea
                id="class-notes"
                placeholder="Agrega detalles importantes, qué llevar, punto de encuentro, etc."
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
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creando..." : "Crear evento"}
              </Button>
            </div>
          </form>
        </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      <Dialog open={dailyDialogOpen} onOpenChange={setDailyDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-slate-200 bg-white text-slate-950 [&_input]:border-slate-300 [&_input]:bg-white [&_input]:text-slate-950 [&_textarea]:border-slate-300 [&_textarea]:bg-white [&_textarea]:text-slate-950">
          <DialogHeader><DialogTitle className="text-slate-950">Crear evento diario con turnos</DialogTitle><DialogDescription className="text-slate-600">Se generará un único enlace para que cada persona elija un horario disponible.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreateDailyEvent} className="grid gap-4 md:grid-cols-2 [&_label]:text-slate-800">
            <div className="space-y-2 md:col-span-2"><Label>Nombre del evento</Label><Input required value={dailyEventForm.title} onChange={(event) => setDailyEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej.: Jornada de depilación" /></div>
            <div className="space-y-2"><Label>Fecha</Label><Input required type="date" value={dailyEventForm.date} onChange={(event) => setDailyEventForm((current) => ({ ...current, date: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Duración de cada turno</Label><Input required type="number" min={5} max={240} step={5} value={dailyEventForm.slot_interval_minutes} onChange={(event) => setDailyEventForm((current) => ({ ...current, slot_interval_minutes: Number(event.target.value) || 5 }))} /><p className="text-xs text-muted-foreground">Minutos entre cada horario.</p></div>
            <div className="space-y-2"><Label>Hora de inicio</Label><Input required type="time" value={dailyEventForm.start_time} onChange={(event) => setDailyEventForm((current) => ({ ...current, start_time: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Hora de fin</Label><Input required type="time" value={dailyEventForm.end_time} onChange={(event) => setDailyEventForm((current) => ({ ...current, end_time: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Personas por horario</Label><Input required type="number" min={1} value={dailyEventForm.capacity_per_slot} onChange={(event) => setDailyEventForm((current) => ({ ...current, capacity_per_slot: Number(event.target.value) || 1 }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notas (opcional)</Label><Textarea value={dailyEventForm.notes} onChange={(event) => setDailyEventForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <label className="md:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-950"><Checkbox checked={dailyEventForm.accept_receipts} onCheckedChange={(checked) => setDailyEventForm((current) => ({ ...current, accept_receipts: checked === true }))} /><span><b>Solicitar comprobante</b><span className="mt-1 block text-sm text-slate-700">Al reservar, será obligatorio adjuntar una imagen o PDF.</span></span></label>
            <DialogFooter className="md:col-span-2"><Button type="button" variant="outline" onClick={() => setDailyDialogOpen(false)} disabled={creatingDailyEvent}>Cancelar</Button><Button disabled={creatingDailyEvent} className="bg-cyan-600 hover:bg-cyan-700">{creatingDailyEvent ? "Creando turnos..." : "Crear agenda diaria"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {dailyEvents.length > 0 && <Card className="border-cyan-100 bg-gradient-to-br from-cyan-50 to-white"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-700" />Eventos diarios con turnos</CardTitle><CardDescription>Cada evento tiene un enlace único y sus horarios se ocupan de forma independiente.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{dailyEvents.map((dailyEvent) => { const slots = sessions.filter((session) => session.daily_event_id === dailyEvent.id); const booked = slots.reduce((total, slot) => total + (registrationsBySession.get(slot.id)?.length ?? 0), 0); return <div key={dailyEvent.id} className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm"><div className="flex justify-between gap-3"><div><p className="font-bold text-slate-950">{dailyEvent.title}</p><p className="mt-1 text-sm text-slate-600">{new Date(`${dailyEvent.date}T00:00:00`).toLocaleDateString()} · {dailyEvent.start_time} a {dailyEvent.end_time}</p></div><Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100">{slots.length} turnos</Badge></div><p className="mt-3 text-sm text-slate-600"><b>{booked}</b> reservas · {dailyEvent.capacity_per_slot} por horario{dailyEvent.accept_receipts ? " · con comprobante" : ""}</p><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => handleCopyDailyLink(dailyEvent)}><Copy className="mr-2 h-4 w-4" />{copySuccessId === dailyEvent.id ? "Link copiado" : "Copiar enlace"}</Button><Button size="sm" variant="secondary" onClick={() => setSelectedDailyEventId(dailyEvent.id)}><Users className="mr-2 h-4 w-4" />Ver reservas</Button></div></div>; })}</CardContent></Card>}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Eventos programados</h3>
            <p className="text-sm text-muted-foreground">
              Comparte este enlace general con tus socios para que vean todos
              los eventos y reserven su lugar.
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
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Actualizar eventos"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="sr-only">Actualizar eventos</span>
            </Button>
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
                Todavía no hay eventos cargados. Crea el primero para comenzar a
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
                      <TableHead>Precio</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Inscriptos</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead>Comprobantes</TableHead>
                      <TableHead className="w-[320px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSessions.filter((session) => !session.daily_event_id).map((session) => {
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
                            {formatCurrency(session.price) ?? "-"}
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
                              <Badge
                                variant="secondary"
                                className="bg-emerald-100 text-emerald-800"
                              >
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
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditDialog(session)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
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

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar clase</DialogTitle>
            <DialogDescription>
              Actualiza el nombre, la fecha, el horario, el cupo, el precio o
              las notas del evento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSession} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="edit-class-title">Nombre de la clase</Label>
                <Input
                  id="edit-class-title"
                  value={editFormState.title}
                  onChange={(event) =>
                    handleEditChange("title", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-class-date">Fecha</Label>
                <Input
                  id="edit-class-date"
                  type="date"
                  value={editFormState.date}
                  onChange={(event) =>
                    handleEditChange("date", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-class-time">Horario</Label>
                <Input
                  id="edit-class-time"
                  type="time"
                  value={editFormState.start_time}
                  onChange={(event) =>
                    handleEditChange("start_time", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-class-capacity">Cupo máximo</Label>
                <Input
                  id="edit-class-capacity"
                  type="number"
                  min={1}
                  value={editFormState.capacity}
                  onChange={(event) =>
                    handleEditChange("capacity", Number(event.target.value))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-class-price">Precio del ticket</Label>
                <Input
                  id="edit-class-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editFormState.price}
                  onChange={(event) =>
                    handleEditChange("price", Number(event.target.value))
                  }
                />
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="edit-class-notes">Notas (opcional)</Label>
                <Textarea
                  id="edit-class-notes"
                  placeholder="Agrega detalles como nivel de la clase, qué llevar, etc."
                  value={editFormState.notes}
                  onChange={(event) =>
                    handleEditChange("notes", event.target.value)
                  }
                />
              </div>

              <div className="md:col-span-2 flex items-start gap-3 rounded-lg border border-dashed border-primary/30 bg-muted/30 p-4">
                <Checkbox
                  id="edit-accept-receipts"
                  checked={editFormState.accept_receipts}
                  onCheckedChange={(checked) =>
                    handleEditChange("accept_receipts", checked === true)
                  }
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="edit-accept-receipts"
                    className="font-semibold"
                  >
                    Aceptar comprobantes
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Cuando está activo, los socios podrán adjuntar una imagen o
                    PDF del pago al inscribirse. El comprobante quedará
                    disponible en la lista de inscriptos.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditDialog}
                disabled={updating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedDailyEventId)} onOpenChange={(open) => !open && setSelectedDailyEventId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Reservas por horario</DialogTitle><DialogDescription>{dailyEvents.find((event) => event.id === selectedDailyEventId)?.title ?? "Evento diario"}</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table><TableHeader><TableRow><TableHead>Horario</TableHead><TableHead>Nombre</TableHead><TableHead>Contacto</TableHead><TableHead>Comprobante</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>
              {(sessions.filter((session) => session.daily_event_id === selectedDailyEventId).flatMap((slot) => (registrationsBySession.get(slot.id) ?? []).map((registration) => ({ slot, registration })))).length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Todavía no hay reservas.</TableCell></TableRow> : sessions.filter((session) => session.daily_event_id === selectedDailyEventId).flatMap((slot) => (registrationsBySession.get(slot.id) ?? []).map((registration) => ({ slot, registration }))).map(({ slot, registration }) => <TableRow key={registration.id}><TableCell className="font-semibold">{slot.start_time} hs</TableCell><TableCell>{registration.full_name}</TableCell><TableCell className="text-muted-foreground">{registration.email || registration.phone || "-"}</TableCell><TableCell>{registration.receipt_url ? <Button variant="outline" size="sm" asChild><a href={registration.receipt_url} target="_blank" rel="noopener noreferrer">Ver</a></Button> : "-"}</TableCell><TableCell><Button variant="destructive" size="sm" onClick={() => handleDeleteRegistration(registration.id)} disabled={deletingRegistrationId === registration.id}>Eliminar</Button></TableCell></TableRow>)}
            </TableBody></Table>
          </div>
        </DialogContent>
      </Dialog>

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
                            <Button variant="outline" size="sm" asChild>
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
