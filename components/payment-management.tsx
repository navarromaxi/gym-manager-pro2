"use client";

import { useState, useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Search, DollarSign, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Member, Payment, Plan, PlanContract } from "@/lib/supabase";

interface PaymentManagementProps {
  payments: Payment[];
  setPayments: Dispatch<SetStateAction<Payment[]>>;
  members: Member[];
  setMembers: Dispatch<SetStateAction<Member[]>>;
  plans: Plan[];
  gymId: string;
}

interface PaymentInsight {
  isInstallment: boolean;
  balancePending: number | null;
  planPrice: number | null;
}

interface MemberInstallmentState {
  balance: number;
  planPrice: number | null;
  installmentActive: boolean;
}

export function PaymentManagement({
  payments = [],
  setPayments,
  members = [],
  setMembers,
  plans = [],
  gymId,
}: PaymentManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editPaymentData, setEditPaymentData] = useState({
    amount: 0,
    date: new Date().toLocaleDateString("en-CA"),
    method: "",
    cardBrand: "",
    cardInstallments: 1,
    description: "",
    startDate: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [newPayment, setNewPayment] = useState({
    memberId: "",
    planId: "",
    method: "",
    cardBrand: "",
    cardInstallments: 1,
    date: new Date().toLocaleDateString("en-CA"),
    startDate: new Date().toLocaleDateString("en-CA"),
    type: "new_plan" as "new_plan" | "existing_plan" | "product",
    description: "",
    amount: 0,
    installments: 1,
    nextInstallmentDue: new Date().toLocaleDateString("en-CA"),
  });
  const [planContract, setPlanContract] = useState<PlanContract | null>(null);
  const [methodFilter, setMethodFilter] = useState("all");
  const [contractTable, setContractTable] = useState<
    "plan_contracts" | "plan_contract" | null
  >(null);

  useEffect(() => {
    const checkTable = async () => {
      const { error: errorContracts } = await supabase
        .from("plan_contracts")
        .select("id", { head: true })
        .limit(1);

      if (!errorContracts) {
        setContractTable("plan_contracts");
        return;
      }

      const { error: errorContract } = await supabase
        .from("plan_contract")
        .select("id", { head: true })
        .limit(1);

      if (!errorContract) {
        setContractTable("plan_contract");
        return;
      }

      setContractTable(null);
    };
    checkTable();
  }, []);
  const paymentMethods = [
    "Efectivo",
    "Transferencia",
    "Tarjeta de Débito",
    "Tarjeta de Crédito",
  ];

  const cardBrands = ["Visa", "Mastercard", "American Express", "Otra"];

   const getPlanPrice = (payment: Payment) => {
    if (payment.plan_id) {
      const planById = plans.find((plan) => plan.id === payment.plan_id);
      if (planById) return planById.price;
    }
    if (payment.plan) {
      const planByName = plans.find((plan) => plan.name === payment.plan);
      if (planByName) return planByName.price;
    }
    return 0;
  };

  const getEffectivePaymentDate = (payment: Payment) =>
    payment.start_date && payment.start_date.trim() !== ""
      ? payment.start_date
      : payment.date;

  const findLatestPlanPaymentDate = (list: Payment[], memberId: string) => {
    const relevantPayments = list.filter(
      (payment) => payment.member_id === memberId && payment.type === "plan"
    );

    if (relevantPayments.length === 0) {
      return null;
    }

    const latestPayment = relevantPayments.reduce((latest, current) => {
      const latestDate = parseLocalDate(getEffectivePaymentDate(latest));
      const currentDate = parseLocalDate(getEffectivePaymentDate(current));
      return currentDate > latestDate ? current : latest;
    });

    return getEffectivePaymentDate(latestPayment);
  };

  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const updateMemberAfterPlanEdit = async (
    originalPayment: Payment,
    updatedPaymentsList: Payment[],
    newAmount: number
  ) => {
    const member = members.find((m) => m.id === originalPayment.member_id);
    if (!member) return;

    const delta = newAmount - originalPayment.amount;
    const currentBalance = member.balance_due || 0;
    const updatedBalance = Math.max(currentBalance - delta, 0);
    const latestDate = findLatestPlanPaymentDate(
      updatedPaymentsList,
      member.id
    );

    const memberUpdate: Record<string, any> = {
      balance_due: updatedBalance,
      last_payment: latestDate ?? null,
    };

    const { error: memberError } = await supabase
      .from("members")
      .update(memberUpdate)
      .eq("id", member.id);

    if (memberError) throw memberError;

    setMembers((prevMembers) =>
      prevMembers.map((m) =>
        m.id === member.id
          ? {
              ...m,
              balance_due: updatedBalance,
              last_payment: latestDate ?? "",
            }
          : m
      )
    );
  };

  const revertMemberAfterPlanDeletion = async (
    removedPayment: Payment,
    remainingPayments: Payment[]
  ) => {
    const member = members.find((m) => m.id === removedPayment.member_id);
    if (!member) return;

    const currentBalance = member.balance_due || 0;
    let updatedBalance = currentBalance;

    if (removedPayment.start_date) {
      const planPrice = getPlanPrice(removedPayment);
      updatedBalance = Math.max(
        currentBalance - planPrice + removedPayment.amount,
        0
      );
    } else {
      updatedBalance = Math.max(currentBalance + removedPayment.amount, 0);
    }

    const latestDate = findLatestPlanPaymentDate(remainingPayments, member.id);

    const memberUpdate: Record<string, any> = {
      balance_due: updatedBalance,
      last_payment: latestDate ?? null,
    };

    const { error: memberError } = await supabase
      .from("members")
      .update(memberUpdate)
      .eq("id", member.id);

    if (memberError) throw memberError;

    setMembers((prevMembers) =>
      prevMembers.map((m) =>
        m.id === member.id
          ? {
              ...m,
              balance_due: updatedBalance,
              last_payment: latestDate ?? "",
            }
          : m
      )
    );
  };

  const adjustContractAfterPlanDeletion = async (payment: Payment) => {
    if (!contractTable || !payment.plan_id) return;

    try {
      const { data, error } = await supabase
        .from(contractTable)
        .select("*")
        .eq("member_id", payment.member_id)
        .eq("plan_id", payment.plan_id)
        .maybeSingle();

      if (error) {
        console.warn("Error obteniendo contrato de plan:", error);
        return;
      }

      if (!data) return;

      const contract = data as PlanContract;
      const newInstallmentsPaid = Math.max((contract.installments_paid || 0) - 1, 0);

      if (newInstallmentsPaid <= 0) {
        const { error: deleteError } = await supabase
          .from(contractTable)
          .delete()
          .eq("id", contract.id);
        if (deleteError) {
          console.warn("Error eliminando contrato de plan:", deleteError);
        }
      } else {
        const { error: updateError } = await supabase
          .from(contractTable)
          .update({ installments_paid: newInstallmentsPaid })
          .eq("id", contract.id);
        if (updateError) {
          console.warn("Error actualizando contrato de plan:", updateError);
        }
      }
    } catch (error) {
      console.warn("Error ajustando contrato tras eliminar pago:", error);
    }
  };

   const paymentInsights = useMemo(() => {
    const planIdMap = new Map<string, Plan>();
    const planNameMap = new Map<string, Plan>();
    plans.forEach((plan) => {
      planIdMap.set(plan.id, plan);
      planNameMap.set(plan.name, plan);
    });

    const memberMap = new Map<string, Member>();
    members.forEach((member) => {
      memberMap.set(member.id, member);
    });

    const memberStates = new Map<string, MemberInstallmentState>();
    const insights = new Map<string, PaymentInsight>();

    const getTimeValue = (value: string) => {
      const parsed = parseLocalDate(value);
      const time = parsed.getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    const orderedPayments = [...payments].sort(
      (a, b) => getTimeValue(a.date) - getTimeValue(b.date)
    );

    orderedPayments.forEach((payment) => {
      const previousState =
        memberStates.get(payment.member_id) ?? {
          balance: 0,
          planPrice: null,
          installmentActive: false,
        };

      if (payment.type !== "plan") {
        memberStates.set(payment.member_id, previousState);
        insights.set(payment.id, {
          isInstallment: false,
          balancePending: null,
          planPrice: null,
        });
        return;
      }

      const member = memberMap.get(payment.member_id);
      const planFromId = payment.plan_id
        ? planIdMap.get(payment.plan_id)
        : undefined;
      const planFromName =
        !planFromId && payment.plan ? planNameMap.get(payment.plan) : undefined;
      const effectivePlanPrice =
        planFromId?.price ??
        planFromName?.price ??
        previousState.planPrice ??
        member?.plan_price ??
        null;

      if (payment.start_date) {
        const targetPrice = effectivePlanPrice ?? payment.amount;
        const balanceAfter = Math.max(targetPrice - payment.amount, 0);
        const isInstallment = balanceAfter > 0;

        memberStates.set(payment.member_id, {
          balance: balanceAfter,
          planPrice: targetPrice,
          installmentActive: isInstallment && balanceAfter > 0,
        });

        insights.set(payment.id, {
          isInstallment,
          balancePending: balanceAfter,
          planPrice: targetPrice,
        });
        return;
      }

      const balanceBefore = previousState.balance ?? 0;
      const newBalance = Math.max(balanceBefore - payment.amount, 0);
      const wasInstallment =
        previousState.installmentActive || balanceBefore > 0 || newBalance > 0;

      memberStates.set(payment.member_id, {
        balance: newBalance,
        planPrice: effectivePlanPrice ?? previousState.planPrice,
        installmentActive: newBalance > 0,
      });

      insights.set(payment.id, {
        isInstallment: wasInstallment,
        balancePending: newBalance,
        planPrice:
          effectivePlanPrice ?? previousState.planPrice ?? member?.plan_price ?? null,
      });
    });

    return insights;
  }, [members, payments, plans]);

  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((member) => {
      map.set(member.id, member);
    });
    return map;
  }, [members]);

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

  useEffect(() => {
    const fetchExistingContract = async () => {
      if (
        newPayment.type === "existing_plan" &&
        newPayment.memberId &&
        contractTable
      ) {
        const memberPlan = members.find(
          (m) => m.id === newPayment.memberId
        )?.plan;
        const plan = plans.find((p) => p.name === memberPlan);
        if (plan) {
          const { data, error } = await supabase
            .from(contractTable)
            .select("*")
            .eq("member_id", newPayment.memberId)
            .eq("plan_id", plan.id)
            .single();
          setPlanContract(error ? null : data ?? null);
        } else {
          setPlanContract(null);
        }
      }
    };
    fetchExistingContract();
  }, [newPayment.type, newPayment.memberId, contractTable, members, plans]);

  // Filtrar miembros para el buscador
  const filteredMembersForSearch = members.filter((member) =>
    member.name.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  // Función para obtener pagos filtrados actualizada
  const getFilteredPayments = () => {
    let filtered = (payments || []).filter((payment) =>
      payment.member_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filtro por método de pago
    if (methodFilter !== "all") {
      filtered = filtered.filter((payment) => payment.method === methodFilter);
    }

    if (periodFilter !== "all") {
      const currentDate = new Date();

      filtered = filtered.filter((payment) => {
        const paymentDate = parseLocalDate(payment.date);

        switch (periodFilter) {
          case "current_month":
            return (
              paymentDate.getMonth() === currentDate.getMonth() &&
              paymentDate.getFullYear() === currentDate.getFullYear()
            );
          case "previous_month":
            const previousMonth =
              currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
            const previousYear =
              currentDate.getMonth() === 0
                ? currentDate.getFullYear() - 1
                : currentDate.getFullYear();
            return (
              paymentDate.getMonth() === previousMonth &&
              paymentDate.getFullYear() === previousYear
            );
          case "last_6_months":
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return paymentDate >= sixMonthsAgo;
          case "current_year":
            return paymentDate.getFullYear() === currentDate.getFullYear();
          default:
            return true;
        }
      });
    }

    return filtered.sort(
      (a, b) =>
        parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
    );
  };

  const filteredPayments = getFilteredPayments();

  const selectedMember = members.find((m) => m.id === newPayment.memberId);
  const selectedPlan =
    newPayment.type === "existing_plan"
      ? plans.find((p) => p.name === selectedMember?.plan)
      : plans.find((p) => p.id === newPayment.planId);
  const balanceDueActual = selectedMember?.balance_due || 0;
  const maxPlanAmount =
    newPayment.type === "new_plan" && selectedPlan
      ? planContract
        ? balanceDueActual
        : Math.max(selectedPlan.price + balanceDueActual, 0)
      : 0;


       const calculatedPlanEndDate = useMemo(() => {
    if (newPayment.type !== "new_plan") return "";
    return calculatePlanEndDate(newPayment.startDate, selectedPlan);
  }, [newPayment.type, newPayment.startDate, selectedPlan]);

  const nextInstallmentDueValue =
    newPayment.type === "new_plan"
      ? newPayment.installments === 1
        ? calculatedPlanEndDate
        : newPayment.nextInstallmentDue || calculatedPlanEndDate
      : "";

  // FUNCIÓN ACTUALIZADA PARA REGISTRAR PAGO Y RENOVAR SOCIO
  const handleAddPayment = async () => {
    try {
      if (!selectedMember) return;

      const paymentId = `${gymId}_payment_${Date.now()}`;

      if (newPayment.type === "new_plan") {
        if (!selectedPlan) return;
        if (newPayment.amount <= 0) {
          alert("El monto debe ser mayor a 0");
          return;
        }
        if (newPayment.amount > maxPlanAmount) {
          alert(
            `El monto no puede ser mayor a ${maxPlanAmount.toLocaleString()}`
          );
          return;
        }
         if (
          newPayment.installments > 1 &&
          (!newPayment.nextInstallmentDue || newPayment.nextInstallmentDue === "")
        ) {
          alert("Debes ingresar el vencimiento de la próxima cuota");
          return;
        }

        let currentContract = planContract;
        const contractId =
          planContract?.id || `${newPayment.memberId}_contract_${Date.now()}`;

        const isFirstInstallment = !currentContract;

        if (isFirstInstallment && contractTable) {
          const newContract: PlanContract = {
            id: contractId,
            gym_id: gymId,
            member_id: newPayment.memberId,
            plan_id: selectedPlan.id,
            installments_total: newPayment.installments,
            installments_paid: 1,
          };
          const { error: contractError } = await supabase
            .from(contractTable)
            .insert([newContract]);
          if (contractError) {
            console.warn("Error registrando contrato de plan:", contractError);
          } else {
            currentContract = newContract;
            setPlanContract(currentContract);
          }
        } else if (currentContract && contractTable) {
          const { error: contractError } = await supabase
            .from(contractTable)
            .update({
              installments_paid: currentContract.installments_paid + 1,
            })
            .eq("id", currentContract.id);
          if (contractError) {
            console.warn("Error actualizando contrato de plan:", contractError);
          }
          currentContract = {
            ...currentContract,
            installments_paid: currentContract.installments_paid + 1,
          };
          setPlanContract(currentContract);
        }

        const payment: Payment = {
          id: paymentId,
          gym_id: gymId,
          member_id: newPayment.memberId,
          member_name: selectedMember.name,
          amount: newPayment.amount,
          date: newPayment.date,
          start_date: newPayment.startDate,
          plan: selectedPlan.name,
          method: newPayment.method,
          card_brand:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardBrand
              : undefined,
          card_installments:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardInstallments
              : undefined,
          type: "plan",
          description: newPayment.description || undefined,
          plan_id: selectedPlan.id,
        };

        const { error: paymentError } = await supabase
          .from("payments")
          .insert([payment]);
        if (paymentError) throw paymentError;

        // Actualizar el socio con el nuevo plan
        const planStart = parseLocalDate(newPayment.startDate);
        const nextPayment = new Date(planStart);

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
          newPayment.installments === 1
            ? nextPaymentISO
            : newPayment.nextInstallmentDue || nextPaymentISO;

        const newBalance = isFirstInstallment
          ? balanceDueActual + selectedPlan.price - newPayment.amount
          : balanceDueActual - newPayment.amount;

        const { error: memberError } = await supabase
          .from("members")
          .update({
            plan: selectedPlan.name,
            plan_price: selectedPlan.price,
            balance_due: Math.max(newBalance, 0),
            last_payment: newPayment.startDate,
            next_payment: nextPaymentISO,
            next_installment_due: nextInstallmentDue,
            status: "active",
          })
          .eq("id", selectedMember.id);
        if (memberError) throw memberError;

        const updatedMember = {
          ...selectedMember,
          plan: selectedPlan.name,
          plan_price: selectedPlan.price,
          balance_due: Math.max(newBalance, 0),
          last_payment: newPayment.startDate,
          next_payment: nextPaymentISO,
          next_installment_due: nextInstallmentDue,
          status: "active" as const,
        };

        setPayments([...payments, payment]);
        setMembers(
          members.map((m) => (m.id === selectedMember.id ? updatedMember : m))
        );
      } else if (newPayment.type === "existing_plan") {
        if (!selectedPlan) return;
        if (newPayment.amount <= 0) {
          alert("El monto debe ser mayor a 0");
          return;
        }
        if (newPayment.amount > balanceDueActual) {
          alert(
            `El monto no puede ser mayor a ${balanceDueActual.toLocaleString()}`
          );
          return;
        }

        if (planContract && contractTable) {
          const { error: contractError } = await supabase
            .from(contractTable)
            .update({
              installments_paid: planContract.installments_paid + 1,
            })
            .eq("id", planContract.id);
          if (contractError) {
            console.warn("Error actualizando contrato de plan:", contractError);
          } else {
            setPlanContract({
              ...planContract,
              installments_paid: planContract.installments_paid + 1,
            });
          }
        }

        const payment: Payment = {
          id: paymentId,
          gym_id: gymId,
          member_id: newPayment.memberId,
          member_name: selectedMember.name,
          amount: newPayment.amount,
          date: newPayment.date,
          plan: selectedMember.plan,
          method: newPayment.method,
          card_brand:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardBrand
              : undefined,
          card_installments:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardInstallments
              : undefined,
          type: "plan",
          description: newPayment.description || undefined,
          plan_id: selectedPlan.id,
        };

        const { error: paymentError } = await supabase
          .from("payments")
          .insert([payment]);
        if (paymentError) throw paymentError;

        const newBalance = balanceDueActual - newPayment.amount;

        const { error: memberError } = await supabase
          .from("members")
          .update({
            balance_due: Math.max(newBalance, 0),
            last_payment: newPayment.date,
            status: "active",
          })
          .eq("id", selectedMember.id);
        if (memberError) throw memberError;

        const updatedMember = {
          ...selectedMember,
          balance_due: Math.max(newBalance, 0),
          last_payment: newPayment.date,
          status: "active" as const,
        };

        setPayments([...payments, payment]);
        setMembers(
          members.map((m) => (m.id === selectedMember.id ? updatedMember : m))
        );
      } else {
        const payment: Payment = {
          id: paymentId,
          gym_id: gymId,
          member_id: newPayment.memberId,
          member_name: selectedMember.name,
          amount: newPayment.amount,
          date: newPayment.date,
          method: newPayment.method,
          card_brand:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardBrand
              : undefined,
          card_installments:
            newPayment.method === "Tarjeta de Crédito"
              ? newPayment.cardInstallments
              : undefined,
          type: "product",
          description: newPayment.description,
          plan: newPayment.description,
        };

        const { error: paymentError } = await supabase
          .from("payments")
          .insert([payment]);
        if (paymentError) throw paymentError;

        setPayments([...payments, payment]);
      }

      // Limpiar formulario
      setNewPayment({
        memberId: "",
        planId: "",
        method: "",
        cardBrand: "",
        cardInstallments: 1,
        date: new Date().toLocaleDateString("en-CA"),
        startDate: new Date().toLocaleDateString("en-CA"),
        type: "new_plan",
        description: "",
        amount: 0,
        installments: 1,
        nextInstallmentDue: new Date().toLocaleDateString("en-CA"),
      });
      setMemberSearchTerm("");
      setPlanContract(null);
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error registrando pago:", error);
      alert("Error al registrar el pago. Inténtalo de nuevo.");
    }
  };

  const openEditDialog = (payment: Payment) => {
    setEditingPayment(payment);
    setEditPaymentData({
      amount: payment.amount,
      date: payment.date,
      method: payment.method,
      cardBrand: payment.card_brand || "",
      cardInstallments: payment.card_installments || 1,
      description: payment.description || "",
      startDate: payment.start_date || "",
    });
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPayment(null);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;

    if (editPaymentData.amount <= 0) {
      alert("El monto debe ser mayor a 0");
      return;
    }

    if (!editPaymentData.method) {
      alert("Selecciona un método de pago");
      return;
    }

    try {
      const paymentUpdate: Record<string, any> = {
        amount: editPaymentData.amount,
        date: editPaymentData.date,
        method: editPaymentData.method,
        card_brand:
          editPaymentData.method === "Tarjeta de Crédito"
            ? editPaymentData.cardBrand
            : null,
        card_installments:
          editPaymentData.method === "Tarjeta de Crédito"
            ? editPaymentData.cardInstallments
            : null,
        description: editPaymentData.description || null,
      };

      if (typeof editingPayment.start_date === "string") {
        paymentUpdate.start_date = editPaymentData.startDate || null;
      }

      const { error: updateError } = await supabase
        .from("payments")
        .update(paymentUpdate)
        .eq("id", editingPayment.id);

      if (updateError) throw updateError;

      const updatedPayment: Payment = {
        ...editingPayment,
        amount: editPaymentData.amount,
        date: editPaymentData.date,
        method: editPaymentData.method,
        card_brand:
          editPaymentData.method === "Tarjeta de Crédito"
            ? editPaymentData.cardBrand
            : undefined,
        card_installments:
          editPaymentData.method === "Tarjeta de Crédito"
            ? editPaymentData.cardInstallments
            : undefined,
        description: editPaymentData.description || undefined,
        ...(typeof editingPayment.start_date === "string"
          ? { start_date: editPaymentData.startDate || undefined }
          : {}),
      };

      const updatedPayments = payments.map((payment) =>
        payment.id === editingPayment.id ? updatedPayment : payment
      );

      if (editingPayment.type === "plan") {
        await updateMemberAfterPlanEdit(
          editingPayment,
          updatedPayments,
          editPaymentData.amount
        );
      }

      setPayments(updatedPayments);
      closeEditDialog();
    } catch (error) {
      console.error("Error actualizando pago:", error);
      alert("Error al actualizar el pago. Inténtalo de nuevo.");
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar este pago?"
    );
    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase
        .from("payments")
        .delete()
        .eq("id", payment.id);

      if (deleteError) throw deleteError;

      const remainingPayments = payments.filter((p) => p.id !== payment.id);

      if (payment.type === "plan") {
        await revertMemberAfterPlanDeletion(payment, remainingPayments);
        await adjustContractAfterPlanDeletion(payment);
      }

      setPayments(remainingPayments);
    } catch (error) {
      console.error("Error eliminando pago:", error);
      alert("Error al eliminar el pago. Inténtalo de nuevo.");
    }
  };


  const totalPayments = filteredPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
  const currentMonthPayments = payments.filter((payment) => {
    const paymentDate = parseLocalDate(payment.date);
    const currentDate = new Date();
    return (
      paymentDate.getMonth() === currentDate.getMonth() &&
      paymentDate.getFullYear() === currentDate.getFullYear()
    );
  });

  // Calcular estadísticas por método de pago del mes actual
  const currentMonthPaymentsByMethod = currentMonthPayments.reduce(
    (acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthlyTotal = currentMonthPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Pagos
          </h2>
          <p className="text-muted-foreground">
            Registra pagos y renueva planes de socios existentes
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Registrar Pago de Socio</DialogTitle>
              <DialogDescription>
                Registra el pago de un socio existente. Si es un plan, se
                renovará automáticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto">
              {/* BUSCADOR DE SOCIOS */}
              <div className="grid gap-2">
                <Label htmlFor="member-search">Buscar Socio</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="member-search"
                    placeholder="Buscar por nombre..."
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {memberSearchTerm && (
                  <div className="max-h-32 overflow-y-auto border rounded-md">
                    {filteredMembersForSearch.length > 0 ? (
                      filteredMembersForSearch.map((member) => (
                        <div
                          key={member.id}
                           className={`p-2 cursor-pointer transition-colors border-b last:border-b-0 hover:bg-blue-500/10 dark:hover:bg-blue-500/30 ${
                            newPayment.memberId === member.id
                              ? "bg-blue-500/20 dark:bg-blue-500/40"
                              : ""
                          }`}
                          onClick={() => {
                            setNewPayment({
                              ...newPayment,
                              memberId: member.id,
                              planId: "",
                              installments: 1,
                              nextInstallmentDue:
                                member.next_installment_due ||
                                new Date().toLocaleDateString("en-CA"),
                            });
                            setMemberSearchTerm(member.name);
                            setPlanContract(null);
                          }}
                        >
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Plan actual: {member.plan} - Estado: {member.status}
                          </div>
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

              {/* TIPO DE PAGO */}
              <div className="grid gap-2">
                <Label htmlFor="plan">Pago de:</Label>
                <Select
                  value={newPayment.type}
                  onValueChange={(value) => {
                    setNewPayment({
                      ...newPayment,
                      type: value as "new_plan" | "existing_plan" | "product",
                      planId: "",
                      description: "",
                      amount: 0,
                      installments: 1,
                      nextInstallmentDue: new Date().toLocaleDateString("en-CA"),
                    });
                    setPlanContract(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_plan">Nuevo plan</SelectItem>
                    <SelectItem value="existing_plan">
                      Plan existente
                    </SelectItem>
                    <SelectItem value="product">Producto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SELECCIÓN DE PLAN */}
              {newPayment.type === "new_plan" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="plan">Nuevo Plan</Label>
                    <Select
                      value={newPayment.planId}
                      onValueChange={async (value) => {
                        const selectedPlanOption = plans.find(
                          (plan) => plan.id === value
                        );
                        const computedNext = calculatePlanEndDate(
                          newPayment.startDate,
                          selectedPlanOption
                        );
                        setNewPayment({
                          ...newPayment,
                          planId: value,
                          installments: 1,
                           nextInstallmentDue: computedNext,
                        });
                        if (newPayment.memberId && contractTable) {
                          let { data, error } = await supabase
                            .from(contractTable)
                            .select("*")
                            .eq("member_id", newPayment.memberId)
                            .eq("plan_id", value)
                            .single();
                          if (error) {
                            const fallback = await supabase
                              .from("plan_contract")
                              .select("*")
                              .eq("member_id", newPayment.memberId)
                              .eq("plan_id", value)
                              .single();
                            data = fallback.data;
                          }
                          setPlanContract(data ?? null);
                          if (data) {
                            setNewPayment((prev) => ({
                              ...prev,
                              installments: data.installments_total,
                               nextInstallmentDue:
                                prev.nextInstallmentDue ||
                                selectedMember?.next_installment_due ||
                                computedNext,
                            }));
                          }
                        } else {
                          setPlanContract(null);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el plan a renovar" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans
                          .filter((plan) => plan.is_active)
                          .map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - ${plan.price.toLocaleString()}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {newPayment.planId && !planContract && (
                      <div className="grid gap-2">
                        <Label htmlFor="installments">Cantidad de cuotas</Label>
                        <Select
                          value={newPayment.installments.toString()}
                          onValueChange={(value) =>
                             {
                              const installments = parseInt(value);
                              const computedNext = calculatePlanEndDate(
                                newPayment.startDate,
                                selectedPlan
                              );
                              setNewPayment({
                                ...newPayment,
                                installments,
                                nextInstallmentDue:
                                  installments === 1
                                    ? computedNext
                                    : newPayment.nextInstallmentDue ||
                                      computedNext,
                              });
                            }
                          }
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
                    )}
                    {newPayment.planId && planContract && (
                      <div className="text-sm text-muted-foreground">
                        Cuotas pagadas: {planContract.installments_paid} /{" "}
                        {planContract.installments_total}
                      </div>
                    )}
                  </div>
                  {newPayment.planId && (
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Monto</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={newPayment.amount}
                        max={maxPlanAmount}
                        onChange={(e) =>
                          setNewPayment({
                            ...newPayment,
                            amount: Number(e.target.value),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Monto máximo: ${maxPlanAmount.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {newPayment.planId && (
                    <div className="grid gap-2">
                      <Label htmlFor="nextInstallmentDue">
                        Vencimiento próxima cuota
                      </Label>
                      <Input
                        id="nextInstallmentDue"
                        type="date"
                        value={nextInstallmentDueValue}
                        onChange={(e) =>
                          setNewPayment({
                            ...newPayment,
                            nextInstallmentDue: e.target.value,
                          })
                        }
                        disabled={newPayment.installments === 1}
                      />
                      <p className="text-xs text-muted-foreground">
                        {newPayment.installments === 1
                          ? "Se utilizará la misma fecha que el fin del plan."
                          : "Registra cuándo debería abonarse la próxima cuota."}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* PAGO DE PLAN EXISTENTE */}
              {newPayment.type === "existing_plan" && selectedMember && (
                <>
                  <div className="grid gap-2">
                    <Label>Plan actual</Label>
                    <Input value={selectedMember.plan} disabled />
                    <p className="text-xs text-muted-foreground">
                      Saldo actual: ${balanceDueActual.toLocaleString()}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Monto a abonar</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={newPayment.amount}
                      max={balanceDueActual}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          amount: Number(e.target.value),
                        })
                      }
                    />
                    {newPayment.amount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Saldo restante: $
                        {Math.max(
                          balanceDueActual - newPayment.amount,
                          0
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* CAMPOS DE PRODUCTO */}
              {newPayment.type === "product" && (
                <div className="grid gap-2">
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newPayment.amount}
                    onChange={(e) =>
                      setNewPayment({
                        ...newPayment,
                        amount: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              )}

              {/* MÉTODO DE PAGO */}
              <div className="grid gap-2">
                <Label htmlFor="method">Método de Pago</Label>
                <Select
                  value={newPayment.method}
                  onValueChange={(value) =>
                    setNewPayment({ ...newPayment, method: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método" />
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

              {newPayment.method === "Tarjeta de Crédito" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="cardBrand">Tipo de Tarjeta</Label>
                    <Select
                      value={newPayment.cardBrand}
                      onValueChange={(value) =>
                        setNewPayment({ ...newPayment, cardBrand: value })
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
                    <Label htmlFor="cardInstallments">
                      Número de cuotas en la tarjeta
                    </Label>
                    <Input
                      id="cardInstallments"
                      type="number"
                      min={1}
                      value={newPayment.cardInstallments}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          cardInstallments: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </>
              )}

              {/* FECHA */}
              <div className="grid gap-2">
                <Label htmlFor="date">Fecha del Pago</Label>
                <Input
                  id="date"
                  type="date"
                  value={newPayment.date}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, date: e.target.value })
                  }
                />
              </div>

              {newPayment.type === "new_plan" && (
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Fecha de inicio del plan</Label>
                   <Input
                  id="startDate"
                  type="date"
                  value={newPayment.startDate}
                  onChange={(e) =>
                    {
                      const value = e.target.value;
                      const computedNext = calculatePlanEndDate(
                        value,
                        selectedPlan
                      );
                      setNewPayment({
                        ...newPayment,
                         startDate: value,
                        nextInstallmentDue:
                          newPayment.installments === 1
                            ? computedNext
                            : newPayment.nextInstallmentDue || computedNext,
                      });
                    }
                   }
                />
                  <p className="text-xs text-muted-foreground">
                    El plan se calculará desde esta fecha (útil si se registra
                    con atraso)
                  </p>
                </div>
              )}

               {/* DESCRIPCIÓN */}
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={newPayment.description}
                  onChange={(e) =>
                    setNewPayment({
                      ...newPayment,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              {/* RESUMEN */}
              {newPayment.type === "new_plan" &&
                newPayment.memberId &&
                newPayment.planId &&
                newPayment.amount > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">
                      Resumen de Renovación
                    </h4>
                    <div className="text-sm text-green-700">
                      <p>
                        <strong>Socio:</strong>{" "}
                        {
                          members.find((m) => m.id === newPayment.memberId)
                            ?.name
                        }
                      </p>
                      <p>
                        <strong>Plan:</strong>{" "}
                        {plans.find((p) => p.id === newPayment.planId)?.name}
                      </p>
                      <p>
                        <strong>Monto:</strong> $
                        {newPayment.amount.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs">
                        ✅ El socio se activará y se actualizará su próximo
                        vencimiento
                      </p>
                    </div>
                  </div>
                )}
              {newPayment.type === "existing_plan" &&
                newPayment.memberId &&
                newPayment.amount > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">
                      Resumen de Pago
                    </h4>
                    <div className="text-sm text-green-700">
                      <p>
                        <strong>Socio:</strong>{" "}
                        {
                          members.find((m) => m.id === newPayment.memberId)
                            ?.name
                        }
                      </p>
                      <p>
                        <strong>Plan:</strong> {selectedMember?.plan}
                      </p>
                      <p>
                        <strong>Monto:</strong> $
                        {newPayment.amount.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs">
                        Saldo restante: $
                        {Math.max(
                          balanceDueActual - newPayment.amount,
                          0
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              {newPayment.type === "product" &&
                newPayment.memberId &&
                newPayment.description &&
                newPayment.amount > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">
                      Resumen de Venta
                    </h4>
                    <div className="text-sm text-green-700">
                      <p>
                        <strong>Socio:</strong>{" "}
                        {
                          members.find((m) => m.id === newPayment.memberId)
                            ?.name
                        }
                      </p>
                      <p>
                        <strong>Descripción:</strong> {newPayment.description}
                      </p>
                      <p>
                        <strong>Monto:</strong> $
                        {newPayment.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddPayment}
                disabled={
                  !newPayment.memberId ||
                  !newPayment.method ||
                  (newPayment.method === "Tarjeta de Crédito" &&
                    !newPayment.cardBrand) ||
                  (newPayment.type === "new_plan"
                    ? !newPayment.planId ||
                      !newPayment.startDate ||
                      !newPayment.amount
                    : newPayment.type === "existing_plan"
                    ? newPayment.amount <= 0
                    : !newPayment.description || !newPayment.amount)
                }
              >
                Registrar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards - AGREGAR TARJETAS DE MÉTODOS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pagos (Filtrado)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPayments.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredPayments.length} pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mes Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonthPayments.length} pagos este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Efectivo (Mes)
            </CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currentMonthPaymentsByMethod["Efectivo"] || 0}
            </div>
            <p className="text-xs text-muted-foreground">pagos en efectivo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Débito (Mes)</CardTitle>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {currentMonthPaymentsByMethod["Tarjeta de Débito"] || 0}
            </div>
            <p className="text-xs text-muted-foreground">pagos con débito</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crédito (Mes)</CardTitle>
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {currentMonthPaymentsByMethod["Tarjeta de Crédito"] || 0}
            </div>
            <p className="text-xs text-muted-foreground">pagos con crédito</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre del socio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
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
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los períodos</SelectItem>
                <SelectItem value="current_month">Mes actual</SelectItem>
                <SelectItem value="previous_month">Mes anterior</SelectItem>
                <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
                <SelectItem value="current_year">Año actual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Monto pagado</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>En cuotas</TableHead>
                <TableHead>Saldo pendiente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {filteredPayments.map((payment) => {
                const insight = paymentInsights.get(payment.id);
                const member = membersById.get(payment.member_id);
                const fallbackBalance =
                  typeof member?.balance_due === "number"
                    ? member.balance_due
                    : null;
                const balanceValue =
                  insight?.balancePending ?? fallbackBalance ?? null;
                  const detailLabel =
                  payment.type === "plan" ? payment.plan : payment.description;
                const rawDetailAmount =
                  payment.type === "plan"
                    ? insight?.planPrice ?? member?.plan_price ?? payment.amount
                    : payment.amount;
                const formattedDetailAmount = new Intl.NumberFormat("es-AR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                  useGrouping: false,
                }).format(rawDetailAmount ?? payment.amount);
                const detailDisplay = detailLabel?.trim()
                  ? `${detailLabel} - $${formattedDetailAmount}`
                  : `Sin detalle - $${formattedDetailAmount}`;

                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {parseLocalDate(payment.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.member_name}
                    </TableCell>
                     <TableCell>{detailDisplay}</TableCell>
                    <TableCell className="font-medium text-green-600">
                      ${payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {payment.method}
                      {payment.card_brand ? ` - ${payment.card_brand}` : ""}
                    </TableCell>
                    <TableCell>
                      {payment.type === "plan" ? (
                        insight?.isInstallment ? (
                          <Badge variant="secondary">Sí</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )
                      ) : (
                        <Badge variant="outline">N/A</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.type === "plan" && balanceValue !== null ? (
                        <span
                          className={
                            balanceValue > 0
                              ? "font-semibold text-amber-600"
                              : "text-muted-foreground"
                          }
                        >
                          ${balanceValue.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{payment.type}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(payment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePayment(payment)}
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
        </CardContent>
      </Card>
       <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingPayment(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar pago</DialogTitle>
            <DialogDescription>
              Actualiza la información del pago seleccionado.
            </DialogDescription>
          </DialogHeader>
          {editingPayment && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Fecha del Pago</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editPaymentData.date}
                  onChange={(e) =>
                    setEditPaymentData({
                      ...editPaymentData,
                      date: e.target.value,
                    })
                  }
                />
              </div>
              {typeof editingPayment.start_date === "string" && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-start-date">Inicio del Plan</Label>
                  <Input
                    id="edit-start-date"
                    type="date"
                    value={editPaymentData.startDate}
                    onChange={(e) =>
                      setEditPaymentData({
                        ...editPaymentData,
                        startDate: e.target.value,
                      })
                    }
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit-amount">Monto</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  min={0}
                  value={editPaymentData.amount}
                  onChange={(e) =>
                    setEditPaymentData({
                      ...editPaymentData,
                      amount: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-method">Método de Pago</Label>
                <Select
                  value={editPaymentData.method}
                  onValueChange={(value) =>
                    setEditPaymentData((prev) => ({
                      ...prev,
                      method: value,
                      cardBrand:
                        value === "Tarjeta de Crédito" ? prev.cardBrand : "",
                      cardInstallments:
                        value === "Tarjeta de Crédito" ? prev.cardInstallments : 1,
                    }))
                  }
                >
                  <SelectTrigger id="edit-method">
                    <SelectValue placeholder="Selecciona método" />
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
              {editPaymentData.method === "Tarjeta de Crédito" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-card-brand">Tipo de Tarjeta</Label>
                    <Select
                      value={editPaymentData.cardBrand}
                      onValueChange={(value) =>
                        setEditPaymentData((prev) => ({
                          ...prev,
                          cardBrand: value,
                        }))
                      }
                    >
                      <SelectTrigger id="edit-card-brand">
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
                    <Label htmlFor="edit-card-installments">
                      Número de cuotas en la tarjeta
                    </Label>
                    <Input
                      id="edit-card-installments"
                      type="number"
                      min={1}
                      value={editPaymentData.cardInstallments}
                      onChange={(e) =>
                        setEditPaymentData({
                          ...editPaymentData,
                          cardInstallments: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Input
                  id="edit-description"
                  value={editPaymentData.description}
                  onChange={(e) =>
                    setEditPaymentData({
                      ...editPaymentData,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePayment}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
