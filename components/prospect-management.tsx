"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  UserPlus,
  AlertTriangle,
  X,
  History,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  Prospect,
  Member,
  Payment,
  Plan,
  ProspectHistory,
} from "@/lib/supabase";

interface ProspectManagementProps {
  prospects: Prospect[];
  setProspects: Dispatch<SetStateAction<Prospect[]>>;
  members: Member[];
  setMembers: Dispatch<SetStateAction<Member[]>>;
  payments: Payment[];
  setPayments: Dispatch<SetStateAction<Payment[]>>;
  plans: Plan[];
  gymId: string;
  prospectHistories: ProspectHistory[];
  setProspectHistories: Dispatch<SetStateAction<ProspectHistory[]>>;
}

interface ConversionData {
  plan: string;
  planPrice: number;
  planStartDate: string;
  paymentDate: string;
  installments: number;
  paymentAmount: number;
  paymentMethod: string;
  cardBrand: string;
  cardInstallments: number;
  description: string;
  nextInstallmentDue: string;
}

const calculatePlanEndDate = (startDate: string, plan?: Plan | null) => {
  if (!startDate) return "";
  const baseDate = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) {
    return startDate;
  }

  if (plan) {
    if (plan.duration_type === "days") {
      baseDate.setDate(baseDate.getDate() + plan.duration);
    } else if (plan.duration_type === "months") {
      baseDate.setMonth(baseDate.getMonth() + plan.duration);
    } else if (plan.duration_type === "years") {
      baseDate.setFullYear(baseDate.getFullYear() + plan.duration);
    }
  }

  return baseDate.toISOString().split("T")[0];
};

