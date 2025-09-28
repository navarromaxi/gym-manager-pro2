"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Prospect, Member, Payment, Plan } from "@/lib/supabase";
import { mapProspectStatusToDb } from "@/lib/prospect-status";
import { detectContractTable } from "@/lib/contract-table";
import type { ContractTableName } from "@/lib/contract-table";

interface ProspectManagementProps {
  prospects: Prospect[];
  setProspects: (updater: (prev: Prospect[]) => Prospect[]) => void;
  members: Member[];
  setMembers: (updater: (prev: Member[]) => Member[]) => void;
  payments: Payment[];
  setPayments: (updater: (prev: Payment[]) => Payment[]) => void;
  plans: Plan[];
  gymId: string;
  serverPaging?: boolean;
  hasMoreOnServer?: boolean;
  onLoadMoreFromServer?: () => void;
  loadingMoreFromServer?: boolean;
  totalProspectsCount?: number;
  onProspectAdded?: () => void;
  onProspectRemoved?: () => void;
  externalStatusFilter?: Prospect["status"] | "all" | null;
  onExternalStatusFilterApplied?: () => void;
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
  referralSource: string;
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

const PROSPECTS_PER_BATCH = 10;

type ParsedDateParts = {
  day: number;
  month: number;
  year?: number;
};

const isValidDayMonth = (day: number, month: number) => {
  if (!Number.isInteger(day) || !Number.isInteger(month)) {
    return false;
  }

  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
};

const normalizeTwoDigitYear = (year: number) => {
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const pivot = (currentYear % 100) + 20;

  if (year >= pivot % 100) {
    return currentCentury - 100 + year;
  }

  return currentCentury + year;
};

const parseDateParts = (value?: string | null): ParsedDateParts | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const primaryPart = trimmed.replace("T", " ").split(" ")[0];

  const isoMatch = primaryPart.match(/^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    if (!isValidDayMonth(dayNumber, monthNumber)) return null;
    return {
      year: Number(year),
      month: monthNumber,
      day: dayNumber,
    };
  }

  const isoSlashMatch = primaryPart.match(
    /^([0-9]{4})\/([0-9]{1,2})\/([0-9]{1,2})$/
  );
  if (isoSlashMatch) {
    const [, year, month, day] = isoSlashMatch;
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    if (!isValidDayMonth(dayNumber, monthNumber)) return null;
    return {
      year: Number(year),
      month: monthNumber,
      day: dayNumber,
    };
  }

  const dayFirstSlashMatch = primaryPart.match(
    /^([0-9]{1,2})\/([0-9]{1,2})(?:\/([0-9]{2,4}))?$/
  );
  if (dayFirstSlashMatch) {
    const [, day, month, year] = dayFirstSlashMatch;
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    if (!isValidDayMonth(dayNumber, monthNumber)) return null;
    const parsedYear =
      year && year.length === 2
        ? normalizeTwoDigitYear(Number(year))
        : year
        ? Number(year)
        : undefined;
    return {
      year: parsedYear,
      month: monthNumber,
      day: dayNumber,
    };
  }

  const dayFirstDashMatch = primaryPart.match(
    /^([0-9]{1,2})-([0-9]{1,2})(?:-([0-9]{2,4}))?$/
  );
  if (dayFirstDashMatch) {
    const [, day, month, year] = dayFirstDashMatch;
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    if (!isValidDayMonth(dayNumber, monthNumber)) return null;
    const parsedYear =
      year && year.length === 2
        ? normalizeTwoDigitYear(Number(year))
        : year
        ? Number(year)
        : undefined;
    return {
      year: parsedYear,
      month: monthNumber,
      day: dayNumber,
    };
  }

  const compactIsoMatch = primaryPart.match(/^([0-9]{4})([0-9]{2})([0-9]{2})$/);
  if (compactIsoMatch) {
    const [, year, month, day] = compactIsoMatch;
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    if (!isValidDayMonth(dayNumber, monthNumber)) return null;
    return {
      year: Number(year),
      month: monthNumber,
      day: dayNumber,
    };
  }

