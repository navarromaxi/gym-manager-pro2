"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, Member, CustomPlan, Payment } from "@/lib/supabase";
import {
  ensureCustomPlanMarker,
  stripCustomPlanMarker,
  isPaymentLinkedToCustomPlan,
} from "@/lib/custom-plan-payments";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  CalendarClock,
  Ban,
  PiggyBank,
  RefreshCcw,
  Pencil,
} from "lucide-react";

interface CustomPlanManagementProps {
  customPlans: CustomPlan[];
  setCustomPlans: (plans: CustomPlan[]) => void;
  members: Member[];
  payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  gymId: string;
}

type StatusFilter =
  | "all"
  | "active"
  | "expiring"
  | "expired"
  | "inactive"
  | "renewed";

type PlanFormState = {
  member_id: string;
  name: string;
  description: string;
  price: number;
  installments: number;
  payment_amount: number;
  next_installment_due: string;
  start_date: string;
  end_date: string;
  payment_date: string;
  payment_method: string;
  card_brand: string;
  card_installments: number;
  payment_description: string;
};

const PLANS_PER_BATCH = 10;

const createEmptyPlanForm = (): PlanFormState => ({
  member_id: "",
  name: "Personalizado",
  description: "",
  price: 0,
  installments: 1,
  payment_amount: 0,
  next_installment_due: new Date().toLocaleDateString("en-CA"),
  start_date: new Date().toLocaleDateString("en-CA"),
  end_date: "",
  payment_date: new Date().toLocaleDateString("en-CA"),
  payment_method: "",
  card_brand: "",
  card_installments: 1,
  payment_description: "",
});