export function ProspectManagement({
  prospects,
  setProspects,
  members,
  setMembers,
  payments,
  setPayments,
  plans,
  gymId,
  prospectHistories,
  setProspectHistories,
}: ProspectManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [convertingProspect, setConvertingProspect] = useState<Prospect | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all"); // Nuevo estado para el filtro de prioridad
  const [scheduledDateFilter, setScheduledDateFilter] = useState(""); // estado para el filtro de fecha
  const [newProspect, setNewProspect] = useState({
    name: "",
    email: "",
    phone: "",
    contact_date: new Date().toISOString().split("T")[0],
    interest: "",
    status: "averiguador" as Prospect["status"],
    notes: "",
    priority_level: "green" as "green" | "yellow" | "red", // Nuevo campo con valor por defecto
    scheduled_date: "",
  });
  const [originalProspect, setOriginalProspect] = useState<Prospect | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedHistoryProspect, setSelectedHistoryProspect] =
    useState<Prospect | null>(null);
  const [historySaving, setHistorySaving] = useState(false);
  const [historyTableError, setHistoryTableError] = useState<string | null>(
    null
  );
  const getEmptyHistoryForm = () => ({
    actionType: "seguimiento",
    summary: "",
    detail: "",
  });
  const [historyForm, setHistoryForm] = useState(getEmptyHistoryForm);

  const historyActionOptions = [
    { value: "seguimiento", label: "Seguimiento" },
    { value: "llamada", label: "Llamada telefónica" },
    { value: "whatsapp", label: "Mensaje / WhatsApp" },
    { value: "email", label: "Email" },
    { value: "actualizacion", label: "Actualización interna" },
    { value: "otro", label: "Otro" },
  ];

  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
  ];
  const cardBrands = ["Visa", "Mastercard", "American Express", "Otra"];
   const statusLabels: Record<Prospect["status"], string> = {
    averiguador: "Averiguador",
    trial_scheduled: "Coordinamos clase de prueba",
    reagendado: "Re/Agendado",
    asistio: "Asistio",
    no_asistio: "No asistio",
    inactivo: "Inactivo",
    otro: "Otro",
  };
  const priorityLabels: Record<"green" | "yellow" | "red", string> = {
    red: "Alta",
    yellow: "Media",
    green: "Baja",
  };
  const actionLabels: Record<string, string> = {
    seguimiento: "Seguimiento",
    llamada: "Llamada telefónica",
    whatsapp: "Mensaje / WhatsApp",
    email: "Email",
    actualizacion: "Actualización interna",
    otro: "Otro",
    creacion: "Creación",
    cambio_estado: "Cambio de estado",
    agenda_actualizada: "Agenda actualizada",
    notas_actualizadas: "Notas actualizadas",
    prioridad_actualizada: "Prioridad actualizada",
    interes_actualizado: "Interés actualizado",
  };
  const getStatusLabel = (status?: Prospect["status"] | null) => {
    if (!status) return "Sin estado";
    return statusLabels[status] ?? status;
  };
  const getPriorityLabel = (
    priority?: "green" | "yellow" | "red" | null
  ) => {
    if (!priority) return "Sin prioridad";
    return priorityLabels[priority] ?? priority;
  };
  const getActionLabel = (action: string) => {
    if (!action) return "Registro";
    return actionLabels[action] ?? action.replace(/_/g, " ");
  };
  const getInitialConversionData = (): ConversionData => {
    const today = new Date().toISOString().split("T")[0];
    return {
      plan: "",
      planPrice: 0,
      planStartDate: today,
      paymentDate: today,
      installments: 1,
      paymentAmount: 0,
      paymentMethod: "Efectivo",
      cardBrand: "",
      cardInstallments: 1,
      description: "",
      nextInstallmentDue: today,
    };
  };
  const [conversionData, setConversionData] = useState<ConversionData>(
    getInitialConversionData
  );
  const [contractTable, setContractTable] = useState<
    "plan_contracts" | "plan_contract" | null
  >(null);

  const selectedConversionPlan = useMemo(() => {
    return plans.find((plan) => plan.name === conversionData.plan) ?? null;
  }, [plans, conversionData.plan]);

  const calculatedConversionEndDate = useMemo(
    () =>
      calculatePlanEndDate(
        conversionData.planStartDate,
        selectedConversionPlan
      ),
    [conversionData.planStartDate, selectedConversionPlan]
  );

  const conversionNextInstallmentValue =
    conversionData.installments === 1
      ? calculatedConversionEndDate
      : conversionData.nextInstallmentDue || calculatedConversionEndDate;

  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);

  const [isClient, setIsClient] = useState(false);

  const historiesByProspect = useMemo(() => {
    const grouped: Record<string, ProspectHistory[]> = {};
    for (const history of prospectHistories) {
      if (!grouped[history.prospect_id]) {
        grouped[history.prospect_id] = [];
      }
      grouped[history.prospect_id].push(history);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
    }
    return grouped;
  }, [prospectHistories]);

  const selectedProspectHistories = useMemo(
    () =>
      selectedHistoryProspect
        ? historiesByProspect[selectedHistoryProspect.id] ?? []
        : [],
    [historiesByProspect, selectedHistoryProspect]
  );

  const formatDate = (date?: string | null) => {
    if (!date) return null;
    return new Date(`${date}T00:00:00`).toLocaleDateString();
  };

   const parseScheduledDate = (value?: string | null) => {
    if (!value) return null;
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;

    const normalizedValue = trimmedValue.includes("T")
      ? trimmedValue
      : trimmedValue.includes(" ")
        ? trimmedValue.replace(" ", "T")
        : `${trimmedValue}T00:00:00`;

    let parsedDate = new Date(normalizedValue);

    if (Number.isNaN(parsedDate.getTime())) {
      const slashDateMatch = trimmedValue.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}))?$/
      );

      if (slashDateMatch) {
        const [, day, month, year, time] = slashDateMatch;
        const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}${
          time ? `T${time}` : "T00:00"
        }:00`;
        parsedDate = new Date(isoDate);
      }
    }

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  const formatScheduledDateTime = (value?: string | null) => {
    if (!value) return null;
    const parsed = parseScheduledDate(value);
    if (!parsed) return null;

    const hasTime = value.includes(":");
    const formatterOptions: Intl.DateTimeFormatOptions = hasTime
      ? { dateStyle: "short", timeStyle: "short" }
      : { dateStyle: "short" };

    return parsed.toLocaleString(undefined, formatterOptions);
  };

   const formatHistoryDate = (value: string) => {
    if (!value) return "";
    return new Date(value).toLocaleString();
  };

  const getReminderKey = (prospect: Prospect) =>
    `${prospect.id}-${prospect.scheduled_date ?? ""}`;

   const logProspectHistory = async (
    prospect: Prospect,
    entry: {
      actionType: string;
      summary: string;
      detail?: string;
      previousStatus?: Prospect["status"] | null;
      newStatus?: Prospect["status"] | null;
      previousScheduledDate?: string | null;
      newScheduledDate?: string | null;
      manualEntry?: boolean;
    }
  ) => {
    if (!gymId) return false;

    try {
      const payload = {
        gym_id: gymId,
        prospect_id: prospect.id,
        action_type: entry.actionType,
        summary: entry.summary,
        detail: entry.detail ?? null,
        previous_status: entry.previousStatus ?? null,
        new_status: entry.newStatus ?? null,
        previous_scheduled_date: entry.previousScheduledDate ?? null,
        new_scheduled_date: entry.newScheduledDate ?? null,
        manual_entry: entry.manualEntry ?? false,
      };

      const { data, error } = await supabase
        .from("prospect_history")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const inserted = data as ProspectHistory;
        setProspectHistories((prev) => {
          const filtered = prev.filter((item) => item.id !== inserted.id);
          return [inserted, ...filtered];
        });
      }

      setHistoryTableError(null);
      return true;
    } catch (error: any) {
      console.error("Error registrando historial:", error);
      const message =
        error?.code === "42P01"
          ? "La tabla prospect_history no existe. Crea la tabla en Supabase para habilitar el historial."
          : error?.message || "Error al guardar el historial.";
      setHistoryTableError(message);
      return false;
    }
  };

  const handleDismissReminder = (key: string) => {
    setDismissedReminders((prev) =>
      prev.includes(key) ? prev : [...prev, key]
    );
  };

  const handleEditDialogOpenChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingProspect(null);
      setOriginalProspect(null);
    }
  };

  const handleHistoryDialogOpenChange = (open: boolean) => {
    setIsHistoryDialogOpen(open);
    if (!open) {
      setSelectedHistoryProspect(null);
      setHistoryForm(getEmptyHistoryForm());
      setHistorySaving(false);
      setHistoryTableError(null);
    }
  };

  const openHistoryDialog = (prospect: Prospect) => {
    setSelectedHistoryProspect(prospect);
    setHistoryForm((prev) => ({
      actionType: prev.actionType || "seguimiento",
      summary: "",
      detail: "",
    }));
    setHistoryTableError(null);
    setIsHistoryDialogOpen(true);
  };

  const handleSaveHistoryEntry = async () => {
    if (!selectedHistoryProspect) return;

    const summary = historyForm.summary.trim();
    const detail = historyForm.detail.trim();

    if (!summary) {
      alert("Por favor ingresa un título o resumen corto para el registro.");
      return;
    }

    setHistorySaving(true);
    const saved = await logProspectHistory(selectedHistoryProspect, {
      actionType: historyForm.actionType,
      summary,
      detail: detail || undefined,
      manualEntry: true,
    });

    if (saved) {
      setHistoryForm((prev) => ({
        ...prev,
        summary: "",
        detail: "",
      }));
    }

    setHistorySaving(false);
  };

  useEffect(() => {
    const checkTable = async () => {
      const { data, error } = await supabase
        .from("pg_tables")
        .select("tablename")
        .in("tablename", ["plan_contracts", "plan_contract"]);

      if (error) {
        console.warn("Error verificando tablas de contratos:", error);
        return;
      }

      const tableName = data?.[0]?.tablename as
        | "plan_contracts"
        | "plan_contract"
        | undefined;
      setContractTable(tableName ?? null);
    };

    checkTable();
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

   useEffect(() => {
    if (!selectedHistoryProspect) return;
    const updated = prospects.find(
      (p) => p.id === selectedHistoryProspect.id
    );
    if (updated && updated !== selectedHistoryProspect) {
      setSelectedHistoryProspect(updated);
    }
  }, [prospects, selectedHistoryProspect]);

   const upcomingTrialReminders = (() => {
    if (!isClient) return [] as Prospect[];

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prospects.filter((prospect) => {
      if (
        !prospect.scheduled_date ||
        (prospect.status !== "trial_scheduled" &&
          prospect.status !== "reagendado")
      ) {
        return false;
      }

      const reminderKey = getReminderKey(prospect);
      if (dismissedReminders.includes(reminderKey)) {
        return false;
      }

      const scheduled = parseScheduledDate(prospect.scheduled_date);
      if (!scheduled) {
        return false;
      }

      const scheduledDate = new Date(scheduled);
      scheduledDate.setHours(0, 0, 0, 0);

      return scheduledDate.getTime() === tomorrow.getTime();
    });
  })();

  const filteredProspects = prospects.filter((prospect) => {
    const matchesSearch =
      prospect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prospect.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prospect.notes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || prospect.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || prospect.priority_level === priorityFilter; // Nuevo filtro
    const matchesScheduledDate =
      !scheduledDateFilter || prospect.scheduled_date === scheduledDateFilter;
    return (
      matchesSearch && matchesStatus && matchesPriority && matchesScheduledDate
    );
  });

  const sortedProspects = [...filteredProspects].sort((a, b) => {
    const dateA = new Date(`${a.contact_date}T00:00:00`).getTime();
    const dateB = new Date(`${b.contact_date}T00:00:00`).getTime();
    return dateB - dateA;
  });

  const handleAddProspect = async () => {
    try {
      const prospectId = `${gymId}_prospect_${Date.now()}`;

      const prospectToAdd: Prospect = {
        id: prospectId,
        gym_id: gymId,
        name: newProspect.name,
        email: newProspect.email,
        phone: newProspect.phone,
        contact_date: newProspect.contact_date,
        interest: newProspect.interest,
        status: newProspect.status,
        notes: newProspect.notes,
        priority_level: newProspect.priority_level,
        scheduled_date: newProspect.scheduled_date
          ? newProspect.scheduled_date
          : null,
      };

      const { data, error } = await supabase
        .from("prospects")
        .insert([prospectToAdd])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const addedProspect = data[0] as Prospect;
        setProspects((prev) => [...prev, addedProspect]);
        await logProspectHistory(addedProspect, {
          actionType: "creacion",
          summary: "Interesado creado",
          detail: `Se registró al interesado con estado ${getStatusLabel(
            addedProspect.status
          )}.`,
          newStatus: addedProspect.status,
          newScheduledDate: addedProspect.scheduled_date ?? null,
        });
        setNewProspect({
          name: "",
          email: "",
          phone: "",
          contact_date: new Date().toISOString().split("T")[0],
          interest: "",
          status: "averiguador",
          notes: "",
          priority_level: "green", // Resetear a verde por defecto
          scheduled_date: "",
        });
        setIsAddDialogOpen(false);
      }
    } catch (error: any) {
      // Usar 'any' para acceder a 'message'
      console.error("Error agregando interesado:", error.message || error);
      alert(
        `Error al agregar el interesado: ${
          error.message || "Error desconocido"
        }. Revisa la consola para más detalles.`
      );
    }
  };

  const handleEditProspect = async () => {
    if (!editingProspect) return;
    try {
      const { error } = await supabase
        .from("prospects")
        .update({
          name: editingProspect.name,
          email: editingProspect.email,
          phone: editingProspect.phone,
          contact_date: editingProspect.contact_date,
          interest: editingProspect.interest,
          status: editingProspect.status,
          notes: editingProspect.notes,
          priority_level: editingProspect.priority_level, // Incluir el nuevo campo
          scheduled_date: editingProspect.scheduled_date || null,
        })
        .eq("id", editingProspect.id)
        .eq("gym_id", gymId);

      if (error) throw error;

      setProspects((prev) =>
        prev.map((p) => (p.id === editingProspect.id ? editingProspect : p))
      );
      const previousData =
        originalProspect ||
        prospects.find((p) => p.id === editingProspect.id) ||
        null;

      if (previousData) {
        if (previousData.status !== editingProspect.status) {
          await logProspectHistory(editingProspect, {
            actionType: "cambio_estado",
            summary: `Estado actualizado a ${getStatusLabel(
              editingProspect.status
            )}`,
            detail: `El estado se modificó de ${getStatusLabel(
              previousData.status
            )} a ${getStatusLabel(editingProspect.status)}.`,
            previousStatus: previousData.status,
            newStatus: editingProspect.status,
          });
        }

        const previousScheduled = previousData.scheduled_date ?? null;
        const newScheduled = editingProspect.scheduled_date ?? null;
        if (previousScheduled !== newScheduled) {
          const previousText =
            previousScheduled && formatScheduledDateTime(previousScheduled);
          const newText = newScheduled && formatScheduledDateTime(newScheduled);
          await logProspectHistory(editingProspect, {
            actionType: "agenda_actualizada",
            summary: newScheduled
              ? `Clase agendada para ${newText ?? newScheduled}`
              : "Clase de prueba sin agendar",
            detail: `Fecha anterior: ${
              previousText ?? "Sin fecha"
            } | Nueva fecha: ${newText ?? "Sin fecha"}`,
            previousScheduledDate: previousScheduled,
            newScheduledDate: newScheduled,
          });
        }

        if ((previousData.notes || "") !== (editingProspect.notes || "")) {
          await logProspectHistory(editingProspect, {
            actionType: "notas_actualizadas",
            summary: "Notas actualizadas",
            detail: "Se modificaron las notas internas del interesado.",
          });
        }

        const previousPriority = previousData.priority_level ?? null;
        const newPriority = editingProspect.priority_level ?? null;
        if (previousPriority !== newPriority) {
          await logProspectHistory(editingProspect, {
            actionType: "prioridad_actualizada",
            summary: `Prioridad ${
              newPriority ? `actualizada a ${getPriorityLabel(newPriority)}` : "eliminada"
            }`,
            detail: `Valor anterior: ${
              previousPriority
                ? getPriorityLabel(previousPriority)
                : "Sin prioridad"
            } | Nuevo valor: ${
              newPriority ? getPriorityLabel(newPriority) : "Sin prioridad"
            }`,
          });
        }

        if (
          (previousData.interest || "") !== (editingProspect.interest || "")
        ) {
          await logProspectHistory(editingProspect, {
            actionType: "interes_actualizado",
            summary: "Interés actualizado",
            detail: `Interés anterior: ${
              previousData.interest || "Sin datos"
            } | Nuevo interés: ${editingProspect.interest || "Sin datos"}`,
          });
        }
      }

      handleEditDialogOpenChange(false);
    } catch (error) {
      console.error("Error editando interesado:", error);
      alert("Error al editar el interesado. Inténtalo de nuevo.");
    }
  };

  

  const handleDeleteProspect = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este interesado?"))
      return;
    try {
      const { error } = await supabase
        .from("prospects")
        .delete()
        .eq("id", id)
        .eq("gym_id", gymId);
      if (error) throw error;

      setProspects((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error eliminando interesado:", error);
      alert("Error al eliminar el interesado. Inténtalo de nuevo.");
    }
  };

  
  const handleConvertDialogOpenChange = (open: boolean) => {
    setIsConvertDialogOpen(open);
    if (!open) {
      setConvertingProspect(null);
      setConversionData(getInitialConversionData());
    }
  };

  const startConversion = (prospect: Prospect) => {
    setConvertingProspect(prospect);
    setConversionData(getInitialConversionData());
    setIsConvertDialogOpen(true);
  };

  const handleConvertProspectToMember = async () => {
    if (!convertingProspect) return;
    try {
      const selectedPlan = plans.find((p) => p.name === conversionData.plan);
      if (!selectedPlan) {
        alert("Debes seleccionar un plan");
        return;
      }

      // 1. Crear el nuevo miembro
      const installments = conversionData.installments || 1;
      const paymentAmount =
        installments === 1
          ? conversionData.planPrice
          : conversionData.paymentAmount;

      if (paymentAmount <= 0) {
        alert("Debes ingresar un monto válido");
        return;
      }

      if (paymentAmount > conversionData.planPrice) {
        alert("El monto no puede ser mayor al precio del plan");
        return;
      }

      const startDate = new Date(`${conversionData.planStartDate}T00:00:00`);
      const nextPayment = new Date(startDate);

      if (selectedPlan.duration_type === "days") {
        nextPayment.setDate(nextPayment.getDate() + selectedPlan.duration);
      } else if (selectedPlan.duration_type === "months") {
        nextPayment.setMonth(nextPayment.getMonth() + selectedPlan.duration);
      } else if (selectedPlan.duration_type === "years") {
        nextPayment.setFullYear(
          nextPayment.getFullYear() + selectedPlan.duration
        );
      }

      const nextPaymentISO = nextPayment.toISOString().split("T")[0];
      const nextInstallmentDue =
        installments === 1
          ? nextPaymentISO
          : conversionData.nextInstallmentDue || nextPaymentISO;

      const today = new Date();
      const diffTime = today.getTime() - nextPayment.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let memberStatus: "active" | "expired" | "inactive" = "active";
      let inactiveLevel: "green" | "yellow" | "red" | undefined = undefined;

      if (nextPayment > today) {
        memberStatus = "active";
      } else if (diffDays > 0) {
        if (diffDays > 30) {
          memberStatus = "inactive";
          inactiveLevel = "yellow";
        } else {
          memberStatus = "expired";
        }
      } else {
        memberStatus = "expired";
      }

      const memberId = `${gymId}_member_${Date.now()}`;
      const newMember: Member = {
        id: memberId,
        gym_id: gymId,
        name: convertingProspect.name,
        email: convertingProspect.email || "",
        phone: convertingProspect.phone || "",
        join_date: conversionData.paymentDate,
        plan: selectedPlan.name,
        plan_price: conversionData.planPrice,
        last_payment: conversionData.planStartDate,
        next_payment: nextPaymentISO,
        next_installment_due: nextInstallmentDue,
        status: memberStatus,
        inactive_level: inactiveLevel,
        balance_due: conversionData.planPrice - paymentAmount,
        followed_up: false,
      };

      const { error: memberError } = await supabase
        .from("members")
        .insert([newMember]);
      if (memberError) throw memberError;

      // 2. Crear el pago inicial
      if (contractTable) {
        const contractId = `${memberId}_contract_${Date.now()}`;
        const contract = {
          id: contractId,
          gym_id: gymId,
          member_id: memberId,
          plan_id: selectedPlan.id,
          installments_total: installments,
          installments_paid: 1,
        };

        const { error: contractError } = await supabase
          .from(contractTable)
          .insert([contract]);

        if (contractError) {
          console.warn("Error registrando contrato de plan:", contractError);
        }
      }

      const newPayment: Payment = {
        id: `${gymId}_payment_${Date.now()}`,
        gym_id: gymId,
        member_id: memberId,
        member_name: newMember.name,
        amount: paymentAmount,
        date: conversionData.paymentDate,
        start_date: conversionData.planStartDate,
        plan: newMember.plan,
        method: conversionData.paymentMethod,
        card_brand:
          conversionData.paymentMethod === "Tarjeta de Crédito"
            ? conversionData.cardBrand
            : undefined,
        card_installments:
          conversionData.paymentMethod === "Tarjeta de Crédito"
            ? conversionData.cardInstallments
            : undefined,
        type: "plan",
        description: conversionData.description || undefined,
        plan_id: selectedPlan.id,
      };

      const { error: paymentError } = await supabase
        .from("payments")
        .insert([newPayment]);
      if (paymentError) throw paymentError;

      const { error: prospectDeleteError } = await supabase
        .from("prospects")
        .delete()
        .eq("id", convertingProspect.id)
        .eq("gym_id", gymId);
      if (prospectDeleteError) throw prospectDeleteError;

      setMembers((prevMembers) => [...prevMembers, newMember]);
      setPayments((prevPayments) => [...prevPayments, newPayment]);
      setProspects((prevProspects) =>
        prevProspects.filter((p) => p.id !== convertingProspect.id)
      );

      handleConvertDialogOpenChange(false);
      alert("Interesado convertido a socio exitosamente!");
    } catch (error) {
      console.error("Error convirtiendo interesado a miembro:", error);
      alert("Error al convertir el interesado a socio. Inténtalo de nuevo.");
    }
  };

  const getStatusBadge = (status: Prospect["status"]) => {
    switch (status) {
      case "averiguador":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-500 text-white">
            Averiguador
          </Badge>
        );
      case "trial_scheduled":
        return (
          <Badge variant="outline" className="border-cyan-500 text-cyan-500">
            Coordinamos clase de prueba
          </Badge>
        );
      case "reagendado":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            Re/Agendado
          </Badge>
        );
      case "asistio":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
            Asistio
          </Badge>
        );
      case "no_asistio":
        return <Badge variant="destructive">No asistio</Badge>;
      case "inactivo":
        return (
          <Badge variant="outline" className="border-slate-500 text-slate-500">
            Inactivo
          </Badge>
        );
      case "otro":
        return <Badge variant="secondary">Otro</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  // Nueva función para obtener el badge de prioridad
  const getPriorityBadge = (priority: Prospect["priority_level"]) => {
    switch (priority) {
      case "red":
        return (
          <Badge className="bg-green-500 hover:bg-green-500 text-white">
            Alta
          </Badge>
        );
      case "yellow":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black">
            Media
          </Badge>
        );
      case "green":
        return (
          <Badge className="bg-gray-400 hover:bg-gray-400 text-white">
            Baja
          </Badge>
        );
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Interesados
          </h2>
          <p className="text-muted-foreground">
            Administra los prospectos y conviértelos en socios.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Interesado
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Interesado</DialogTitle>
              <DialogDescription>
                Registra los datos de un nuevo prospecto.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  value={newProspect.name}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, name: e.target.value })
                  }
                  placeholder="Ana García"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newProspect.email}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, email: e.target.value })
                  }
                  placeholder="ana@email.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newProspect.phone}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, phone: e.target.value })
                  }
                  placeholder="098765432"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_date">Fecha de Contacto</Label>
                <Input
                  id="contact_date"
                  type="date"
                  value={newProspect.contact_date}
                  onChange={(e) =>
                    setNewProspect({
                      ...newProspect,
                      contact_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interest">Interés</Label>
                <Input
                  id="interest"
                  value={newProspect.interest}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, interest: e.target.value })
                  }
                  placeholder="Clases de spinning, Musculación"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={newProspect.status}
                  onValueChange={(value: Prospect["status"]) =>
                    setNewProspect({ ...newProspect, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="averiguador">Averiguador</SelectItem>
                    <SelectItem value="trial_scheduled">
                      Coordinamos clase de prueba
                    </SelectItem>
                    <SelectItem value="reagendado">Re/Agendado</SelectItem>
                    <SelectItem value="asistio">Asistio</SelectItem>
                    <SelectItem value="no_asistio">No asistio</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduled_date">Fecha agendada</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={newProspect.scheduled_date}
                  onChange={(e) =>
                    setNewProspect({
                      ...newProspect,
                      scheduled_date: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Fecha prevista para la clase de prueba (opcional).
                </p>
              </div>
              {/* Nuevo campo para la prioridad */}
              <div className="grid gap-2">
                <Label htmlFor="priority_level">Prioridad</Label>
                <Select
                  value={newProspect.priority_level}
                  onValueChange={(value: "green" | "yellow" | "red") =>
                    setNewProspect({ ...newProspect, priority_level: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Alta</SelectItem>
                    <SelectItem value="yellow">Media</SelectItem>
                    <SelectItem value="green">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={newProspect.notes}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, notes: e.target.value })
                  }
                  placeholder="Notas adicionales sobre el interesado..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddProspect}>
                Agregar Interesado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1 sm:flex-[1.5]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="averiguador">Averiguador</SelectItem>
                <SelectItem value="trial_scheduled">
                  Coordinamos clase de prueba
                </SelectItem>
                <SelectItem value="reagendado">Re/Agendado</SelectItem>
                <SelectItem value="asistio">Asistio</SelectItem>
                <SelectItem value="no_asistio">No asistio</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
            {/* Nuevo filtro por prioridad */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tipo Prioridad</SelectItem>
                <SelectItem value="red">Alta</SelectItem>
                <SelectItem value="yellow">Media</SelectItem>
                <SelectItem value="green">Baja</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex w-full min-w-[200px] flex-col gap-2 sm:w-[220px]">
              <Label
                htmlFor="scheduled-date-filter"
                className="text-sm font-medium"
              >
                Fecha agendada
              </Label>
              <Input
                id="scheduled-date-filter"
                type="date"
                value={scheduledDateFilter}
                onChange={(event) => setScheduledDateFilter(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setScheduledDateFilter(
                      new Date().toISOString().split("T")[0]
                    )
                  }
                >
                  Hoy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setScheduledDateFilter("")}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Prospects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Interesados ({sortedProspects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Fecha Contacto</TableHead>
                  <TableHead>Interés</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha agendada</TableHead>
                  <TableHead>Prioridad</TableHead>
                  {/* Nueva columna en la tabla */}
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProspects.map((prospect) => {
                  const scheduledDate = formatDate(prospect.scheduled_date);
                  return (
                    <TableRow key={prospect.id}>
                      <TableCell className="font-medium">
                        {prospect.name}
                      </TableCell>
                      <TableCell>{prospect.email}</TableCell>
                      <TableCell>{prospect.phone}</TableCell>
                      <TableCell>
                        {new Date(prospect.contact_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {prospect.interest}
                      </TableCell>
                      <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                      <TableCell>
                        {scheduledDate ? (
                          <Badge
                            variant="outline"
                            className="border-cyan-500 text-cyan-600"
                          >
                            {scheduledDate}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin coordinar
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(prospect.priority_level)}
                      </TableCell>
                      {/* Mostrar prioridad */}
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openHistoryDialog(prospect)}
                            title="Ver historial"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOriginalProspect({ ...prospect });
                              setEditingProspect({ ...prospect });
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startConversion(prospect)}
                            title="Convertir a Socio"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProspect(prospect.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogOpenChange}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Interesado</DialogTitle>
            <DialogDescription>
              Modifica los datos del interesado.
            </DialogDescription>
          </DialogHeader>

          {editingProspect && (
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre completo</Label>
                <Input
                  id="edit-name"
                  value={editingProspect.name}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingProspect.email || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      email: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={editingProspect.phone || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      phone: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-contact_date">Fecha de Contacto</Label>
                <Input
                  id="edit-contact_date"
                  type="date"
                  value={editingProspect.contact_date}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      contact_date: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-interest">Interés</Label>
                <Input
                  id="edit-interest"
                  value={editingProspect.interest || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      interest: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-status">Estado</Label>
                <Select
                  value={editingProspect.status}
                  onValueChange={(value: Prospect["status"]) =>
                    setEditingProspect({ ...editingProspect, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="averiguador">Averiguador</SelectItem>
                    <SelectItem value="trial_scheduled">
                      Coordinamos clase de prueba
                    </SelectItem>
                    <SelectItem value="reagendado">Re/Agendado</SelectItem>
                    <SelectItem value="asistio">Asistio</SelectItem>
                    <SelectItem value="no_asistio">No asistio</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-scheduled_date">Fecha agendada</Label>
                <Input
                  id="edit-scheduled_date"
                  type="date"
                  value={editingProspect.scheduled_date ?? ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      scheduled_date: e.target.value ? e.target.value : null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Fecha coordinada para la clase de prueba (opcional).
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-priority_level">Prioridad</Label>
                <Select
                  value={editingProspect.priority_level}
                  onValueChange={(value: "green" | "yellow" | "red") =>
                    setEditingProspect({
                      ...editingProspect,
                      priority_level: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Alta</SelectItem>
                    <SelectItem value="yellow">Media</SelectItem>
                    <SelectItem value="green">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notas</Label>
                <Textarea
                  id="edit-notes"
                  value={editingProspect.notes || ""}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      notes: e.target.value,
                    })
                  }
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" onClick={handleEditProspect}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Convert to Member Dialog */}
      {isClient && (
        <Dialog
          open={isConvertDialogOpen}
          onOpenChange={handleConvertDialogOpenChange}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Convertir a Socio</DialogTitle>
              <DialogDescription>
                Convierte a {convertingProspect?.name} en un nuevo socio.
              </DialogDescription>
            </DialogHeader>
            {convertingProspect && (
              <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto">
                <div className="grid gap-2">
                  <Label htmlFor="convert-plan-start">
                    Fecha de inicio del plan
                  </Label>
                  <Input
                    id="convert-plan-start"
                    type="date"
                    value={conversionData.planStartDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConversionData((prev) => {
                        const plan = plans.find((p) => p.name === prev.plan);
                        const computedNext = calculatePlanEndDate(
                          value,
                          plan
                        );
                        return {
                          ...prev,
                          planStartDate: value,
                          nextInstallmentDue:
                            prev.installments === 1
                              ? computedNext
                              : prev.nextInstallmentDue || computedNext,
                        };
                      });
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="convert-payment-date">Fecha de pago</Label>
                  <Input
                    id="convert-payment-date"
                    type="date"
                    value={conversionData.paymentDate}
                    onChange={(e) =>
                      setConversionData((prev) => ({
                        ...prev,
                        paymentDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="convert-plan">Plan</Label>
                  <Select
                    value={conversionData.plan}
                    onValueChange={(value) => {
                      const selectedPlan = plans.find(
                        (plan) => plan.name === value
                      );
                      const computedNext = calculatePlanEndDate(
                        conversionData.planStartDate,
                        selectedPlan
                      );
                      setConversionData((prev) => ({
                        ...prev,
                        plan: value,
                        planPrice: selectedPlan?.price || 0,
                        installments: 1,
                        paymentAmount: selectedPlan?.price || 0,
                        nextInstallmentDue: computedNext,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {(plans ?? [])
                        .filter((plan) => plan.is_active)
                        .map((plan) => (
                          <SelectItem key={plan.id} value={plan.name}>
                            {plan.name} - ${plan.price.toLocaleString()} (
                            {plan.duration} {plan.duration_type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {conversionData.plan && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="convert-plan-price">
                        Precio total del plan
                      </Label>
                      <Input
                        id="convert-plan-price"
                        type="number"
                        value={conversionData.planPrice}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0;
                          setConversionData((prev) => ({
                            ...prev,
                            planPrice: price,
                            paymentAmount:
                              prev.installments === 1
                                ? price
                                : prev.paymentAmount,
                          }));
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="convert-installments">
                        Cantidad de cuotas
                      </Label>
                      <Select
                        value={conversionData.installments.toString()}
                        onValueChange={(value) => {
                          const installments = parseInt(value);
                          setConversionData((prev) => {
                            const plan = plans.find(
                              (p) => p.name === prev.plan
                            );
                            const computedNext = calculatePlanEndDate(
                              prev.planStartDate,
                              plan
                            );
                            return {
                              ...prev,
                              installments,
                              paymentAmount:
                                installments === 1 ? prev.planPrice : 0,
                              nextInstallmentDue:
                                installments === 1
                                  ? computedNext
                                  : prev.nextInstallmentDue || computedNext,
                            };
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona cuotas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {conversionData.installments > 1 && (
                      <div className="grid gap-2">
                        <Label htmlFor="convert-payment-amount">
                          Monto a abonar
                        </Label>
                        <Input
                          id="convert-payment-amount"
                          type="number"
                          value={conversionData.paymentAmount}
                          onChange={(e) =>
                            setConversionData((prev) => ({
                              ...prev,
                              paymentAmount: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Saldo pendiente: $
                          {(
                            conversionData.planPrice -
                            conversionData.paymentAmount
                          ).toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="convert-next-installment">
                        Vencimiento próxima cuota
                      </Label>
                      <Input
                        id="convert-next-installment"
                        type="date"
                        value={conversionNextInstallmentValue}
                        onChange={(e) =>
                          setConversionData((prev) => ({
                            ...prev,
                            nextInstallmentDue: e.target.value,
                          }))
                        }
                        disabled={conversionData.installments === 1}
                      />
                      <p className="text-xs text-muted-foreground">
                        {conversionData.installments === 1
                          ? "Se utilizará la misma fecha que el fin del plan."
                          : "Registra cuándo vence la próxima cuota del socio."}
                      </p>
                    </div>
                  </>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="convert-method">Método de Pago</Label>
                  <Select
                    value={conversionData.paymentMethod}
                    onValueChange={(value) =>
                      setConversionData((prev) => ({
                        ...prev,
                        paymentMethod: value,
                        cardBrand: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {conversionData.paymentMethod === "Tarjeta de Crédito" && (
                  <>
                    <div className="grid gap-2">
                      <Label>Tipo de Tarjeta</Label>
                      <Select
                        value={conversionData.cardBrand}
                        onValueChange={(value) =>
                          setConversionData((prev) => ({
                            ...prev,
                            cardBrand: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tarjeta" />
                        </SelectTrigger>
                        <SelectContent>
                          {cardBrands.map((brand) => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="convert-card-installments">
                        Número de cuotas en la tarjeta
                      </Label>
                      <Input
                        id="convert-card-installments"
                        type="number"
                        min={1}
                        value={conversionData.cardInstallments}
                        onChange={(e) =>
                          setConversionData((prev) => ({
                            ...prev,
                            cardInstallments: parseInt(e.target.value) || 1,
                          }))
                        }
                      />
                    </div>
                  </>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="convert-description">Descripción</Label>
                  <Input
                    id="convert-description"
                    value={conversionData.description}
                    onChange={(e) =>
                      setConversionData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Se creará un nuevo socio y un pago inicial, y el interesado
                  será eliminado.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleConvertProspectToMember}
                disabled={
                  !conversionData.plan ||
                  (conversionData.paymentMethod === "Tarjeta de Crédito" &&
                    !conversionData.cardBrand)
                }
              >
                Convertir a Socio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

       <Dialog
        open={isHistoryDialogOpen}
        onOpenChange={handleHistoryDialogOpenChange}
      >
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Historial de {selectedHistoryProspect?.name ?? "interesado"}
            </DialogTitle>
            <DialogDescription>
              Revisa y registra comunicaciones o cambios importantes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-hidden">
            {selectedHistoryProspect && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Estado actual:</span>
                  {getStatusBadge(selectedHistoryProspect.status)}
                </div>
                {selectedHistoryProspect.priority_level && (
                  <div className="flex items-center gap-2">
                    <span>Prioridad:</span>
                    {getPriorityBadge(selectedHistoryProspect.priority_level)}
                  </div>
                )}
              </div>
            )}

            {historyTableError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {historyTableError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1">
              {selectedProspectHistories.length > 0 ? (
                <div className="space-y-3">
                  {selectedProspectHistories.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border bg-card p-3 text-sm shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {getActionLabel(entry.action_type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatHistoryDate(entry.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.new_status && (
                            <Badge variant="outline">
                              {getStatusLabel(entry.new_status)}
                            </Badge>
                          )}
                          {entry.manual_entry && (
                            <Badge variant="secondary">Manual</Badge>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 font-medium">{entry.summary}</p>
                      {entry.detail && (
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {entry.detail}
                        </p>
                      )}
                      {(entry.previous_status ||
                        entry.previous_scheduled_date ||
                        entry.new_scheduled_date) && (
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {entry.previous_status && (
                            <p>
                              Estado anterior: {getStatusLabel(entry.previous_status)}
                            </p>
                          )}
                          {entry.previous_scheduled_date && (
                            <p>
                              Fecha previa: {" "}
                              {formatScheduledDateTime(
                                entry.previous_scheduled_date
                              ) ?? entry.previous_scheduled_date}
                            </p>
                          )}
                          {entry.new_scheduled_date && (
                            <p>
                              Nueva fecha: {" "}
                              {formatScheduledDateTime(entry.new_scheduled_date) ??
                                entry.new_scheduled_date}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aún no hay registros asociados a este interesado. Cada cambio
                  de estado, agenda o nota generará una entrada automática. También
                  podés crear registros manuales utilizando el formulario de abajo.
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <h4 className="text-sm font-semibold">Agregar nuevo registro</h4>
              <div className="grid gap-2">
                <Label htmlFor="history-action">Tipo</Label>
                <Select
                  value={historyForm.actionType}
                  onValueChange={(value) =>
                    setHistoryForm((prev) => ({ ...prev, actionType: value }))
                  }
                >
                  <SelectTrigger id="history-action">
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {historyActionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="history-summary">Título o resumen</Label>
                <Input
                  id="history-summary"
                  value={historyForm.summary}
                  onChange={(e) =>
                    setHistoryForm((prev) => ({
                      ...prev,
                      summary: e.target.value,
                    }))
                  }
                  placeholder="Ej: Llamada de seguimiento"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="history-detail">Detalle</Label>
                <Textarea
                  id="history-detail"
                  value={historyForm.detail}
                  onChange={(e) =>
                    setHistoryForm((prev) => ({
                      ...prev,
                      detail: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Describe qué se habló o qué acción se realizó."
                />
              </div>
              <Button onClick={handleSaveHistoryEntry} disabled={historySaving}>
                {historySaving ? "Guardando..." : "Agregar registro"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
       {isClient && upcomingTrialReminders.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
          {upcomingTrialReminders.map((prospect) => {
            const reminderKey = getReminderKey(prospect);
            const scheduledLabel = formatScheduledDateTime(
              prospect.scheduled_date
            );

            return (
              <div
                key={reminderKey}
                className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-lg"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <div className="flex-1">
                  <p className="font-semibold">
                    Mandar recordatorio a {prospect.name}
                  </p>
                  {scheduledLabel ? (
                    <p className="text-xs text-green-700">
                      Clase agendada: {scheduledLabel}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDismissReminder(reminderKey)}
                  className="ml-2 text-green-600 transition hover:text-green-800"
                  aria-label={`Cerrar recordatorio para ${prospect.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