  const parsedDate = new Date(primaryPart);
  if (!Number.isNaN(parsedDate.getTime())) {
    return {
      year: parsedDate.getFullYear(),
      month: parsedDate.getMonth() + 1,
      day: parsedDate.getDate(),
    };
  }

  return null;
};

const areDatesEquivalent = (
  candidate?: string | null,
  filterValue?: string | null
) => {
  if (!filterValue) return true;

  const filterParts = parseDateParts(filterValue);
  if (!filterParts) return true;

  const candidateParts = parseDateParts(candidate);
  if (!candidateParts) return false;

  const sameDay = candidateParts.day === filterParts.day;
  const sameMonth = candidateParts.month === filterParts.month;

  if (!sameDay || !sameMonth) {
    return false;
  }

  if (typeof filterParts.year !== "number") {
    return true;
  }

  if (typeof candidateParts.year !== "number") {
    return true;
  }

  return candidateParts.year === filterParts.year;
};

const createDateFromParts = (parts?: ParsedDateParts | null) => {
  if (!parts) return null;
  if (typeof parts.year !== "number") return null;

  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
};

const isWithinContactDateRange = (
  candidate?: string | null,
  range?: string | null
) => {
  if (!range || range === "all-history") {
    return true;
  }

  const candidateDate = createDateFromParts(parseDateParts(candidate));
  if (!candidateDate) {
    return false;
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  switch (range) {
    case "current-month": {
      return (
        candidateDate.getFullYear() === today.getFullYear() &&
        candidateDate.getMonth() === today.getMonth()
      );
    }
    case "previous-month": {
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return (
        candidateDate.getFullYear() === previousMonth.getFullYear() &&
        candidateDate.getMonth() === previousMonth.getMonth()
      );
    }
    case "last-3-months": {
      const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return candidateDate >= startDate && candidateDate <= startOfToday;
    }
    case "last-6-months": {
      const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return candidateDate >= startDate && candidateDate <= startOfToday;
    }
    case "current-year": {
      const startDate = new Date(today.getFullYear(), 0, 1);
      return candidateDate >= startDate && candidateDate <= startOfToday;
    }
    case "previous-year": {
      const startDate = new Date(today.getFullYear() - 1, 0, 1);
      const endDate = new Date(today.getFullYear() - 1, 11, 31);
      endDate.setHours(23, 59, 59, 999);
      return candidateDate >= startDate && candidateDate <= endDate;
    }
    default:
      return true;
  }
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
  serverPaging = false,
  hasMoreOnServer = false,
  onLoadMoreFromServer,
  loadingMoreFromServer = false,
  totalProspectsCount,
  onProspectAdded,
  onProspectRemoved,
  externalStatusFilter,
  onExternalStatusFilterApplied,
}: ProspectManagementProps) {
  const PROSPECT_CONVERSION_REFERRAL = "prospect_conversion";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [convertingProspect, setConvertingProspect] = useState<Prospect | null>(
    null
  );
  const editNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    Prospect["status"] | "all"
  >("all");
  const [priorityFilter, setPriorityFilter] = useState("all"); // Nuevo estado para el filtro de prioridad
  const [scheduledDateFilter, setScheduledDateFilter] = useState(""); // estado para el filtro de fecha
   const [nextContactDateFilter, setNextContactDateFilter] = useState("");
  const [contactDateFilter, setContactDateFilter] = useState("");
  const [contactDateRangeFilter, setContactDateRangeFilter] =
    useState("all-history");
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
    next_contact_date: "",
  });

  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
  ];

  const referralSources = [
    { value: "none", label: "Sin seleccionar" },
    { value: "Facebook", label: "Facebook" },
    { value: "Instagram", label: "Instagram" },
    { value: "Referido", label: "Referido" },
    { value: "Pase por el club", label: "Pase por el club" },
    { value: "Whatssap", label: "Whatssap" },
    { value: "Otro", label: "Otro" },
  ];

  const cardBrands = [
    "VISA",
    "OCA",
    "MASTER",
    "CABAL",
    "AMEX",
    "TARJETA D",
    "MERCADO PAGO",
  ];
   useEffect(() => {
    if (typeof externalStatusFilter === "undefined") {
      return;
    }

    if (externalStatusFilter === null) {
      return;
    }

    setStatusFilter(externalStatusFilter);
    onExternalStatusFilterApplied?.();
  }, [externalStatusFilter, onExternalStatusFilterApplied]);
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
      referralSource: "",
      nextInstallmentDue: today,
    };
  };
  const [conversionData, setConversionData] = useState<ConversionData>(
    getInitialConversionData
  );
  const [contractTable, setContractTable] = useState<ContractTableName | null>(
    null
  );

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
  const [visibleCount, setVisibleCount] = useState(PROSPECTS_PER_BATCH);

  useEffect(() => {
    if (!isEditDialogOpen) return;
    const textarea = editNotesRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [isEditDialogOpen, editingProspect?.notes]);

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
        const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
          2,
          "0"
        )}${time ? `T${time}` : "T00:00"}:00`;
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

   const getScheduledReminderKey = (prospect: Prospect) =>
    `scheduled:${prospect.id}:${prospect.scheduled_date ?? ""}`;

  const getNextContactReminderKey = (prospect: Prospect) =>
    `next-contact:${prospect.id}:${prospect.next_contact_date ?? ""}`;

  const handleDismissReminder = (key: string) => {
    setDismissedReminders((prev) =>
      prev.includes(key) ? prev : [...prev, key]
    );
  };

  useEffect(() => {
    const checkTable = async () => {
      const table = await detectContractTable();
      setContractTable(table);
    };

    checkTable();
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

      const reminderKey = getScheduledReminderKey(prospect);
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

  const upcomingNextContactReminders = (() => {
    if (!isClient) return [] as Prospect[];

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prospects.filter((prospect) => {
      if (!prospect.next_contact_date) {
        return false;
      }

      const reminderKey = getNextContactReminderKey(prospect);
      if (dismissedReminders.includes(reminderKey)) {
        return false;
      }

      const nextContact = parseScheduledDate(prospect.next_contact_date);
      if (!nextContact) {
        return false;
      }

      const normalized = new Date(nextContact);
      normalized.setHours(0, 0, 0, 0);

      return normalized.getTime() === tomorrow.getTime();
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
    const matchesContactDate = areDatesEquivalent(
      prospect.contact_date,
      contactDateFilter
    );
    const matchesContactDateRange = isWithinContactDateRange(
      prospect.contact_date,
      contactDateRangeFilter
    );
    const matchesScheduledDate = areDatesEquivalent(
      prospect.scheduled_date,
      scheduledDateFilter
    );

    const matchesNextContactDate = areDatesEquivalent(
      prospect.next_contact_date,
      nextContactDateFilter
    );
    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesScheduledDate &&
      matchesNextContactDate &&
      matchesContactDate &&
      matchesContactDateRange
    );
  });

  useEffect(() => {
    if (serverPaging) return;
    setVisibleCount(PROSPECTS_PER_BATCH);
  }, [
    searchTerm,
    statusFilter,
    priorityFilter,
    scheduledDateFilter,
    nextContactDateFilter,
    contactDateFilter,
    contactDateRangeFilter,
    serverPaging,
  ]);

  const sortedProspects = [...filteredProspects].sort((a, b) => {
    const dateA = new Date(`${a.contact_date}T00:00:00`).getTime();
    const dateB = new Date(`${b.contact_date}T00:00:00`).getTime();
    return dateB - dateA;
  });

  const totalFiltered = sortedProspects.length;
  const currentVisibleCount = serverPaging
    ? totalFiltered
    : Math.min(visibleCount, totalFiltered);
  const displayedProspects = sortedProspects.slice(0, currentVisibleCount);
  const canLoadMoreLocal = !serverPaging && currentVisibleCount < totalFiltered;

  const handleLoadMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + PROSPECTS_PER_BATCH, sortedProspects.length)
    );
  };

   const totalLabel =
    serverPaging && typeof totalProspectsCount === "number"
      ? totalProspectsCount
      : totalFiltered;

  const showLoadMoreButton = serverPaging
    ? hasMoreOnServer || loadingMoreFromServer
    : canLoadMoreLocal;

  const loadMoreDisabled =
    serverPaging && (loadingMoreFromServer || !onLoadMoreFromServer);

  const handleLoadMoreClick = () => {
    if (loadMoreDisabled) return;
    if (serverPaging) {
      onLoadMoreFromServer?.();
    } else {
      handleLoadMore();
    }
  };

  const handleAddProspect = async () => {
    try {
      const prospectId = `${gymId}_prospect_${Date.now()}`;

      const scheduledDateValue = newProspect.scheduled_date
        ? newProspect.scheduled_date
        : null;
      const nextContactDateValue = newProspect.next_contact_date
        ? newProspect.next_contact_date
        : null;

      const { error } = await supabase.from("prospects").insert([
        {
          id: prospectId,
          gym_id: gymId,
          name: newProspect.name,
          email: newProspect.email,
          phone: newProspect.phone,
          contact_date: newProspect.contact_date,
          interest: newProspect.interest,
          status: mapProspectStatusToDb(newProspect.status),
          notes: newProspect.notes,
          priority_level: newProspect.priority_level,
          scheduled_date: scheduledDateValue,
          next_contact_date: nextContactDateValue,
        },
      ]);

      if (error) throw error;

      const addedProspect: Prospect = {
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
        scheduled_date: scheduledDateValue,
        next_contact_date: nextContactDateValue,
      };

      setProspects((prev) => [...prev, addedProspect]);
      onProspectAdded?.();
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
        next_contact_date: "",
      });
      setIsAddDialogOpen(false);
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
          status: mapProspectStatusToDb(editingProspect.status),
          notes: editingProspect.notes,
          priority_level: editingProspect.priority_level, // Incluir el nuevo campo
          scheduled_date: editingProspect.scheduled_date || null,
          next_contact_date: editingProspect.next_contact_date || null,
        })
        .eq("id", editingProspect.id)
        .eq("gym_id", gymId);

      if (error) throw error;

      setProspects((prev) =>
        prev.map((p) => (p.id === editingProspect.id ? editingProspect : p))
      );
      setIsEditDialogOpen(false);
      setEditingProspect(null);
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
      onProspectRemoved?.();
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
      const referralSourceValue = conversionData.referralSource
        ? `prospect:${conversionData.referralSource}`
        : PROSPECT_CONVERSION_REFERRAL;

      const newMember: Member = {
        id: memberId,
        gym_id: gymId,
        name: convertingProspect.name,
        email: convertingProspect.email || "",
        phone: convertingProspect.phone || "",
        referral_source: referralSourceValue,
        join_date: conversionData.paymentDate,
        plan: selectedPlan.name,
        plan_price: conversionData.planPrice,
        description: conversionData.description.trim() || null,
        last_payment: conversionData.planStartDate,
        next_payment: nextPaymentISO,
        next_installment_due: nextInstallmentDue,
        status: memberStatus,
        inactive_level: inactiveLevel,
        balance_due: conversionData.planPrice - paymentAmount,
        followed_up: false,
      };

      const { description: _memberDescription, ...memberInsert } = newMember;
      const { error: memberError } = await supabase
        .from("members")
        .insert([memberInsert]);
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
      
      const planName = selectedPlan?.name || conversionData.plan || "";
      const paymentDescription =
        conversionData.description.trim() ||
        (planName ? `Pago de plan ${planName}` : "Pago de plan");

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
        card_brand: ["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
          conversionData.paymentMethod
        )
          ? conversionData.cardBrand
          : undefined,
        card_installments:
          conversionData.paymentMethod === "Tarjeta de Crédito"
            ? conversionData.cardInstallments
            : undefined,
        type: "plan",
        description: paymentDescription,
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
      onProspectRemoved?.();

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
              <div className="grid gap-2">
                <Label htmlFor="next_contact_date">
                  Fecha de nuevo contacto
                </Label>
                <Input
                  id="next_contact_date"
                  type="date"
                  value={newProspect.next_contact_date}
                  onChange={(e) =>
                    setNewProspect({
                      ...newProspect,
                      next_contact_date: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Define cuándo debes volver a contactar al interesado.
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
          <div className="flex w-full flex-wrap items-end gap-4">
            <div className="space-y-2 md:col-span-2 xl:col-span-2">
              <Label
                htmlFor="prospect-search"
                className="text-sm font-medium text-muted-foreground"
              >
                Buscar
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="prospect-search"
                  placeholder="Buscar por nombre, email o notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="status-filter"
                className="text-sm font-medium text-muted-foreground"
              >
                Estado
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as Prospect["status"] | "all")
                }
              >
                <SelectTrigger id="status-filter" className="w-full">
                  <SelectValue placeholder="Todos los estados" />
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
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="priority-filter"
                className="text-sm font-medium text-muted-foreground"
              >
                Prioridad
              </Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger id="priority-filter" className="w-full">
                  <SelectValue placeholder="Tipo prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tipo prioridad</SelectItem>
                  <SelectItem value="red">Alta</SelectItem>
                  <SelectItem value="yellow">Media</SelectItem>
                  <SelectItem value="green">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="scheduled-date-filter"
                className="text-sm font-medium text-muted-foreground"
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
                  size="sm"
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
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setScheduledDateFilter("")}
                >
                  Limpiar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="next-contact-date-filter"
                className="text-sm font-medium text-muted-foreground"
              >
                Próximo contacto
              </Label>
              <Input
                id="next-contact-date-filter"
                type="date"
                value={nextContactDateFilter}
                onChange={(event) =>
                  setNextContactDateFilter(event.target.value)
                }
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setNextContactDateFilter(
                      new Date().toISOString().split("T")[0]
                    )
                  }
                >
                  Hoy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setNextContactDateFilter("")}
                >
                  Limpiar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="contact-date-filter"
                className="text-sm font-medium text-muted-foreground"
              >
                Fecha de contacto
              </Label>
              <Input
                id="contact-date-filter"
                type="date"
                value={contactDateFilter}
                onChange={(event) => setContactDateFilter(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setContactDateFilter(new Date().toISOString().split("T")[0])
                  }
                >
                  Hoy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setContactDateFilter("")}
                >
                  Limpiar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="contact-date-range-filter"
                className="text-sm font-medium text-muted-foreground"
              >
                Rango temporal
              </Label>
              <Select
                value={contactDateRangeFilter}
                onValueChange={setContactDateRangeFilter}
              >
                <SelectTrigger
                  id="contact-date-range-filter"
                  className="w-full"
                >
                  <SelectValue placeholder="Rango temporal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">Este mes</SelectItem>
                  <SelectItem value="previous-month">Mes anterior</SelectItem>
                  <SelectItem value="last-3-months">Últimos 3 meses</SelectItem>
                  <SelectItem value="last-6-months">Últimos 6 meses</SelectItem>
                  <SelectItem value="current-year">Todo el año</SelectItem>
                  <SelectItem value="previous-year">Año anterior</SelectItem>
                  <SelectItem value="all-history">Todo el historial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Prospects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Interesados ({totalFiltered})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Fecha Contacto</TableHead>
                  <TableHead>Interés</TableHead>
                  <TableHead>Estado</TableHead>
                   <TableHead>Próximo contacto</TableHead>
                  <TableHead>Fecha agendada</TableHead>
                  <TableHead>Prioridad</TableHead>
                  {/* Nueva columna en la tabla */}
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedProspects.map((prospect) => {
                  const scheduledDate = formatDate(prospect.scheduled_date);
                  const nextContactDate = formatDate(
                    prospect.next_contact_date
                  );
                  return (
                    <TableRow key={prospect.id}>
                      <TableCell className="font-medium">
                        {prospect.name}
                      </TableCell>
                      <TableCell>{prospect.email}</TableCell>
                      <TableCell>{prospect.phone}</TableCell>
                      <TableCell>
                         {prospect.contact_date
                          ? new Date(
                              `${prospect.contact_date}T00:00:00`
                            ).toLocaleDateString()
                          : "-"}
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
                        {nextContactDate ? (
                          <Badge
                            variant="outline"
                            className="border-purple-400 text-purple-600"
                          >
                            {nextContactDate}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin definir
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
                            onClick={() => {
                              setEditingProspect(prospect);
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
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {displayedProspects.length > 0 && (
                <>
                  Mostrando <strong>{displayedProspects.length}</strong>
                  {totalLabel > displayedProspects.length && (
                    <>
                      {" "}de <strong>{totalLabel}</strong>
                    </>
                  )}{" "}
                  interesados{serverPaging ? "" : " cargados"}
                </>
              )}
            </div>
             {showLoadMoreButton && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMoreClick}
                  disabled={loadMoreDisabled}
                >
                  {serverPaging && loadingMoreFromServer
                    ? "Cargando..."
                    : "Cargar más interesados"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar Interesado</DialogTitle>
            <DialogDescription>
              Modifica los datos del interesado.
            </DialogDescription>
          </DialogHeader>

          {editingProspect && (
            <div className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
              <div className="grid gap-4 md:grid-cols-2">
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
                  <Label htmlFor="edit-next_contact_date">
                    Fecha de nuevo contacto
                  </Label>
                  <Input
                    id="edit-next_contact_date"
                    type="date"
                    value={editingProspect.next_contact_date ?? ""}
                    onChange={(e) =>
                      setEditingProspect({
                        ...editingProspect,
                        next_contact_date: e.target.value ? e.target.value : null,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Planifica cuándo volver a comunicarte con el interesado.
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
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="edit-notes">Notas</Label>
                  <Textarea
                    id="edit-notes"
                    ref={editNotesRef}
                    value={editingProspect.notes || ""}
                    onChange={(e) => {
                      const { value } = e.currentTarget;
                      setEditingProspect({
                        ...editingProspect,
                        notes: value,
                      });
                      e.currentTarget.style.height = "auto";
                      e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                    }}
                    className="min-h-[240px] resize-none overflow-hidden"
                  />
                </div>
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
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Convertir a Socio</DialogTitle>
              <DialogDescription>
                Convierte a {convertingProspect?.name} en un nuevo socio.
              </DialogDescription>
            </DialogHeader>
            {convertingProspect && (
              <div className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
                <div className="grid gap-4 md:grid-cols-2">
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
                          const computedNext = calculatePlanEndDate(value, plan);
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
                  <div className="grid gap-2 md:col-span-2">
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
                                  installments === 1
                                    ? prev.planPrice
                                    : prev.paymentAmount,
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
                                paymentAmount:
                                  parseFloat(e.target.value) || 0,
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
                      <div className="grid gap-2 md:col-span-2">
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
                  {["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
                    conversionData.paymentMethod
                  ) && (
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
                              cardInstallments:
                                parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                      </div>
                    </>
                  )}
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="convert-referral">¿Cómo nos conoció?</Label>
                    <Select
                      value={conversionData.referralSource || "none"}
                      onValueChange={(value) =>
                        setConversionData((prev) => ({
                          ...prev,
                          referralSource: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id="convert-referral">
                        <SelectValue placeholder="Sin seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {referralSources.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
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
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    Se creará un nuevo socio y un pago inicial, y el interesado
                    será eliminado.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleConvertProspectToMember}
                disabled={
                  !conversionData.plan ||
                  (["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
                    conversionData.paymentMethod
                  ) &&
                    !conversionData.cardBrand)
                }
              >
                Convertir a Socio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {isClient &&
        (upcomingNextContactReminders.length > 0 ||
          upcomingTrialReminders.length > 0) && (
        <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
           {upcomingNextContactReminders.map((prospect) => {
            const reminderKey = getNextContactReminderKey(prospect);
            const nextContactLabel = formatDate(prospect.next_contact_date);

            return (
              <div
                key={reminderKey}
                className="flex items-start gap-3 rounded-md border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800 shadow-lg"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                <div className="flex-1">
                  <p className="font-semibold">
                    Mañana debes contactar a {prospect.name}
                  </p>
                  {nextContactLabel ? (
                    <p className="text-xs text-purple-700">
                      Próximo contacto: {nextContactLabel}
                    </p>
                  ) : null}
                  {prospect.interest ? (
                    <p className="text-xs text-purple-700">
                      Interés: {prospect.interest}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDismissReminder(reminderKey)}
                  className="ml-2 text-purple-600 transition hover:text-purple-800"
                  aria-label={`Cerrar recordatorio para ${prospect.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {upcomingTrialReminders.map((prospect) => {
            const reminderKey = getScheduledReminderKey(prospect);
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
