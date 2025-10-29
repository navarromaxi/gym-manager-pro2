"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  CalendarClock,
  X,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Member, Payment, Plan, CustomPlan } from "@/lib/supabase";
import { detectContractTable } from "@/lib/contract-table";
import type { ContractTableName } from "@/lib/contract-table";

// Normaliza fechas a medianoche local admitiendo strings con o sin tiempo
const toLocalDate = (isoDate: string) => {
  if (!isoDate) return new Date(NaN);

  const dateMatch = isoDate.match(/^(\d{4}-\d{2}-\d{2})/);
  const dateOnly = dateMatch ? dateMatch[1] : null;

  if (dateOnly) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(NaN);
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

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

const MEMBERS_PER_BATCH = 10;

const formatDateForAlert = (isoDate: string) => {
  if (!isoDate) return "";
  const date = toLocalDate(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
};

const getRealStatus = (member: Member): "active" | "expired" | "inactive" => {
  const today = new Date();
  //const next = new Date(member.next_payment);
  //const diffMs = today.getTime() - next.getTime();
  //const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const next = toLocalDate(member.next_payment);
  const diffDays = Math.ceil((today.getTime() - next.getTime()) / 86400000);

  if (diffDays <= 0) return "active";
  if (diffDays <= 30) return "expired";
  return "inactive";
};

const extractCustomPlanTimestamp = (plan: CustomPlan) => {
  const parts = plan.id.split("_");
  const maybeTimestamp = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  return Number.isNaN(maybeTimestamp) ? 0 : maybeTimestamp;
};

const getCustomPlanEndDate = (plan: CustomPlan) => {
  if (!plan.end_date) return null;
  const parsed = toLocalDate(plan.end_date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isCustomPlanMoreRecent = (candidate: CustomPlan, current: CustomPlan) => {
  const candidateEnd = getCustomPlanEndDate(candidate);
  const currentEnd = getCustomPlanEndDate(current);

  if (candidateEnd && currentEnd) {
    if (candidateEnd.getTime() !== currentEnd.getTime()) {
      return candidateEnd.getTime() > currentEnd.getTime();
    }
  }

  if (candidateEnd && !currentEnd) return true;
  if (!candidateEnd && currentEnd) return false;

  return (
    extractCustomPlanTimestamp(candidate) > extractCustomPlanTimestamp(current)
  );
};

export interface MemberManagementProps {
  members: Member[];
  setMembers: (members: Member[]) => void;
  payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  plans: Plan[];
  customPlans: CustomPlan[];
  setCustomPlans: (plans: CustomPlan[]) => void;
  gymId: string;
  initialFilter?: string;
  onFilterChange?: (filter: string) => void;
}

export function MemberManagement({
  members,
  setMembers,
  payments,
  setPayments,
  plans,
  customPlans,
  setCustomPlans,
  gymId,
  initialFilter = "all",
  onFilterChange,
}: MemberManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const editDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedSearch(searchTerm.trim().toLowerCase()),
      250
    ); // 250ms
    return () => clearTimeout(id);
  }, [searchTerm]);

  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    referralSource: "",
    phone: "",
    plan: "",
    planPrice: 0,
    planStartDate: new Date().toISOString().split("T")[0],
    paymentDate: new Date().toISOString().split("T")[0],
    installments: 1,
    paymentAmount: 0,
    paymentMethod: "Efectivo",
    cardBrand: "",
    cardInstallments: 1,
    description: "",
    nextInstallmentDue: new Date().toISOString().split("T")[0],
  });

  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
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
  const isCardPayment = ["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
    newMember.paymentMethod
  );
  const [contractTable, setContractTable] = useState<ContractTableName | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleCount, setVisibleCount] = useState(MEMBERS_PER_BATCH);
  const [dismissedCustomPlanAlertIds, setDismissedCustomPlanAlertIds] =
    useState<string[]>([]);
    const [dismissedLongPlanMemberIds, setDismissedLongPlanMemberIds] =
    useState<string[]>([]);

  const planById = useMemo(() => {
    const map = new Map<string, Plan>();
    for (const plan of plans) {
      map.set(plan.id, plan);
    }
    return map;
  }, [plans]);

  const planByName = useMemo(() => {
    const map = new Map<string, Plan>();
    for (const plan of plans) {
      const key = plan.name?.trim().toLowerCase();
      if (key) {
        map.set(key, plan);
      }
    }
    return map;
  }, [plans]);

  const latestCustomPlanByMember = useMemo(() => {
    const map = new Map<string, CustomPlan>();
    for (const plan of customPlans) {
      const stored = map.get(plan.member_id);
      if (!stored || isCustomPlanMoreRecent(plan, stored)) {
        map.set(plan.member_id, plan);
      }
    }
    return map;
  }, [customPlans]);

  const isLatestCustomPlan = useCallback(
    (plan: CustomPlan) =>
      latestCustomPlanByMember.get(plan.member_id)?.id === plan.id,
    [latestCustomPlanByMember]
  );

  const selectedPlanForNewMember = useMemo(() => {
    return plans.find((p) => p.name === newMember.plan) ?? null;
  }, [plans, newMember.plan]);

  const calculatedPlanEndDate = useMemo(
    () =>
      calculatePlanEndDate(newMember.planStartDate, selectedPlanForNewMember),
    [newMember.planStartDate, selectedPlanForNewMember]
  );

  const nextInstallmentDueValue =
    newMember.installments === 1
      ? calculatedPlanEndDate
      : newMember.nextInstallmentDue || calculatedPlanEndDate;

  useEffect(() => {
    const checkTable = async () => {
      const table = await detectContractTable();
      setContractTable(table);
    };

    checkTable();
  }, []);
  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(statusFilter);
    }
  }, [statusFilter, onFilterChange]);

  const getExpiringCustomPlans = useCallback(() => {
    const today = new Date();

    return customPlans.filter((plan) => {
      if (!isLatestCustomPlan(plan)) return false;
      if (!plan.is_active) return false;
      if (!plan.end_date) return false;

      const endDate = toLocalDate(plan.end_date);
      if (Number.isNaN(endDate.getTime())) return false;

      const diffDays = Math.ceil(
        (endDate.getTime() - today.getTime()) / 86400000
      );

      return diffDays <= 10 && diffDays >= 0;
    });
  }, [customPlans, isLatestCustomPlan]);

  const sortedMembers = useMemo(() => {
    const parseDate = (value?: string | null) => {
      if (!value) return 0;
      const direct = Date.parse(value);
      if (!Number.isNaN(direct)) return direct;
      return Date.parse(`${value}T00:00:00`);
    };

    return [...members].sort((a, b) => {
      const aTime = Math.max(parseDate(a.last_payment), parseDate(a.join_date));
      const bTime = Math.max(parseDate(b.last_payment), parseDate(b.join_date));
      return bTime - aTime;
    });
  }, [members]);

  const getMembersToFollowUp = useCallback(() => {
    const today = new Date();
    return members.filter((member) => {
      let referenceDate: Date | null = null;

      for (const payment of payments) {
        if (
          payment.member_id === member.id &&
          payment.type === "plan" &&
          payment.start_date
        ) {
          const startDate = toLocalDate(payment.start_date);
          if (Number.isNaN(startDate.getTime())) continue;
          if (!referenceDate || startDate.getTime() > referenceDate.getTime()) {
            referenceDate = startDate;
          }
        }
      }

      if (!referenceDate) {
        const joinDate = toLocalDate(member.join_date);
        if (Number.isNaN(joinDate.getTime())) return false;
        referenceDate = joinDate;
      }

      const diffDays = Math.floor(
        (today.getTime() - referenceDate.getTime()) / 86400000
      );
      return !member.followed_up && diffDays >= 5 && diffDays <= 12;
    });
  }, [members, payments]);

  const membersToFollowUp = useMemo(
    () => getMembersToFollowUp(),
    [getMembersToFollowUp]
  );
  const followUpMemberIds = useMemo(
    () => new Set(membersToFollowUp.map((member) => member.id)),
    [membersToFollowUp]
  );

  const filteredMembers = useMemo(() => {
    const today = new Date();
    const expiringCustomPlanMemberIds =
      statusFilter === "custom_expiring"
        ? new Set(getExpiringCustomPlans().map((plan) => plan.member_id))
        : null;
    const filtered = sortedMembers.filter((member) => {
      // búsqueda (debounced)
      const name = (member.name ?? "").toLowerCase();
      const email = (member.email ?? "").toLowerCase();
      const matchesSearch =
        !debouncedSearch ||
        name.includes(debouncedSearch) ||
        email.includes(debouncedSearch);

      if (!matchesSearch) return false;

      const realStatus = getRealStatus(member);

      if (statusFilter === "expiring_soon") {
        const nextPayment = toLocalDate(member.next_payment);
        const diffDays = Math.ceil(
          (nextPayment.getTime() - today.getTime()) / 86400000
        );
        return diffDays <= 10 && diffDays >= 0 && realStatus === "active";
      }

      if (statusFilter === "follow_up") {
        return followUpMemberIds.has(member.id);
      }

      if (statusFilter === "balance_due") {
        return (member.balance_due || 0) > 0;
      }

      if (statusFilter === "custom_expiring") {
        return expiringCustomPlanMemberIds?.has(member.id) ?? false;
      }

      return statusFilter === "all" || realStatus === statusFilter;
    });

    if (statusFilter === "balance_due") {
      return filtered.sort(
        (a, b) => (b.balance_due || 0) - (a.balance_due || 0)
      );
    }

    return filtered;
  }, [sortedMembers, debouncedSearch, statusFilter, getExpiringCustomPlans]);

  useEffect(() => {
    setVisibleCount(MEMBERS_PER_BATCH);
  }, [debouncedSearch, statusFilter]);

  const totalFiltered = filteredMembers.length;
  const currentVisibleCount = Math.min(visibleCount, totalFiltered);
  const displayedMembers = filteredMembers.slice(0, currentVisibleCount);
  const canLoadMore = currentVisibleCount < totalFiltered;

  const handleLoadMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + MEMBERS_PER_BATCH, filteredMembers.length)
    );
  };

  const handleAddMember = async () => {
    try {
      const startDate = new Date(newMember.planStartDate);
      const nextPayment = new Date(startDate);
      const selectedPlan = plans.find((p) => p.name === newMember.plan);

      if (!selectedPlan) {
        alert("Debes seleccionar un plan");
        return;
      }
      if (newMember.planPrice <= 0) {
        alert("Debes ingresar un precio válido");
        return;
      }
      const installments = newMember.installments || 1;
      const paymentAmount =
        installments === 1 ? newMember.planPrice : newMember.paymentAmount;
      if (paymentAmount <= 0) {
        alert("Debes ingresar un monto válido");
        return;
      }
      if (paymentAmount > newMember.planPrice) {
        alert("El monto no puede ser mayor al precio del plan");
        return;
      }

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
          : newMember.nextInstallmentDue || nextPaymentISO;

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

      const planName = selectedPlan?.name || newMember.plan || "";
      const paymentDescription =
        newMember.description?.trim() || `Pago de plan ${planName}`.trim();
      const memberId = `${gymId}_member_${Date.now()}`;

      const member: Member = {
        id: memberId,
        gym_id: gymId,
        name: newMember.name,
        email: newMember.email,
        phone: newMember.phone,
        referral_source: newMember.referralSource || null,
        plan: newMember.plan,
        plan_price: newMember.planPrice,
        description: newMember.description || null,
        join_date: newMember.paymentDate,
        last_payment: newMember.planStartDate,
        next_payment: nextPaymentISO,
        next_installment_due: nextInstallmentDue,
        status: memberStatus,
        inactive_level: inactiveLevel,
        balance_due: newMember.planPrice - paymentAmount,
        followed_up: false,
      };

      // Guardar en Supabase
      const { description: _memberDescription, ...memberInsert } = member;
      const { error: memberError } = await supabase
        .from("members")
        .insert([memberInsert]);

      if (memberError) throw memberError;

      // Crear contrato de plan
      const contractId = `${memberId}_contract_${Date.now()}`;

      // Intentar insertar en la tabla plural y si no existe usar la singular
      const contract = {
        id: contractId,
        gym_id: gymId,
        member_id: memberId,
        plan_id: selectedPlan?.id || "",
        installments_total: installments,
        installments_paid: 1,
      };
      if (contractTable) {
        const { error: contractError } = await supabase
          .from(contractTable)
          .insert([contract]);
        if (contractError) {
          console.warn("Error registrando contrato de plan:", contractError);
        }
      }
      // Crear pago inicial
      const payment: Payment = {
        id: `${gymId}_payment_${Date.now()}`,
        gym_id: gymId,
        member_id: memberId,
        member_name: member.name,
        amount: paymentAmount,
        date: newMember.paymentDate,
        start_date: newMember.planStartDate,
        plan: member.plan,
        method: newMember.paymentMethod,
        card_brand: ["Tarjeta de Crédito", "Tarjeta de Débito"].includes(
          newMember.paymentMethod
        )
          ? newMember.cardBrand
          : undefined,
        card_installments:
          newMember.paymentMethod === "Tarjeta de Crédito"
            ? newMember.cardInstallments
            : undefined,
        type: "plan",
        description: paymentDescription,
        plan_id: selectedPlan?.id,
      };

      const { error: paymentError } = await supabase
        .from("payments")
        .insert([payment]);

      if (paymentError) throw paymentError;

      // Actualizar estados locales
      setMembers([...members, member]);
      setPayments([...payments, payment]);

      setNewMember({
        name: "",
        email: "",
        referralSource: "",
        phone: "",
        plan: "",
        planPrice: 0,
        planStartDate: new Date().toISOString().split("T")[0],
        paymentDate: new Date().toISOString().split("T")[0],
        installments: 1,
        paymentAmount: 0,
        paymentMethod: "Efectivo",
        cardBrand: "",
        cardInstallments: 1,
        description: "",
        nextInstallmentDue: new Date().toISOString().split("T")[0],
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error agregando miembro:", error);
      alert("Error al agregar el miembro. Inténtalo de nuevo.");
    }
  };

  const handleEditMember = async () => {
    if (!editingMember) return;

    try {
      const nextPaymentDate = new Date(editingMember.next_payment);
      const today = new Date();
      const diffDays = Math.ceil(
        (today.getTime() - nextPaymentDate.getTime()) / 86400000
      );
      let newStatus: "active" | "expired" | "inactive" = "active";
      let newInactive: "green" | "yellow" | "red" | undefined;
      if (diffDays > 0) {
        if (diffDays <= 30) {
          newStatus = "expired";
        } else {
          newStatus = "inactive";
          newInactive = "yellow";
        }
      }
      const { error } = await supabase
        .from("members")
        .update({
          name: editingMember.name,
          email: editingMember.email,
          phone: editingMember.phone,
          //description: editingMember.description || null,
          next_payment: editingMember.next_payment,
          next_installment_due:
            editingMember.next_installment_due || editingMember.next_payment,
          status: newStatus,
          inactive_level: newInactive,
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      const { error: paymentUpdateError } = await supabase
        .from("payments")
        .update({ member_name: editingMember.name })
        .eq("member_id", editingMember.id);

      if (paymentUpdateError) throw paymentUpdateError;

      const { error: customPlansUpdateError } = await supabase
        .from("custom_plans")
        .update({ member_name: editingMember.name })
        .eq("member_id", editingMember.id);

      if (customPlansUpdateError) throw customPlansUpdateError;

      const updatedMembers = members.map((m) =>
        m.id === editingMember.id
          ? {
              ...editingMember,
              status: newStatus,
              inactive_level: newInactive,
            }
          : m
      );
      const updatedPayments = payments.map((payment) =>
        payment.member_id === editingMember.id
          ? { ...payment, member_name: editingMember.name }
          : payment
      );

      const updatedCustomPlans = customPlans.map((plan) =>
        plan.member_id === editingMember.id
          ? { ...plan, member_name: editingMember.name }
          : plan
      );

      setMembers(updatedMembers);
      setPayments(updatedPayments);
      setCustomPlans(updatedCustomPlans);
      setIsEditDialogOpen(false);
      setEditingMember(null);
    } catch (error) {
      console.error("Error editando miembro:", error);
      alert("Error al editar el miembro. Inténtalo de nuevo.");
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este miembro?")) return;

    try {
      // Eliminar pagos relacionados
      const { error: paymentsError } = await supabase
        .from("payments")
        .delete()
        .eq("member_id", id);

      if (paymentsError) throw paymentsError;

      // Eliminar miembro
      const { error: memberError } = await supabase
        .from("members")
        .delete()
        .eq("id", id);

      if (memberError) throw memberError;

      // Actualizar estados locales
      setMembers(members.filter((m) => m.id !== id));
      setPayments(payments.filter((p) => p.member_id !== id));
    } catch (error) {
      console.error("Error eliminando miembro:", error);
      alert("Error al eliminar el miembro. Inténtalo de nuevo.");
    }
  };

  const getStatusBadge = (
    status: "active" | "expired" | "inactive",
    level?: "green" | "yellow" | "red"
  ) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Activo</Badge>;
      case "expired":
        return <Badge variant="destructive">Vencido</Badge>;
      case "inactive":
        const color =
          level === "green"
            ? "bg-green-500"
            : level === "yellow"
            ? "bg-yellow-500"
            : "bg-red-500";
        return <Badge className={`${color} text-white`}>Inactivo</Badge>;
    }
  };

  const getDaysUntilExpiration = (nextPayment: string) => {
    const today = new Date();
    const expiration = toLocalDate(nextPayment); // 👈 evita desfase
    const diffDays = Math.ceil(
      (expiration.getTime() - today.getTime()) / 86400000
    );
    return diffDays;
  };

  const getExpiringMembers = () => {
    const today = new Date();
    return members.filter((member) => {
      const nextPayment = toLocalDate(member.next_payment);
      const diffDays = Math.ceil(
        (nextPayment.getTime() - today.getTime()) / 86400000
      );
      return (
        diffDays <= 10 && diffDays >= 0 && getRealStatus(member) === "active"
      );
    });
  };

  const getExpiredMembers = () =>
    members.filter((member) => getRealStatus(member) === "expired");

  const getMembersWithBalanceDue = () =>
    members.filter((member) => (member.balance_due || 0) > 0);

  //Función para marcar como contactado
  const handleMarkAsFollowedUp = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("members")
        .update({ followed_up: true })
        .eq("id", memberId);

      if (error) throw error;

      const updatedMembers = members.map((m) =>
        m.id === memberId ? { ...m, followed_up: true } : m
      );
      setMembers(updatedMembers);
      setDismissedLongPlanMemberIds((prev) =>
        prev.includes(memberId) ? prev : [...prev, memberId]
      );
      setRefreshKey((prev) => prev + 1); // Forzar rerender
    } catch (error) {
      console.error("Error al marcar como contactado:", error);
      alert("No se pudo marcar como contactado.");
    }
  };

  const expiringMembers = getExpiringMembers();
  const expiredMembers = getExpiredMembers();
  const membersWithBalanceDue = getMembersWithBalanceDue();
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const membersWithPartialDueSoon = membersWithBalanceDue.filter((member) => {
    if (!member.next_installment_due) return false;
    const dueDate = toLocalDate(member.next_installment_due);
    if (Number.isNaN(dueDate.getTime())) return false;
    const diffDays = Math.ceil(
      (dueDate.getTime() - todayMidnight.getTime()) / 86400000
    );
    return diffDays <= 10 && diffDays >= 0;
  });
  const membersWithPartialOverdue = membersWithBalanceDue.filter((member) => {
    if (!member.next_installment_due) return false;
    const dueDate = toLocalDate(member.next_installment_due);
    if (Number.isNaN(dueDate.getTime())) return false;
    return dueDate.getTime() < todayMidnight.getTime();
  });
  const expiringCustomPlansForAlert = getExpiringCustomPlans();
  const visibleExpiringCustomPlansForAlert = expiringCustomPlansForAlert.filter(
    (plan) => !dismissedCustomPlanAlertIds.includes(plan.id)
  );
  const expiringCustomPlanMembersCount = new Set(
    expiringCustomPlansForAlert.map((plan) => plan.member_id)
  ).size;
  const handleDismissCustomPlanAlert = useCallback((planId: string) => {
    setDismissedCustomPlanAlertIds((prev) =>
      prev.includes(planId) ? prev : [...prev, planId]
    );
  }, []);

  const longTermPlanFollowUps = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestPlanPaymentByMember = new Map<
      string,
      { payment: Payment; startDate: Date }
    >();

    for (const payment of payments) {
      if (payment.type !== "plan" || !payment.start_date) continue;
      const startDate = toLocalDate(payment.start_date);
      if (Number.isNaN(startDate.getTime())) continue;

      const existing = latestPlanPaymentByMember.get(payment.member_id);
      if (!existing || startDate.getTime() > existing.startDate.getTime()) {
        latestPlanPaymentByMember.set(payment.member_id, {
          payment,
          startDate,
        });
      }
    }

    const alerts: {
      memberId: string;
      memberName: string;
      planName: string;
      daysSinceStart: number;
    }[] = [];

    for (const [memberId, { payment, startDate }] of latestPlanPaymentByMember) {
      const member = members.find((m) => m.id === memberId);
      if (!member) continue;

      if (member.followed_up) {
        continue;
      }

      const normalizedPlanName = payment.plan?.trim().toLowerCase();
      const memberPlanName = member.plan?.trim().toLowerCase();
      const plan =
        (payment.plan_id && planById.get(payment.plan_id)) ||
        (normalizedPlanName && planByName.get(normalizedPlanName)) ||
        (memberPlanName && planByName.get(memberPlanName));

      if (!plan) continue;

      let qualifies = false;
      if (plan.duration_type === "months") {
        qualifies = plan.duration >= 5;
      } else if (plan.duration_type === "years") {
        qualifies = plan.duration * 12 >= 5;
      } else if (plan.duration_type === "days") {
        qualifies = plan.duration >= 150;
      }

      if (!qualifies) continue;

      const startDateIso = payment.start_date;
      if (!startDateIso) continue;

      const planEndDateIso = calculatePlanEndDate(startDateIso, plan);
      const planEndDate = planEndDateIso
        ? toLocalDate(planEndDateIso)
        : new Date(NaN);
      if (Number.isNaN(planEndDate.getTime())) continue;
      if (planEndDate.getTime() < today.getTime()) continue;

      const daysSinceStart = Math.floor(
        (today.getTime() - startDate.getTime()) / 86400000
      );
      if (daysSinceStart < 120) continue;

      alerts.push({
        memberId,
        memberName: member.name || "Socio",
        planName: plan.name,
        daysSinceStart,
      });
    }

    return alerts.sort((a, b) => b.daysSinceStart - a.daysSinceStart);
  }, [payments, members, planById, planByName]);

  const visibleLongTermPlanFollowUps = useMemo(
    () =>
      longTermPlanFollowUps.filter(
        (alert) => !dismissedLongPlanMemberIds.includes(alert.memberId)
      ),
    [longTermPlanFollowUps, dismissedLongPlanMemberIds]
  );

  const handleDismissLongPlanAlert = useCallback((memberId: string) => {
    setDismissedLongPlanMemberIds((prev) =>
      prev.includes(memberId) ? prev : [...prev, memberId]
    );
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Socios
          </h2>
          <p className="text-muted-foreground">
            Administra los miembros del gimnasio
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Socio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Socio</DialogTitle>
              <DialogDescription>
                Completa los datos del nuevo miembro del gimnasio.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    value={newMember.name}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    placeholder="juan@email.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="referralSource">Como nos conocistes?</Label>
                  <Select
                    value={newMember.referralSource || "none"}
                    onValueChange={(value) =>
                      setNewMember({
                        ...newMember,
                        referralSource: value === "none" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger id="referralSource">
                      <SelectValue placeholder="Sin seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin seleccionar</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Referido">Referido</SelectItem>
                      <SelectItem value="Pase por el club">
                        Pase por el club
                      </SelectItem>
                      <SelectItem value="Whatssap">Whatssap</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={newMember.phone}
                    onChange={(e) =>
                      setNewMember({ ...newMember, phone: e.target.value })
                    }
                    placeholder="099123456"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="planStartDate">
                    Fecha de inicio del plan
                  </Label>
                  <Input
                    id="planStartDate"
                    type="date"
                    value={newMember.planStartDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      const computedNext = calculatePlanEndDate(
                        value,
                        selectedPlanForNewMember
                      );
                      setNewMember({
                        ...newMember,
                        planStartDate: value,
                        nextInstallmentDue:
                          newMember.installments === 1
                            ? computedNext
                            : newMember.nextInstallmentDue || computedNext,
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    El plan se calculará desde esta fecha (útil si se registra
                    con atraso)
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentDate">Fecha de pago</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={newMember.paymentDate}
                    onChange={(e) =>
                      setNewMember({
                        ...newMember,
                        paymentDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plan">Plan</Label>
                  <Select
                    value={newMember.plan}
                    onValueChange={(value) => {
                      const selectedPlan = plans.find((p) => p.name === value);
                      const computedNext = calculatePlanEndDate(
                        newMember.planStartDate,
                        selectedPlan
                      );
                      setNewMember({
                        ...newMember,
                        plan: value,
                        planPrice: selectedPlan?.price || 0,
                        installments: 1,
                        paymentAmount: selectedPlan?.price || 0,
                        nextInstallmentDue: computedNext,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans
                        .filter((plan) => plan.is_active)
                        .map((plan) => (
                          <SelectItem key={plan.id} value={plan.name}>
                            {plan.name} - ${plan.price}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {newMember.plan && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="planPrice">Precio total del plan</Label>
                      <Input
                        id="planPrice"
                        type="number"
                        value={newMember.planPrice}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0;
                          setNewMember({
                            ...newMember,
                            planPrice: price,
                            paymentAmount:
                              newMember.installments === 1
                                ? price
                                : newMember.paymentAmount,
                          });
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="installments">Cantidad de cuotas</Label>
                      <Select
                        value={newMember.installments.toString()}
                        onValueChange={(value) => {
                          const installments = parseInt(value);
                          const computedNext = calculatePlanEndDate(
                            newMember.planStartDate,
                            selectedPlanForNewMember
                          );
                          setNewMember({
                            ...newMember,
                            installments,
                            paymentAmount:
                              installments === 1 ? newMember.planPrice : 0,
                            nextInstallmentDue:
                              installments === 1
                                ? computedNext
                                : newMember.nextInstallmentDue || computedNext,
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
                           <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newMember.installments > 1 && (
                      <div className="grid gap-2">
                        <Label htmlFor="paymentAmount">Monto a abonar</Label>
                        <Input
                          id="paymentAmount"
                          type="number"
                          value={newMember.paymentAmount}
                          onChange={(e) =>
                            setNewMember({
                              ...newMember,
                              paymentAmount: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Saldo pendiente: $
                          {(
                            newMember.planPrice - newMember.paymentAmount
                          ).toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="nextInstallmentDue">
                        Vencimiento próxima cuota
                      </Label>
                      <Input
                        id="nextInstallmentDue"
                        type="date"
                        value={nextInstallmentDueValue}
                        onChange={(e) =>
                          setNewMember({
                            ...newMember,
                            nextInstallmentDue: e.target.value,
                          })
                        }
                        disabled={newMember.installments === 1}
                      />
                      <p className="text-xs text-muted-foreground">
                        {newMember.installments === 1
                          ? "Se utilizará la misma fecha que el fin del plan."
                          : "Registra cuándo debería abonarse la próxima cuota."}
                      </p>
                    </div>
                  </>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">Método de Pago</Label>
                  <Select
                    value={newMember.paymentMethod}
                    onValueChange={(value) =>
                      setNewMember({
                        ...newMember,
                        paymentMethod: value,
                        cardBrand: "",
                      })
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
                {isCardPayment && (
                  <div className="grid gap-2">
                    <Label>Tipo de Tarjeta</Label>
                    <Select
                      value={newMember.cardBrand}
                      onValueChange={(value) =>
                        setNewMember({ ...newMember, cardBrand: value })
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
                )}
                {newMember.paymentMethod === "Tarjeta de Crédito" && (
                  <div className="grid gap-2">
                    <Label htmlFor="cardInstallments">
                      Número de cuotas en la tarjeta
                    </Label>
                    <Input
                      id="cardInstallments"
                      type="number"
                      min={1}
                      value={newMember.cardInstallments}
                      onChange={(e) =>
                        setNewMember({
                          ...newMember,
                          cardInstallments: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                )}
                <div className="grid gap-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newMember.description}
                    onChange={(e) => {
                      const { value } = e.target
                      setNewMember((prev) => ({
                        ...prev,
                        description: value,
                      }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey) {
                        e.preventDefault();
                        const textarea = e.currentTarget;
                        const { selectionStart, selectionEnd, value } =
                          textarea;
                        const newValue =
                          value.slice(0, selectionStart) +
                          "\n" +
                          value.slice(selectionEnd);
                        setNewMember((prev) => ({
                          ...prev,
                          description: newValue,
                        }));
                        requestAnimationFrame(() => {
                          const cursorPosition = selectionStart + 1;
                          textarea.selectionStart = cursorPosition;
                          textarea.selectionEnd = cursorPosition;
                        });
                      }
                    }}
                    placeholder="Notas adicionales del socio"
                    className="min-h-[160px] resize-none"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddMember}
                disabled={
                  newMember.paymentMethod === "Tarjeta de Crédito" &&
                  (!newMember.cardBrand || newMember.cardInstallments < 1)
                }
              >
                Agregar Socio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>;
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o email..."
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
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="expired">
                  Vencidos (hasta 30 días)
                </SelectItem>
                <SelectItem value="inactive">Inactivos (+30 días)</SelectItem>
                <SelectItem value="expiring_soon">
                  Próximo a vencerse (10 días)
                </SelectItem>
                <SelectItem value="custom_expiring">
                  Personalizados por vencer (10 días)
                </SelectItem>
                <SelectItem value="balance_due">Saldo pendiente</SelectItem>
                <SelectItem value="follow_up">Seguimiento pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card key={refreshKey}>
        <CardHeader>
          <CardTitle>Lista de Socios ({filteredMembers.length})</CardTitle>

          {membersWithPartialDueSoon.map((member) => (
            <div
              key={`partial-due-soon-${member.id}`}
              className="mt-2 rounded text-sm border-l-4 border-sky-500 bg-sky-100 p-3 text-sky-700"
            >
              ⚠️ El socio "{member.name}" se le vence una cuota pronto.
            </div>
          ))}

          {membersWithPartialOverdue.length > 0 && (
            <div className="mt-2 text-sm text-rose-700 bg-rose-100 border-l-4 border-rose-500 p-3 rounded flex items-center justify-between">
              <span>
                ⚠️ Tienes {membersWithPartialOverdue.length} socio
                {membersWithPartialOverdue.length === 1 ? "" : "s"} con cuota
                parcial vencida.
              </span>
              <Button
                variant="ghost"
                className="text-rose-700 hover:underline"
                onClick={() => setStatusFilter("balance_due")}
              >
                Ver cuotas parciales vencidas
              </Button>
            </div>
          )}
          {visibleExpiringCustomPlansForAlert.map((plan) => {
            const memberName =
              plan.member_name ||
              members.find((member) => member.id === plan.member_id)?.name ||
              "Socio";
            const formattedEndDate = formatDateForAlert(plan.end_date);

            return (
              <div
                key={`custom-plan-expiring-alert-${plan.id}`}
                className="mt-2 flex items-start justify-between gap-3 rounded border-l-4 border-amber-500 bg-amber-100 p-3 text-sm text-amber-800"
              >
                <span>
                  ⚠️ Al socio "{memberName}" se le está por vencer el plan
                  personalizado en los próximos diez días
                  {formattedEndDate ? ` (vence el ${formattedEndDate}).` : "."}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-amber-700 hover:text-amber-900 hover:bg-amber-200"
                  onClick={() => handleDismissCustomPlanAlert(plan.id)}
                  aria-label="Descartar alerta de plan personalizado"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {expiringMembers.length > 0 && (
            <div className="mt-2 text-sm text-orange-700 bg-orange-100 border-l-4 border-orange-500 p-3 rounded flex justify-between items-center">
              ⚠️ Tienes {expiringMembers.length} socios con vencimiento próximo
              (menos de 10 días).
              <Button
                variant="ghost"
                className="text-orange-700 hover:underline"
                onClick={() => setStatusFilter("expiring_soon")}
              >
                Ver socios por vencer
              </Button>
            </div>
          )}

          {expiredMembers.length > 0 && (
            <div className="mt-2 text-sm text-rose-700 bg-rose-100 border-l-4 border-rose-500 p-3 rounded flex items-center justify-between">
              <span>
                ⚠️ Tienes {expiredMembers.length} socio
                {expiredMembers.length === 1 ? "" : "s"} con cuota vencida.
              </span>
              <Button
                variant="ghost"
                className="text-rose-700 hover:underline"
                onClick={() => setStatusFilter("expired")}
              >
                Ver socios vencidos
              </Button>
            </div>
          )}

          {expiringCustomPlanMembersCount > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 text-amber-800">
                  <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">
                      {expiringCustomPlanMembersCount} socio
                      {expiringCustomPlanMembersCount === 1 ? "" : "s"} con plan
                      personalizado próximo
                      {expiringCustomPlanMembersCount === 1 ? "" : "s"} a vencer
                      (10 días).
                    </p>
                    <p className="text-xs text-amber-700">
                      Revisa estos planes para renovar o contactar a los socios.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-700 hover:text-amber-800 hover:underline"
                  onClick={() => setStatusFilter("custom_expiring")}
                >
                  Ver personalizados por vencer
                </Button>
              </div>
            </div>
          )}

          {membersToFollowUp.length > 0 && (
            <div className="mt-2 text-sm text-yellow-700 bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded flex items-center justify-between">
              <span>
                ⚠️ Tienes socios que ingresaron hace entre 5 y 12 días y aún no
                fueron contactados.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-4"
                onClick={() => setStatusFilter("follow_up")}
              >
                Ver socios pendientes
              </Button>
            </div>
          )}
        </CardHeader>
        {filteredMembers.length === 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            {debouncedSearch
              ? "No hay socios que coincidan con la búsqueda/estado."
              : "Aún no hay socios para mostrar con este filtro."}
          </div>
        )}

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Plan actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fin del plan</TableHead>
                <TableHead>Días Restantes</TableHead>
                <TableHead>Próxima cuota</TableHead>
                <TableHead>Saldo Pendiente</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedMembers.map((member) => {
                const daysUntilExpiration = getDaysUntilExpiration(
                  member.next_payment
                );
                const customPlan = latestCustomPlanByMember.get(member.id);
                const parsedCustomPlanEndDate = customPlan?.end_date
                  ? toLocalDate(customPlan.end_date)
                  : null;
                const customPlanEndDate =
                  parsedCustomPlanEndDate &&
                  !Number.isNaN(parsedCustomPlanEndDate.getTime())
                    ? parsedCustomPlanEndDate.toLocaleDateString()
                    : customPlan?.end_date ?? null;
                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.phone || "-"}</TableCell>
                    <TableCell>
                      <div>
                        {member.plan} - ${member.plan_price}
                      </div>
                      {customPlan && customPlanEndDate && (
                        <div className="ml-4 text-sm text-muted-foreground">
                          {(customPlan.name?.trim() || "Personalizado")} - {customPlanEndDate}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(
                        getRealStatus(member),
                        member.inactive_level
                      )}
                    </TableCell>
                    <TableCell>
                      {member.next_payment
                        ? toLocalDate(member.next_payment).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${
                          daysUntilExpiration < 0
                            ? Math.abs(daysUntilExpiration) > 30
                              ? "text-gray-600"
                              : "text-red-600"
                            : daysUntilExpiration <= 7
                            ? "text-orange-600"
                            : "text-green-600"
                        }`}
                      >
                        {daysUntilExpiration < 0
                          ? Math.abs(daysUntilExpiration) > 30
                            ? `${Math.abs(daysUntilExpiration)} días inactivo`
                            : `${Math.abs(daysUntilExpiration)} días vencido`
                          : daysUntilExpiration === 0
                          ? "Vence hoy"
                          : `${daysUntilExpiration} días`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {member.next_installment_due
                        ? toLocalDate(
                            member.next_installment_due
                          ).toLocaleDateString()
                        : member.next_payment
                        ? toLocalDate(member.next_payment).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {(member.balance_due ?? 0) > 0 ? (
                        <span className="text-red-600 font-semibold">
                          {`$${(member.balance_due ?? 0).toFixed(2)}`}
                        </span>
                      ) : (
                        "$0.00"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsFollowedUp(member.id)}
                        >
                          <span role="img" aria-label="check">
                            ✅
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingMember(member);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMember(member.id)}
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
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredMembers.length > 0 && (
                <>
                  Mostrando <strong>{displayedMembers.length}</strong> de{" "}
                  <strong>{filteredMembers.length}</strong> socios cargados
                </>
              )}
            </div>
            {canLoadMore && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleLoadMore}>
                  Cargar más socios
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
            <DialogTitle>Editar Socio</DialogTitle>
            <DialogDescription>Modifica los datos del socio.</DialogDescription>
          </DialogHeader>
          {editingMember && (
            <div className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Nombre completo</Label>
                  <Input
                    id="edit-name"
                    value={editingMember.name}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
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
                    value={editingMember.email}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Teléfono</Label>
                  <Input
                    id="edit-phone"
                    value={editingMember.phone}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-next-payment">Fin del plan</Label>
                  <Input
                    id="edit-next-payment"
                    type="date"
                    value={editingMember.next_payment}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        next_payment: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-next-installment">
                    Vencimiento próxima cuota
                  </Label>
                  <Input
                    id="edit-next-installment"
                    type="date"
                    value={
                      editingMember.next_installment_due ||
                      editingMember.next_payment ||
                      ""
                    }
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        next_installment_due: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Actualiza cuándo debería pagarse la próxima cuota pendiente.
                  </p>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="edit-description">Descripción</Label>
                  <Textarea
                    id="edit-description"
                    ref={editDescriptionRef}
                    value={editingMember.description || ""}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setEditingMember({
                        ...editingMember,
                        description: value,
                      });
                      const textarea = e.currentTarget;
                      textarea.style.height = "auto";
                      textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    placeholder="Notas adicionales del socio"
                    className="min-h-[220px] resize-none overflow-hidden"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleEditMember}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       {visibleLongTermPlanFollowUps.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
          {visibleLongTermPlanFollowUps.map((alert) => (
            <div
              key={alert.memberId}
              className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 shadow-lg"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
              <div className="flex-1">
                <p className="font-semibold">
                  Debes contactar a {alert.memberName}
                </p>
                <p className="text-xs text-sky-700">
                  Su plan {alert.planName} ya cumplió 120 días. Alerta de seguimiento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDismissLongPlanAlert(alert.memberId)}
                className="ml-2 text-sky-600 transition hover:text-sky-800"
                aria-label={`Descartar alerta de seguimiento para ${alert.memberName}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