export function CustomPlanManagement({
  customPlans,
  setCustomPlans,
  members,
  payments,
  setPayments,
  gymId,
}: CustomPlanManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [newPlan, setNewPlan] = useState<PlanFormState>(createEmptyPlanForm());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CustomPlan | null>(null);
  const [editPlanForm, setEditPlanForm] = useState<PlanFormState>(
    createEmptyPlanForm()
  );
  const [editMemberSearch, setEditMemberSearch] = useState("");
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [isRenewDialogOpen, setIsRenewDialogOpen] = useState(false);
  const [renewPlan, setRenewPlan] = useState<PlanFormState>(
    createEmptyPlanForm()
  );
  const [renewMemberSearch, setRenewMemberSearch] = useState("");
  const [visiblePlanCount, setVisiblePlanCount] = useState(PLANS_PER_BATCH);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const getDaysUntil = (plan: CustomPlan) => {
    const endDate = parseDate(plan.end_date);
    if (!endDate) return null;
    const diff = Math.ceil(
      (endDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  const isPlanExpired = (plan: CustomPlan) => {
    const days = getDaysUntil(plan);
    return days !== null && days < 0;
  };

  const isPlanExpiringSoon = (plan: CustomPlan) => {
    const days = getDaysUntil(plan);
    return days !== null && days >= 0 && days <= 7;
  };

  const formatDate = (value?: string | null) => {
    const parsedDate = parseDate(value);
    if (!parsedDate) return "Sin definir";
    return parsedDate.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const currencyFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const getPlanTimestamp = (plan: CustomPlan) => {
    const parts = plan.id.split("_");
    const maybeTimestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
    return Number.isNaN(maybeTimestamp) ? 0 : maybeTimestamp;
  };

  const latestPlanByMember = useMemo(() => {
    const map = new Map<string, CustomPlan>();

    const isFirstPlanPreferred = (
      candidate: CustomPlan,
      current: CustomPlan
    ) => {
      const candidateEnd = parseDate(candidate.end_date);
      const currentEnd = parseDate(current.end_date);

      if (candidateEnd && currentEnd) {
        if (candidateEnd.getTime() !== currentEnd.getTime()) {
          return candidateEnd.getTime() > currentEnd.getTime();
        }
      }

      if (candidateEnd && !currentEnd) return true;
      if (!candidateEnd && currentEnd) return false;

      return getPlanTimestamp(candidate) > getPlanTimestamp(current);
    };

    for (const plan of customPlans) {
      const stored = map.get(plan.member_id);
      if (!stored || isFirstPlanPreferred(plan, stored)) {
        map.set(plan.member_id, plan);
      }
    }

    return map;
  }, [customPlans]);

  const isPlanRenewed = (plan: CustomPlan) => {
    const latest = latestPlanByMember.get(plan.member_id);
    if (!latest) return false;
    if (latest.id === plan.id) return false;

    const latestEnd = parseDate(latest.end_date);
    const planEnd = parseDate(plan.end_date);

    if (latestEnd && planEnd) {
      if (latestEnd.getTime() > planEnd.getTime()) return true;
      if (latestEnd.getTime() < planEnd.getTime()) return false;
    }

    if (latestEnd && !planEnd) return true;
    if (!latestEnd && planEnd) return false;

    return getPlanTimestamp(latest) > getPlanTimestamp(plan);
  };

  const plansForStatus = customPlans.filter((plan) => !isPlanRenewed(plan));

  const totalPlans = customPlans.length;
  const activePlans = plansForStatus.filter(
    (plan) => plan.is_active && !isPlanExpired(plan)
  ).length;
  const expiringSoonCount = plansForStatus.filter(
    (plan) => plan.is_active && isPlanExpiringSoon(plan)
  ).length;
  const expiredPlans = plansForStatus.filter((plan) =>
    isPlanExpired(plan)
  ).length;
  const inactivePlans = plansForStatus.filter((plan) => !plan.is_active).length;
  const totalRevenue = customPlans.reduce(
    (sum, plan) => sum + (plan.price || 0),
    0
  );
  const formattedTotalRevenue = currencyFormatter.format(totalRevenue);

  const searchFilteredPlans = customPlans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.member_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPlans = searchFilteredPlans.filter((plan) => {
    if (statusFilter !== "all" && statusFilter !== "renewed") {
      if (isPlanRenewed(plan)) {
        return false;
      }
    }

    switch (statusFilter) {
      case "active":
        return plan.is_active && !isPlanExpired(plan);
      case "expiring":
        return plan.is_active && isPlanExpiringSoon(plan);
      case "expired":
        return isPlanExpired(plan);
      case "inactive":
        return !plan.is_active;
      case "renewed":
        return isPlanRenewed(plan);
      default:
        return true;
    }
  });

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    const dateA = parseDate(a.end_date);
    const dateB = parseDate(b.end_date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });

  useEffect(() => {
    setVisiblePlanCount(PLANS_PER_BATCH);
  }, [searchTerm, statusFilter, customPlans]);

  const visiblePlans = useMemo(() => {
    if (!sortedPlans.length) return [];
    const limit = Math.min(visiblePlanCount, sortedPlans.length);
    return sortedPlans.slice(0, limit);
  }, [sortedPlans, visiblePlanCount]);

  const canLoadMorePlans = visiblePlanCount < sortedPlans.length;

  const handleLoadMorePlans = () => {
    setVisiblePlanCount((prev) =>
      Math.min(prev + PLANS_PER_BATCH, sortedPlans.length)
    );
  };

  const filteredMembers = useMemo(() => {
    const normalizedSearch = memberSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return members;
    }
    return members.filter((m) =>
      m.name.toLowerCase().includes(normalizedSearch)
    );
  }, [memberSearch, members]);

  const handleMemberSearchChange = (value: string) => {
    setMemberSearch(value);
    if (value.trim().length === 0) {
      setNewPlan((prev) => ({ ...prev, member_id: "" }));
    }
  };

  const renewFilteredMembers = useMemo(() => {
    const normalizedSearch = renewMemberSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return members;
    }
    return members.filter((m) =>
      m.name.toLowerCase().includes(normalizedSearch)
    );
  }, [members, renewMemberSearch]);

  const handleRenewMemberSearchChange = (value: string) => {
    setRenewMemberSearch(value);
    if (value.trim().length === 0) {
      setRenewPlan((prev) => ({ ...prev, member_id: "" }));
    }
  };

  const editFilteredMembers = useMemo(() => {
    const normalizedSearch = editMemberSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return members;
    }
    return members.filter((m) =>
      m.name.toLowerCase().includes(normalizedSearch)
    );
  }, [editMemberSearch, members]);

  const handleEditMemberSearchChange = (value: string) => {
    setEditMemberSearch(value);
    if (value.trim().length === 0) {
      setEditPlanForm((prev) => ({ ...prev, member_id: "" }));
    }
  };

  const filterDescriptionMap: Record<StatusFilter, string> = {
    all: "Listado completo de planes personalizados.",
    active: "Planes activos con fecha vigente.",
    expiring: "Planes que vencen en los próximos 7 días.",
    expired: "Planes con fecha de finalización vencida.",
    inactive: "Planes marcados como inactivos.",
    renewed: "Planes que ya fueron renovados por uno más reciente.",
  };

  const filterDescription = filterDescriptionMap[statusFilter];
  const hasActiveFilters =
    statusFilter !== "all" || searchTerm.trim().length > 0;
  const showMemberResults = memberSearch.trim().length > 0;
  const showEditMemberResults = editMemberSearch.trim().length > 0;
  const showRenewMemberResults = renewMemberSearch.trim().length > 0;
  const resultsLabel =
    filteredPlans.length === 1 ? "1 plan" : `${filteredPlans.length} planes`;

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const renderStatusBadge = (plan: CustomPlan) => {
    if (isPlanRenewed(plan)) {
      return (
        <Badge className="border-transparent bg-sky-100 text-sky-700">
          Ya renovado
        </Badge>
      );
    }
    if (!plan.is_active) {
      return (
        <Badge className="border-transparent bg-slate-200 text-slate-700">
          Inactivo
        </Badge>
      );
    }

    if (isPlanExpired(plan)) {
      return (
        <Badge className="border-transparent bg-red-500/10 text-red-600">
          Vencido
        </Badge>
      );
    }

    if (isPlanExpiringSoon(plan)) {
      return (
        <Badge className="border-transparent bg-amber-100 text-amber-800">
          Próximo a vencer
        </Badge>
      );
    }

    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700">
        Activo
      </Badge>
    );
  };

  const renderTimeLeft = (plan: CustomPlan) => {
    if (isPlanRenewed(plan)) {
      return <span className="text-xs text-sky-700">Plan renovado</span>;
    }
    const days = getDaysUntil(plan);
    if (!plan.end_date) {
      return (
        <span className="text-xs text-muted-foreground">
          Sin fecha de finalización
        </span>
      );
    }

    if (days === null) {
      return (
        <span className="text-xs text-muted-foreground">
          Sin información disponible
        </span>
      );
    }

    if (days > 0) {
      return (
        <span className="text-xs text-emerald-600">
          Faltan {days} día{days === 1 ? "" : "s"}
        </span>
      );
    }

    if (days === 0) {
      return (
        <span className="text-xs font-medium text-amber-600">Vence hoy</span>
      );
    }

    return (
      <span className="text-xs text-red-600">
        Vencido hace {Math.abs(days)} día{Math.abs(days) === 1 ? "" : "s"}
      </span>
    );
  };

  const cardBrands = [
    "VISA",
    "OCA",
    "MASTER",
    "CABAL",
    "AMEX",
    "TARJETA D",
    "MERCADO PAGO",
  ];

  const handleAddPlan = async () => {
    const member = members.find((m) => m.id === newPlan.member_id);
    if (!member) return;

    const paymentAmount =
      newPlan.installments === 1 ? newPlan.price : newPlan.payment_amount;

    if (newPlan.installments > 1) {
      if (paymentAmount <= 0) {
        alert("El monto a abonar debe ser mayor a 0");
        return;
      }
      if (paymentAmount > newPlan.price) {
        alert("El monto a abonar no puede superar el precio del plan");
        return;
      }
      if (!newPlan.next_installment_due) {
        alert("Debes ingresar el vencimiento de la próxima cuota");
        return;
      }
    }

    const id = `${gymId}_custom_${Date.now()}`;
    const plan: CustomPlan = {
      id,
      gym_id: gymId,
      member_id: member.id,
      member_name: member.name,
      name: newPlan.name,
      description: newPlan.description,
      price: newPlan.price,
      start_date: newPlan.start_date,
      end_date: newPlan.end_date,
      is_active: true,
    };

    const { error } = await supabase.from("custom_plans").insert([plan]);
    if (error) {
      console.error("Error al guardar plan personalizado:", error);
      return;
    }

    const paymentId = `${gymId}_payment_${Date.now()}`;
    const baseDescription =
      newPlan.payment_description ||
      (newPlan.installments > 1
        ? `Pago en ${newPlan.installments} cuotas. Próximo vencimiento: ${newPlan.next_installment_due}`
        : "");
    const paymentDescription = ensureCustomPlanMarker(baseDescription, id);
    const payment: Payment = {
      id: paymentId,
      gym_id: gymId,
      member_id: member.id,
      member_name: member.name,
      amount: paymentAmount,
      date: newPlan.payment_date,
      start_date: newPlan.start_date,
      plan: newPlan.name,
      method: newPlan.payment_method || "Efectivo",
      card_brand: ["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
        newPlan.payment_method || ""
      )
        ? newPlan.card_brand
        : undefined,
      card_installments:
        newPlan.payment_method === "Tarjeta de Crédito"
          ? newPlan.card_installments
          : undefined,
      type: "custom_plan",
      description: paymentDescription,
    };

    const paymentRecord: Payment = {
      ...payment,
      type: "plan",
    };

    const { error: paymentError } = await supabase
      .from("payments")
      .insert([paymentRecord]);
    if (paymentError) {
      console.error("Error al registrar pago de personalizado:", paymentError);
    } else {
      setPayments([...payments, payment]);
    }

    setCustomPlans([...customPlans, plan]);
    setIsAddDialogOpen(false);
    setNewPlan(createEmptyPlanForm());
    setMemberSearch("");
  };

  const handleOpenEditDialog = (plan: CustomPlan) => {
    const member = members.find((m) => m.id === plan.member_id);
    const relatedPayments = payments
      .filter((payment) => isPaymentLinkedToCustomPlan(payment, plan.id))
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    const latestPayment = relatedPayments[0];

    const description = latestPayment?.description || "";
    const installmentsMatch = description.match(/Pago en (\d+) cuotas?/);
    const parsedInstallments = installmentsMatch
      ? Number.parseInt(installmentsMatch[1], 10)
      : 1;
    const nextDueMatch = description.match(
      /Próximo vencimiento: (\d{4}-\d{2}-\d{2})/
    );
    const parsedNextDue =
      nextDueMatch?.[1] ||
      plan.end_date ||
      new Date().toLocaleDateString("en-CA");

    setEditingPlan(plan);
    setEditPlanForm({
      member_id: plan.member_id,
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      installments: parsedInstallments,
      payment_amount: latestPayment?.amount ?? plan.price,
      next_installment_due: parsedNextDue,
      start_date: plan.start_date || new Date().toLocaleDateString("en-CA"),
      end_date: plan.end_date || "",
      payment_date:
        latestPayment?.date ||
        plan.start_date ||
        new Date().toLocaleDateString("en-CA"),
      payment_method: latestPayment?.method || "",
      card_brand: latestPayment?.card_brand || "",
      card_installments: latestPayment?.card_installments ?? 1,
      payment_description: stripCustomPlanMarker(latestPayment?.description),
    });
    setEditMemberSearch(member ? member.name : plan.member_name);
    setEditPaymentId(latestPayment?.id ?? null);
    setIsEditDialogOpen(true);
  };

  const resetEditState = () => {
    setIsEditDialogOpen(false);
    setEditingPlan(null);
    setEditPlanForm(createEmptyPlanForm());
    setEditMemberSearch("");
    setEditPaymentId(null);
  };

  const handleEditPlan = async () => {
    if (!editingPlan) return;

    const member = members.find((m) => m.id === editPlanForm.member_id);
    if (!member) return;

    const paymentAmount =
      editPlanForm.installments === 1
        ? editPlanForm.price
        : editPlanForm.payment_amount;

    if (editPlanForm.installments > 1) {
      if (paymentAmount <= 0) {
        alert("El monto a abonar debe ser mayor a 0");
        return;
      }
      if (paymentAmount > editPlanForm.price) {
        alert("El monto a abonar no puede superar el precio del plan");
        return;
      }
      if (!editPlanForm.next_installment_due) {
        alert("Debes ingresar el vencimiento de la próxima cuota");
        return;
      }
    }

    const { error } = await supabase
      .from("custom_plans")
      .update({
        member_id: member.id,
        member_name: member.name,
        name: editPlanForm.name,
        description: editPlanForm.description,
        price: editPlanForm.price,
        start_date: editPlanForm.start_date,
        end_date: editPlanForm.end_date,
      })
      .eq("id", editingPlan.id);

    if (error) {
      console.error("Error al actualizar plan personalizado:", error);
      return;
    }

    setCustomPlans(
      customPlans.map((plan) =>
        plan.id === editingPlan.id
          ? {
              ...plan,
              member_id: member.id,
              member_name: member.name,
              name: editPlanForm.name,
              description: editPlanForm.description,
              price: editPlanForm.price,
              start_date: editPlanForm.start_date,
              end_date: editPlanForm.end_date,
            }
          : plan
      )
    );

    if (editPaymentId) {
      const includesCardDetails = [
        "Tarjeta de Crédito",
        "Tarjeta de Débito",
      ].includes(editPlanForm.payment_method || "");

      const baseDescription = editPlanForm.payment_description
        ? editPlanForm.payment_description
        : editPlanForm.installments > 1
        ? `Pago en ${editPlanForm.installments} cuotas. Próximo vencimiento: ${editPlanForm.next_installment_due}`
        : "";
      const paymentDescription = ensureCustomPlanMarker(
        baseDescription,
        editingPlan.id
      );

      const paymentUpdatePayload: Partial<Payment> & {
        card_brand?: string | null;
        card_installments?: number | null;
        description?: string | null;
      } = {
        member_id: member.id,
        member_name: member.name,
        amount: paymentAmount,
        date: editPlanForm.payment_date,
        start_date: editPlanForm.start_date,
        plan: editPlanForm.name,
        method: editPlanForm.payment_method || "Efectivo",
        card_brand: includesCardDetails
          ? editPlanForm.card_brand || null
          : null,
        card_installments:
          editPlanForm.payment_method === "Tarjeta de Crédito"
            ? editPlanForm.card_installments
            : null,
        description: paymentDescription,
      };

      const { error: paymentError } = await supabase
        .from("payments")
        .update(paymentUpdatePayload)
        .eq("id", editPaymentId);

      if (paymentError) {
        console.error(
          "Error al actualizar pago de personalizado:",
          paymentError
        );
      } else {
        setPayments(
          payments.map((payment) =>
            payment.id === editPaymentId
              ? {
                  ...payment,
                  member_id: member.id,
                  member_name: member.name,
                  amount: paymentAmount,
                  date: editPlanForm.payment_date,
                  start_date: editPlanForm.start_date,
                  plan: editPlanForm.name,
                  method: paymentUpdatePayload.method ?? payment.method,
                  card_brand: paymentUpdatePayload.card_brand ?? undefined,
                  card_installments:
                    paymentUpdatePayload.card_installments ?? undefined,
                  description: paymentDescription,
                }
              : payment
          )
        );
      }
    }

    resetEditState();
  };

  const handleDeletePlan = async (id: string) => {
    const { error } = await supabase.from("custom_plans").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar plan personalizado:", error);
      return;
    }
    setCustomPlans(customPlans.filter((p) => p.id !== id));
  };

  const handleOpenRenewDialog = (plan: CustomPlan) => {
    const member = members.find((m) => m.id === plan.member_id);
    setRenewPlan({
      ...createEmptyPlanForm(),
      member_id: plan.member_id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      payment_amount: plan.price,
      start_date: plan.start_date || new Date().toLocaleDateString("en-CA"),
      end_date: plan.end_date || "",
      next_installment_due:
        plan.end_date || new Date().toLocaleDateString("en-CA"),
    });
    setRenewMemberSearch(member ? member.name : plan.member_name);
    setIsRenewDialogOpen(true);
  };

  const resetRenewState = () => {
    setIsRenewDialogOpen(false);
    setRenewPlan(createEmptyPlanForm());
    setRenewMemberSearch("");
  };

  const handleRenewPlan = async () => {
    const member = members.find((m) => m.id === renewPlan.member_id);
    if (!member) return;

    const paymentAmount =
      renewPlan.installments === 1 ? renewPlan.price : renewPlan.payment_amount;

    if (renewPlan.installments > 1) {
      if (paymentAmount <= 0) {
        alert("El monto a abonar debe ser mayor a 0");
        return;
      }
      if (paymentAmount > renewPlan.price) {
        alert("El monto a abonar no puede superar el precio del plan");
        return;
      }
      if (!renewPlan.next_installment_due) {
        alert("Debes ingresar el vencimiento de la próxima cuota");
        return;
      }
    }

    const id = `${gymId}_custom_${Date.now()}`;
    const plan: CustomPlan = {
      id,
      gym_id: gymId,
      member_id: member.id,
      member_name: member.name,
      name: renewPlan.name,
      description: renewPlan.description,
      price: renewPlan.price,
      start_date: renewPlan.start_date,
      end_date: renewPlan.end_date,
      is_active: true,
    };

    const { error } = await supabase.from("custom_plans").insert([plan]);
    if (error) {
      console.error("Error al renovar plan personalizado:", error);
      return;
    }

    const paymentId = `${gymId}_payment_${Date.now()}`;
    const baseDescription =
      renewPlan.payment_description ||
      (renewPlan.installments > 1
        ? `Pago en ${renewPlan.installments} cuotas. Próximo vencimiento: ${renewPlan.next_installment_due}`
        : "");
    const paymentDescription = ensureCustomPlanMarker(baseDescription, id);

    const payment: Payment = {
      id: paymentId,
      gym_id: gymId,
      member_id: member.id,
      member_name: member.name,
      amount: paymentAmount,
      date: renewPlan.payment_date,
      start_date: renewPlan.start_date,
      plan: renewPlan.name,
      method: renewPlan.payment_method || "Efectivo",
      card_brand: ["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
        renewPlan.payment_method || ""
      )
        ? renewPlan.card_brand
        : undefined,
      card_installments:
        renewPlan.payment_method === "Tarjeta de Crédito"
          ? renewPlan.card_installments
          : undefined,
      type: "custom_plan",
      description: paymentDescription,
    };

    const paymentRecord: Payment = {
      ...payment,
      type: "plan",
    };

    const { error: paymentError } = await supabase
      .from("payments")
      .insert([paymentRecord]);
    if (paymentError) {
      console.error("Error al registrar pago de renovación:", paymentError);
    } else {
      setPayments([...payments, payment]);
    }

    setCustomPlans([...customPlans, plan]);
    resetRenewState();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Planes Personalizados
          </h2>
          <p className="text-muted-foreground">
            Gestiona los planes personalizados de los socios
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Crear Plan Personalizado</DialogTitle>
              <DialogDescription>
                Asocia un plan especial a un socio.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label>Buscar Socio</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar socio..."
                      className="pl-8"
                      value={memberSearch}
                      onChange={(e) => handleMemberSearchChange(e.target.value)}
                    />
                  </div>
                  {showMemberResults && (
                    <div className="max-h-32 overflow-y-auto rounded-md border">
                      {filteredMembers.length > 0 ? (
                        filteredMembers.map((member) => (
                          <div
                            key={member.id}
                            className={cn(
                              "cursor-pointer border-b p-2 text-sm transition-colors last:border-b-0 hover:bg-blue-500/10 dark:hover:bg-blue-500/30",
                              newPlan.member_id === member.id &&
                                "bg-blue-500/20 dark:bg-blue-500/40"
                            )}
                            onClick={() => {
                              setNewPlan((prev) => ({
                                ...prev,
                                member_id: member.id,
                              }));
                              setMemberSearch(member.name);
                            }}
                          >
                            <div className="font-medium">{member.name}</div>
                            {member.plan && (
                              <div className="text-xs text-muted-foreground">
                                Plan actual: {member.plan}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          No se encontraron socios
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Nombre del Plan</Label>
                  <Input
                    value={newPlan.name}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Descripción</Label>
                  <Input
                    value={newPlan.description}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Precio ($)</Label>
                  <Input
                    type="number"
                    value={newPlan.price}
                    onChange={(e) =>
                      setNewPlan((prev) => {
                        const price = Number(e.target.value);
                        const fallbackDate =
                          prev.end_date ||
                          prev.start_date ||
                          new Date().toLocaleDateString("en-CA");
                        return {
                          ...prev,
                          price,
                          payment_amount:
                            prev.installments === 1
                              ? price
                              : prev.payment_amount,
                          next_installment_due:
                            prev.installments === 1
                              ? fallbackDate
                              : prev.next_installment_due || fallbackDate,
                        };
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom-plan-installments">
                    Cantidad de cuotas
                  </Label>
                  <Select
                    value={newPlan.installments.toString()}
                    onValueChange={(value) => {
                      const installments = Number.parseInt(value, 10);
                      const fallbackDate =
                        newPlan.end_date ||
                        newPlan.start_date ||
                        new Date().toLocaleDateString("en-CA");
                      setNewPlan((prev) => ({
                        ...prev,
                        installments,
                        payment_amount: installments === 1 ? prev.price : 0,
                        next_installment_due:
                          installments === 1
                            ? fallbackDate
                            : prev.next_installment_due || fallbackDate,
                      }));
                    }}
                  >
                    <SelectTrigger id="custom-plan-installments">
                      <SelectValue placeholder="Selecciona cuotas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newPlan.installments > 1 && (
                  <div className="grid gap-2">
                    <Label htmlFor="custom-plan-payment-amount">
                      Monto a abonar
                    </Label>
                    <Input
                      id="custom-plan-payment-amount"
                      type="number"
                      value={newPlan.payment_amount}
                      onChange={(e) =>
                        setNewPlan({
                          ...newPlan,
                          payment_amount: Number(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Saldo pendiente: $
                      {Math.max(
                        newPlan.price - newPlan.payment_amount,
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Fecha de inicio</Label>
                  <Input
                    type="date"
                    value={newPlan.start_date}
                    onChange={(e) =>
                      setNewPlan((prev) => {
                        const startDate = e.target.value;
                        const fallbackDate = prev.end_date || startDate;
                        return {
                          ...prev,
                          start_date: startDate,
                          next_installment_due:
                            prev.installments === 1
                              ? fallbackDate || prev.next_installment_due
                              : prev.next_installment_due,
                        };
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha de pago</Label>
                  <Input
                    type="date"
                    value={newPlan.payment_date}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, payment_date: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Método de pago</Label>
                  <Select
                    value={newPlan.payment_method}
                    onValueChange={(v) =>
                      setNewPlan({
                        ...newPlan,
                        payment_method: v,
                        card_brand: "",
                        card_installments: 1,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">
                        Transferencia
                      </SelectItem>
                      <SelectItem value="Tarjeta de Débito">
                        Tarjeta de Débito
                      </SelectItem>
                      <SelectItem value="Tarjeta de Crédito">
                        Tarjeta de Crédito
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
                  newPlan.payment_method || ""
                ) && (
                  <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
                    <div className="grid gap-2">
                      <Label>Tipo de Tarjeta</Label>
                      <Select
                        value={newPlan.card_brand}
                        onValueChange={(v) =>
                          setNewPlan({ ...newPlan, card_brand: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tarjeta" />
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
                      <Label htmlFor="cardInstallments">
                        Número de cuotas en la tarjeta
                      </Label>
                      <Input
                        id="cardInstallments"
                        type="number"
                        min={1}
                        value={newPlan.card_installments}
                        onChange={(e) =>
                          setNewPlan({
                            ...newPlan,
                            card_installments: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="payment_description">
                    Descripción del pago
                  </Label>
                  <Input
                    id="payment_description"
                    value={newPlan.payment_description}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        payment_description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha de finalización</Label>
                  <Input
                    type="date"
                    value={newPlan.end_date}
                    onChange={(e) =>
                      setNewPlan((prev) => {
                        const endDate = e.target.value;
                        return {
                          ...prev,
                          end_date: endDate,
                          next_installment_due:
                            prev.installments === 1
                              ? endDate || prev.next_installment_due
                              : prev.next_installment_due,
                        };
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom-plan-next-installment">
                    Vencimiento próxima cuota
                  </Label>
                  <Input
                    id="custom-plan-next-installment"
                    type="date"
                    value={newPlan.next_installment_due}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        next_installment_due: e.target.value,
                      })
                    }
                    disabled={newPlan.installments === 1}
                  />
                  <p className="text-xs text-muted-foreground">
                    {newPlan.installments === 1
                      ? "Se utilizará la fecha de finalización del plan."
                      : "Define cuándo debería abonarse la próxima cuota."}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddPlan}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetEditState();
          } else {
            setIsEditDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar Plan Personalizado</DialogTitle>
            <DialogDescription>
              Actualiza los datos del plan personalizado seleccionado.
            </DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <div className="grid gap-6 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Buscar Socio</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar socio..."
                      className="pl-8"
                      value={editMemberSearch}
                      onChange={(e) =>
                        handleEditMemberSearchChange(e.target.value)
                      }
                    />
                  </div>
                  {showEditMemberResults && (
                    <div className="max-h-32 overflow-y-auto rounded-md border">
                      {editFilteredMembers.length > 0 ? (
                        editFilteredMembers.map((member) => (
                          <div
                            key={member.id}
                            className={cn(
                              "cursor-pointer border-b p-2 text-sm transition-colors last:border-b-0 hover:bg-blue-500/10 dark:hover:bg-blue-500/30",
                              editPlanForm.member_id === member.id &&
                                "bg-blue-500/20 dark:bg-blue-500/40"
                            )}
                            onClick={() => {
                              setEditPlanForm((prev) => ({
                                ...prev,
                                member_id: member.id,
                              }));
                              setEditMemberSearch(member.name);
                            }}
                          >
                            <div className="font-medium">{member.name}</div>
                            {member.plan && (
                              <div className="text-xs text-muted-foreground">
                                Plan actual: {member.plan}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          No se encontraron socios
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Nombre del Plan</Label>
                  <Input
                    value={editPlanForm.name}
                    onChange={(e) =>
                      setEditPlanForm({
                        ...editPlanForm,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Descripción</Label>
                  <Input
                    value={editPlanForm.description}
                    onChange={(e) =>
                      setEditPlanForm({
                        ...editPlanForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Precio ($)</Label>
                  <Input
                    type="number"
                    value={editPlanForm.price}
                    onChange={(e) =>
                      setEditPlanForm((prev) => {
                        const price = Number(e.target.value);
                        const fallbackDate =
                          prev.end_date ||
                          prev.start_date ||
                          new Date().toLocaleDateString("en-CA");
                        return {
                          ...prev,
                          price,
                          payment_amount:
                            prev.installments === 1
                              ? price
                              : prev.payment_amount,
                          next_installment_due:
                            prev.installments === 1
                              ? fallbackDate
                              : prev.next_installment_due || fallbackDate,
                        };
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-plan-installments">
                    Cantidad de cuotas
                  </Label>
                  <Select
                    value={editPlanForm.installments.toString()}
                    onValueChange={(value) => {
                      const installments = Number.parseInt(value, 10);
                      const fallbackDate =
                        editPlanForm.end_date ||
                        editPlanForm.start_date ||
                        new Date().toLocaleDateString("en-CA");
                      setEditPlanForm((prev) => ({
                        ...prev,
                        installments,
                        payment_amount:
                          installments === 1
                            ? prev.price
                            : prev.installments === 1
                            ? 0
                            : prev.payment_amount,
                        next_installment_due:
                          installments === 1
                            ? fallbackDate
                            : prev.next_installment_due || fallbackDate,
                      }));
                    }}
                  >
                    <SelectTrigger id="edit-plan-installments">
                      <SelectValue placeholder="Selecciona cuotas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editPlanForm.installments > 1 && (
                  <div className="grid gap-2">
                    <Label htmlFor="edit-plan-payment-amount">
                      Monto a abonar
                    </Label>
                    <Input
                      id="edit-plan-payment-amount"
                      type="number"
                      value={editPlanForm.payment_amount}
                      onChange={(e) =>
                        setEditPlanForm({
                          ...editPlanForm,
                          payment_amount: Number(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Saldo pendiente: $
                      {Math.max(
                        editPlanForm.price - editPlanForm.payment_amount,
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Fecha de inicio</Label>
                  <Input
                    type="date"
                    value={editPlanForm.start_date}
                    onChange={(e) =>
                      setEditPlanForm((prev) => {
                        const startDate = e.target.value;
                        const fallbackDate = prev.end_date || startDate;
                        return {
                          ...prev,
                          start_date: startDate,
                          next_installment_due:
                            prev.installments === 1
                              ? fallbackDate || prev.next_installment_due
                              : prev.next_installment_due,
                        };
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha de finalización</Label>
                  <Input
                    type="date"
                    value={editPlanForm.end_date}
                    onChange={(e) =>
                      setEditPlanForm((prev) => {
                        const endDate = e.target.value;
                        return {
                          ...prev,
                          end_date: endDate,
                          next_installment_due:
                            prev.installments === 1
                              ? endDate || prev.next_installment_due
                              : prev.next_installment_due,
                        };
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha de pago</Label>
                  <Input
                    type="date"
                    value={editPlanForm.payment_date}
                    onChange={(e) =>
                      setEditPlanForm({
                        ...editPlanForm,
                        payment_date: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Método de pago</Label>
                  <Select
                    value={editPlanForm.payment_method}
                    onValueChange={(value) =>
                      setEditPlanForm({
                        ...editPlanForm,
                        payment_method: value,
                        card_brand: "",
                        card_installments: 1,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">
                        Transferencia
                      </SelectItem>
                      <SelectItem value="Tarjeta de Débito">
                        Tarjeta de Débito
                      </SelectItem>
                      <SelectItem value="Tarjeta de Crédito">
                        Tarjeta de Crédito
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-plan-next-installment">
                    Vencimiento próxima cuota
                  </Label>
                  <Input
                    id="edit-plan-next-installment"
                    type="date"
                    value={editPlanForm.next_installment_due}
                    onChange={(e) =>
                      setEditPlanForm({
                        ...editPlanForm,
                        next_installment_due: e.target.value,
                      })
                    }
                    disabled={editPlanForm.installments === 1}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editPlanForm.installments === 1
                      ? "Se utilizará la fecha de finalización del plan."
                      : "Define cuándo debería abonarse la próxima cuota."}
                  </p>
                </div>
                {["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
                  editPlanForm.payment_method || ""
                ) && (
                  <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Tipo de Tarjeta</Label>
                      <Select
                        value={editPlanForm.card_brand}
                        onValueChange={(value) =>
                          setEditPlanForm({
                            ...editPlanForm,
                            card_brand: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tarjeta" />
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
                      <Label htmlFor="edit-card-installments">
                        Número de cuotas en la tarjeta
                      </Label>
                      <Input
                        id="edit-card-installments"
                        type="number"
                        min={1}
                        value={editPlanForm.card_installments}
                        onChange={(e) =>
                          setEditPlanForm({
                            ...editPlanForm,
                            card_installments:
                              Number.parseInt(e.target.value, 10) || 1,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="edit-payment-description">
                    Descripción del pago
                  </Label>
                  <Input
                    id="edit-payment-description"
                    value={editPlanForm.payment_description}
                    onChange={(e) =>
                      setEditPlanForm({
                        ...editPlanForm,
                        payment_description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleEditPlan}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRenewDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetRenewState();
          } else {
            setIsRenewDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Renovar Plan Personalizado</DialogTitle>
            <DialogDescription>
              Actualiza los datos para generar una nueva vigencia del plan
              seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Buscar Socio</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar socio..."
                    className="pl-8"
                    value={renewMemberSearch}
                    onChange={(e) =>
                      handleRenewMemberSearchChange(e.target.value)
                    }
                  />
                </div>
                {showRenewMemberResults && (
                  <div className="max-h-32 overflow-y-auto rounded-md border">
                    {renewFilteredMembers.length > 0 ? (
                      renewFilteredMembers.map((member) => (
                        <div
                          key={member.id}
                          className={cn(
                            "cursor-pointer border-b p-2 text-sm transition-colors last:border-b-0 hover:bg-blue-500/10 dark:hover:bg-blue-500/30",
                            renewPlan.member_id === member.id &&
                              "bg-blue-500/20 dark:bg-blue-500/40"
                          )}
                          onClick={() => {
                            setRenewPlan((prev) => ({
                              ...prev,
                              member_id: member.id,
                            }));
                            setRenewMemberSearch(member.name);
                          }}
                        >
                          <div className="font-medium">{member.name}</div>
                          {member.plan && (
                            <div className="text-xs text-muted-foreground">
                              Plan actual: {member.plan}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">
                        No se encontraron socios
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Nombre del Plan</Label>
                <Input
                  value={renewPlan.name}
                  onChange={(e) =>
                    setRenewPlan({ ...renewPlan, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Descripción</Label>
                <Input
                  value={renewPlan.description}
                  onChange={(e) =>
                    setRenewPlan({
                      ...renewPlan,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Precio ($)</Label>
                <Input
                  type="number"
                  value={renewPlan.price}
                  onChange={(e) =>
                    setRenewPlan((prev) => {
                      const price = Number(e.target.value);
                      const fallbackDate =
                        prev.end_date ||
                        prev.start_date ||
                        new Date().toLocaleDateString("en-CA");
                      return {
                        ...prev,
                        price,
                        payment_amount:
                          prev.installments === 1 ? price : prev.payment_amount,
                        next_installment_due:
                          prev.installments === 1
                            ? fallbackDate
                            : prev.next_installment_due || fallbackDate,
                      };
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="renew-plan-installments">
                  Cantidad de cuotas
                </Label>
                <Select
                  value={renewPlan.installments.toString()}
                  onValueChange={(value) => {
                    const installments = Number.parseInt(value, 10);
                    const fallbackDate =
                      renewPlan.end_date ||
                      renewPlan.start_date ||
                      new Date().toLocaleDateString("en-CA");
                    setRenewPlan((prev) => ({
                      ...prev,
                      installments,
                      payment_amount: installments === 1 ? prev.price : 0,
                      next_installment_due:
                        installments === 1
                          ? fallbackDate
                          : prev.next_installment_due || fallbackDate,
                    }));
                  }}
                >
                  <SelectTrigger id="renew-plan-installments">
                    <SelectValue placeholder="Selecciona cuotas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renewPlan.installments > 1 && (
                <div className="grid gap-2">
                  <Label htmlFor="renew-plan-payment-amount">
                    Monto a abonar
                  </Label>
                  <Input
                    id="renew-plan-payment-amount"
                    type="number"
                    value={renewPlan.payment_amount}
                    onChange={(e) =>
                      setRenewPlan((prev) => {
                        const startDate = e.target.value;
                        const fallbackDate = prev.end_date || startDate;
                        return {
                          ...prev,
                          start_date: startDate,
                          next_installment_due:
                            prev.installments === 1
                              ? fallbackDate || prev.next_installment_due
                              : prev.next_installment_due,
                        };
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Saldo pendiente: $
                    {Math.max(
                      renewPlan.price - renewPlan.payment_amount,
                      0
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Fecha de inicio</Label>
                <Input
                  type="date"
                  value={renewPlan.start_date}
                  onChange={(e) =>
                    setRenewPlan({
                      ...renewPlan,
                      start_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de pago</Label>
                <Input
                  type="date"
                  value={renewPlan.payment_date}
                  onChange={(e) =>
                    setRenewPlan({
                      ...renewPlan,
                      payment_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Método de pago</Label>
                <Select
                  value={renewPlan.payment_method}
                  onValueChange={(v) =>
                    setRenewPlan({
                      ...renewPlan,
                      payment_method: v,
                      card_brand: "",
                      card_installments: 1,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="Tarjeta de Débito">
                      Tarjeta de Débito
                    </SelectItem>
                    <SelectItem value="Tarjeta de Crédito">
                      Tarjeta de Crédito
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
                renewPlan.payment_method
              ) && (
                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Tarjeta</Label>
                    <Select
                      value={renewPlan.card_brand}
                      onValueChange={(v) =>
                        setRenewPlan({
                          ...renewPlan,
                          card_brand: v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tarjeta" />
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
                  {renewPlan.payment_method === "Tarjeta de Crédito" && (
                    <div className="grid gap-2">
                      <Label>Cuotas</Label>
                      <Input
                        type="number"
                        min={1}
                        value={renewPlan.card_installments}
                        onChange={(e) =>
                          setRenewPlan({
                            ...renewPlan,
                            card_installments: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="renew-payment-description">
                  Descripción del pago
                </Label>
                <Input
                  id="renew-payment-description"
                  value={renewPlan.payment_description}
                  onChange={(e) =>
                    setRenewPlan({
                      ...renewPlan,
                      payment_description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de finalización</Label>
                <Input
                  type="date"
                  value={renewPlan.end_date}
                  onChange={(e) =>
                    setRenewPlan((prev) => {
                      const endDate = e.target.value;
                      return {
                        ...prev,
                        end_date: endDate,
                        next_installment_due:
                          prev.installments === 1
                            ? endDate || prev.next_installment_due
                            : prev.next_installment_due,
                      };
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="renew-plan-next-installment">
                  Vencimiento próxima cuota
                </Label>
                <Input
                  id="renew-plan-next-installment"
                  type="date"
                  value={renewPlan.next_installment_due}
                  onChange={(e) =>
                    setRenewPlan({
                      ...renewPlan,
                      next_installment_due: e.target.value,
                    })
                  }
                  disabled={renewPlan.installments === 1}
                />
                <p className="text-xs text-muted-foreground">
                  {renewPlan.installments === 1
                    ? "Se utilizará la fecha de finalización del plan."
                    : "Define cuándo debería abonarse la próxima cuota."}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRenewPlan}>Guardar renovación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500 text-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100/80">
              Planes activos
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{activePlans}</div>
            <p className="text-xs text-blue-100/80">
              de {totalPlans} plan{totalPlans === 1 ? "" : "es"} totales
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximos a vencer (7 días)
            </CardTitle>
            <CalendarClock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-amber-600">
              {expiringSoonCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Seguimiento recomendado
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Planes vencidos
            </CardTitle>
            <Ban className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-600">
              {expiredPlans}
            </div>
            <p className="text-xs text-muted-foreground">
              {inactivePlans} marcados como inactivos
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Facturación total
            </CardTitle>
            <PiggyBank className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-emerald-600">
              {formattedTotalRevenue}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos por planes personalizados
            </p>
          </CardContent>
        </Card>
      </div>

      {expiringSoonCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm shadow-sm">
          <div className="flex items-start gap-3 text-amber-800">
            <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">
                {expiringSoonCount} plan{expiringSoonCount === 1 ? "" : "es"}{" "}
                próximo
                {expiringSoonCount === 1 ? "" : "s"} a vencer
              </p>
              <p className="text-xs text-amber-700">
                Revisa estos planes para renovar o contactar a los socios.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative w-full md:w-72 lg:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por socio o plan"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Estado del plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Solo activos</SelectItem>
                <SelectItem value="expiring">Próximos a vencer</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
                <SelectItem value="renewed">Ya renovados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="justify-start text-muted-foreground hover:text-foreground md:w-auto"
            >
              Limpiar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Planes Registrados
            </CardTitle>
            <p className="text-sm text-muted-foreground">{filterDescription}</p>
          </div>
          <Badge variant="outline" className="w-fit">
            {resultsLabel}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[640px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Precio
                    </TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePlans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-muted/40">
                      <TableCell className="align-top">
                        <div className="font-medium text-sm text-foreground">
                          {plan.member_name}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {plan.name}
                            </span>
                            {renderStatusBadge(plan)}
                          </div>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground">
                              {plan.description}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground md:hidden">
                            {currencyFormatter.format(plan.price)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden align-top text-right font-medium md:table-cell">
                        {currencyFormatter.format(plan.price)}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium uppercase text-muted-foreground">
                              Inicio
                            </span>
                            <span className="text-sm font-medium">
                              {formatDate(plan.start_date)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium uppercase text-muted-foreground">
                              Fin
                            </span>
                            <span className="text-sm font-medium">
                              {formatDate(plan.end_date)}
                            </span>
                          </div>
                          {renderTimeLeft(plan)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(plan)}
                            className="text-muted-foreground hover:bg-blue-50 hover:text-blue-600"
                            aria-label={`Editar plan ${plan.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenRenewDialog(plan)}
                            className="text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
                            aria-label={`Renovar plan ${plan.name}`}
                          >
                            <RefreshCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePlan(plan.id)}
                            className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            aria-label={`Eliminar plan ${plan.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedPlans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                          <p className="text-sm font-medium text-muted-foreground">
                            No encontramos planes con los filtros actuales.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Crea un nuevo plan personalizado para comenzar.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddDialogOpen(true)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Crear plan
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          <div className="flex flex-col gap-3 border-t px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {sortedPlans.length > 0 && (
                <>
                  Mostrando <strong>{visiblePlans.length}</strong> de{" "}
                  <strong>{sortedPlans.length}</strong> planes listados
                </>
              )}
            </div>
            {canLoadMorePlans && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMorePlans}
                >
                  Cargar más
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
