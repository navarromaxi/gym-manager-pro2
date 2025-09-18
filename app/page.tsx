
// ESTE ARCHIVO ES EL QUE MANEJA LA ENTRADA AL SOFTWARE

"use client";
//import { LoginSystem } from "@/components/login-system";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Calendar,
  UserPlus,
} from "lucide-react";

import type { MemberManagementProps } from "@/components/member-management";
import dynamic from "next/dynamic";

const LoginSystem = dynamic(
  () => import("@/components/login-system").then((m) => m.LoginSystem),
  { ssr: false }
);

// Carga perezosa (client-only) con un fallback liviano
const MemberManagement = dynamic(
  () =>
    import("@/components/member-management").then((m) => m.MemberManagement),
  {
    ssr: false,
    loading: () => <div className="p-4 text-sm">Cargando socios…</div>,
  }
) as React.ComponentType<any>;

const PaymentManagement = dynamic(
  () =>
    import("@/components/payment-management").then((m) => m.PaymentManagement),
  {
    ssr: false,
    loading: () => <div className="p-4 text-sm">Cargando pagos…</div>,
  }
);

const ProspectManagement = dynamic(
  () =>
    import("@/components/prospect-management").then(
      (m) => m.ProspectManagement
    ),
  { ssr: false }
);

const ExpenseManagement = dynamic<any>(
  () =>
    import("@/components/expense-management").then((m) => m.ExpenseManagement),
  { ssr: false }
);

const ReportsSection = dynamic<any>(
  () => import("@/components/reports-section").then((m) => m.ReportsSection),
  { ssr: false }
);

const PlanManagement = dynamic<any>(
  () => import("@/components/plan-management").then((m) => m.PlanManagement),
  { ssr: false }
);

const CustomPlanManagement = dynamic(
  () =>
    import("@/components/custom-plan-management").then(
      (m) => m.CustomPlanManagement
    ),
  { ssr: false }
);

const ActivityManagement = dynamic(
  () =>
    import("@/components/activity-management").then(
      (m) => m.ActivityManagement
    ),
  { ssr: false }
);

const RoutineManagement = dynamic(
  () =>
    import("@/components/routine-management").then((m) => m.RoutineManagement),
  { ssr: false }
);

const InactiveManagement = dynamic(
  () =>
    import("@/components/inactive-management").then(
      (m) => m.InactiveManagement
    ),
  { ssr: false }
);

//Sigue aca
import { supabase } from "@/lib/supabase";
import type {
  Member,
  Payment,
  Prospect,
  Expense,
  Plan,
  Activity,
  CustomPlan,
} from "@/lib/supabase";

// === Helpers de fecha/estado para el dashboard ===
const toLocalDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getRealStatus = (m: Member): "active" | "expired" | "inactive" => {
  const today = new Date();
  const next = toLocalDate(m.next_payment);
  const diffDays = Math.ceil((today.getTime() - next.getTime()) / 86400000);
  if (diffDays <= 0) return "active";
  if (diffDays <= 30) return "expired";
  return "inactive";
};

const DEFAULT_GYM_NAME = "Sistema de Gestión Multi-Gimnasio";

const sanitizeGymName = (name: string) => {
  const cleaned = name
    .replace(/^\s*Gimnasio\s+/i, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();

  return cleaned.length > 0 ? cleaned : name.trim();
};

export default function GymManagementSystem() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [gymData, setGymData] = useState<
    { name: string; id: string; logo_url?: string | null } | null
  >(null);
  const [memberFilter, setMemberFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const displayGymName = gymData?.name
    ? sanitizeGymName(gymData.name)
    : DEFAULT_GYM_NAME;

  const handleLogin = (data: { name: string; id: string }) => {
    setGymData(data);
    setIsAuthenticated(true);

    supabase
      .from("gyms")
      .select("logo_url")
      .eq("id", data.id)
      .single()
      .then(({ data: gym }) => {
        if (gym?.logo_url) {
          setGymData((prev) =>
            prev ? { ...prev, logo_url: gym.logo_url } : prev
          );
        }
      });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setGymData(null);
    setMembers([]);
    setPayments([]);
    setProspects([]);
    setExpenses([]);
    setPlans([]);
    setActivities([]);
    setCustomPlans([]);
  };

  // CARGAR DATOS DESDE SUPABASE
  const loadData = async (gymId: string) => {
    setLoading(true);
    try {
      console.log("Cargando datos para gym:", gymId);

      // Cargar miembros
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select(
          "id, gym_id, name, email, phone, join_date, plan, plan_price, last_payment, next_payment, status, inactive_level, inactive_comment, followed_up, balance_due"
        )
        .eq("gym_id", gymId)
        .order("balance_due", { ascending: false })
        .order("last_payment", { ascending: false });

      if (membersError) {
        console.error("Error cargando miembros:", membersError);
      }

      // Cargar pagos
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select(
          "id, gym_id, member_id, member_name, amount, date, plan, method, card_brand, card_installments, type, description, plan_id"
        )
        .eq("gym_id", gymId)
        .order("date", { ascending: false });

      if (paymentsError) {
        console.error("Error cargando pagos:", paymentsError);
      }

      // Cargar gastos
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("gym_id", gymId)
        .order("date", { ascending: false });

      if (expensesError) {
        console.error("Error cargando gastos:", expensesError);
      }

      // Cargar interesados
      const { data: prospectsData, error: prospectsError } = await supabase
        .from("prospects")
        .select("*")
        .eq("gym_id", gymId);

      if (prospectsError) {
        console.error("Error cargando interesados:", prospectsError);
      }

      // Cargar planes
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("*")
        .eq("gym_id", gymId);

      if (plansError) {
        console.error("Error cargando planes:", plansError);
      }

      // Cargar actividades
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .eq("gym_id", gymId);

      if (activitiesError) {
        console.error("Error cargando actividades:", activitiesError);
      }

      // Cargar planes personalizados
      const { data: customPlansData, error: customPlansError } = await supabase
        .from("custom_plans")
        .select("*")
        .eq("gym_id", gymId);

      if (customPlansError) {
        console.error(
          "Error cargando planes personalizados:",
          customPlansError
        );
      }

      // Actualizar estados
      setMembers(membersData || []);
      setPayments(paymentsData || []);
      setExpenses(expensesData || []);
      setProspects(prospectsData || []);
      setPlans(plansData || []);
      setActivities(activitiesData || []);
      setCustomPlans(customPlansData || []);

      console.log("Datos cargados:", {
        members: membersData?.length || 0,
        payments: paymentsData?.length || 0,
        plans: plansData?.length || 0,
        activities: activitiesData?.length || 0,
        customPlans: customPlansData?.length || 0,
      });

      // Si no hay datos, crear datos de ejemplo
      if (
        !membersData?.length &&
        !plansData?.length &&
        !activitiesData?.length
      ) {
        console.log("No hay datos, creando datos de ejemplo...");
        await createSampleData(gymId);
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // CREAR DATOS DE EJEMPLO SI NO EXISTEN
  const createSampleData = async (gymId: string) => {
    try {
      console.log("Creando datos de ejemplo para:", gymId);

      // Crear actividades de ejemplo
      const sampleActivities = [
        {
          id: `${gymId}_activity_1`,
          gym_id: gymId,
          name: "Sala de musculacion",
          description: "Entrenamiento con pesas y máquinas",
          instructor: "Carlos Pérez",
          capacity: 30,
          duration: 60,
          schedule: [
            { day: "Lunes", startTime: "08:00", endTime: "22:00" },
            { day: "Martes", startTime: "08:00", endTime: "22:00" },
            { day: "Miércoles", startTime: "08:00", endTime: "22:00" },
            { day: "Jueves", startTime: "08:00", endTime: "22:00" },
            { day: "Viernes", startTime: "08:00", endTime: "22:00" },
            { day: "Sábado", startTime: "09:00", endTime: "18:00" },
          ],
          is_active: true,
        },
        {
          id: `${gymId}_activity_2`,
          gym_id: gymId,
          name: "Pilates",
          description: "Clases de Pilates para todos los niveles",
          instructor: "María González",
          capacity: 15,
          duration: 60,
          schedule: [
            { day: "Lunes", startTime: "08:00", endTime: "09:00" },
            { day: "Miércoles", startTime: "08:00", endTime: "09:00" },
            { day: "Viernes", startTime: "08:00", endTime: "09:00" },
          ],
          is_active: true,
        },
      ];

      const { error: activitiesError } = await supabase
        .from("activities")
        .insert(sampleActivities);
      if (activitiesError) {
        console.error("Error creando actividades:", activitiesError);
      }

      // Crear planes de ejemplo
      const samplePlans = [
        {
          id: `${gymId}_plan_1`,
          gym_id: gymId,
          name: "Mensual",
          description: "Plan mensual básico",
          price: 2500,
          duration: 1,
          duration_type: "months",
          activities: ["Sala de musculacion", "Pilates"],
          is_active: true,
        },
        {
          id: `${gymId}_plan_2`,
          gym_id: gymId,
          name: "Trimestral",
          description: "Plan trimestral con descuento",
          price: 6500,
          duration: 3,
          duration_type: "months",
          activities: ["Sala de musculacion", "Pilates"],
          is_active: true,
        },
      ];

      const { error: plansError } = await supabase
        .from("plans")
        .insert(samplePlans);
      if (plansError) {
        console.error("Error creando planes:", plansError);
      }

      // Crear miembros de ejemplo
      const sampleMembers = [
        {
          id: `${gymId}_member_1`,
          gym_id: gymId,
          name: "Juan Pérez",
          email: "juan@email.com",
          phone: "099123456",
          join_date: "2024-01-15",
          plan: "Mensual",
          plan_price: 2500,
          last_payment: "2024-12-01",
          next_payment: "2025-01-01",
          status: "active",
          balance_due: 0,
        },
        {
          id: `${gymId}_member_2`,
          gym_id: gymId,
          name: "María González",
          email: "maria@email.com",
          phone: "099654321",
          join_date: "2024-02-20",
          plan: "Trimestral",
          plan_price: 6500,
          last_payment: "2024-11-15",
          next_payment: "2024-12-15",
          status: "expired",
          balance_due: 0,
        },
      ];

      const { error: membersError } = await supabase
        .from("members")
        .insert(sampleMembers);
      if (membersError) {
        console.error("Error creando miembros:", membersError);
      }

      // Crear pagos de ejemplo
      const samplePayments = [
        {
          id: `${gymId}_payment_1`,
          gym_id: gymId,
          member_id: `${gymId}_member_1`,
          member_name: "Juan Pérez",
          amount: 2500,
          date: "2024-12-01",
          plan: "Mensual",
          method: "Efectivo",
          type: "plan",
          description: "Plan Mensual",
          plan_id: `${gymId}_plan_1`,
        },
      ];

      const { error: paymentsError } = await supabase
        .from("payments")
        .insert(samplePayments);
      if (paymentsError) {
        console.error("Error creando pagos:", paymentsError);
      }

      console.log("Datos de ejemplo creados exitosamente");

      // Recargar datos
      await loadData(gymId);
    } catch (error) {
      console.error("Error creando datos de ejemplo:", error);
    }
  };

  // Cargar datos cuando se autentica
  useEffect(() => {
    if (gymData?.id) {
      loadData(gymData.id);
    }
  }, [gymData?.id]);

  // Función para actualizar estados de miembros
  const updateMemberStatuses = (members: Member[]) => {
    const today = new Date();
    return members.map((member) => {
      const nextPayment = toLocalDate(member.next_payment);
      const diffTime = today.getTime() - nextPayment.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (nextPayment > today) {
        return { ...member, status: "active" as const };
      }

      if (diffDays > 0) {
        if (diffDays > 30) {
          return {
            ...member,
            status: "inactive" as const,
            inactive_level: member.inactive_level || ("yellow" as const),
          };
        } else {
          return { ...member, status: "expired" as const };
        }
      }

      return { ...member, status: "expired" as const };
    });
  };

  // Aplicar actualización de estados
  useEffect(() => {
    if (members.length > 0) {
      const updatedMembers = updateMemberStatuses(members);
      if (JSON.stringify(updatedMembers) !== JSON.stringify(members)) {
        setMembers(updatedMembers);
      }
    }
  }, [gymData]);

  // Calculate dashboard metrics
  /* const activeMembers = members.filter((m) => m.status === "active").length;
  const expiredMembers = members.filter((m) => m.status === "expired").length;
  const inactiveMembers = members.filter((m) => m.status === "inactive").length; */
  const activeMembers = members.filter(
    (m) => getRealStatus(m) === "active"
  ).length;
  const expiredMembers = members.filter(
    (m) => getRealStatus(m) === "expired"
  ).length;
  const inactiveMembers = members.filter(
    (m) => getRealStatus(m) === "inactive"
  ).length;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyIncome = payments
    .filter((p) => {
      const paymentDate = toLocalDate(p.date);
      return (
        paymentDate.getMonth() === currentMonth &&
        paymentDate.getFullYear() === currentYear
      );
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const monthlyExpenses = expenses
    .filter((e) => {
      const expenseDate = toLocalDate(e.date);
      return (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const monthlyProfit = monthlyIncome - monthlyExpenses;

  const upcomingExpirations = members.filter((m) => {
    const next = toLocalDate(m.next_payment);
    const diffDays = Math.ceil((next.getTime() - Date.now()) / 86400000);
    return diffDays <= 7 && diffDays >= 0;
  }).length;

  // Socios que ingresaron hace 5–12 días y aún no fueron contactados
  const followUpCount = (() => {
    const today = new Date();
    return members.filter((m) => {
      const join = toLocalDate(m.join_date);
      const diffDays = Math.floor(
        (today.getTime() - join.getTime()) / 86400000
      );
      return !m.followed_up && diffDays >= 5 && diffDays <= 12;
    }).length;
  })();

  const goToMembersWithFilter = (filter: string) => {
    setMemberFilter(filter);
    setActiveTab("members");
  };

  const goToProspects = () => {
    setActiveTab("prospects");
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Resumen general de {gymData?.name}
        </p>
      </div>

      {loading && (
        <div className="text-center py-8">
          <p>Cargando datos desde la base de datos...</p>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => goToMembersWithFilter("active")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Socios Activos
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeMembers}
            </div>
            <p className="text-xs text-muted-foreground">
              Haz clic para ver detalles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingresos del Mes
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyIncome.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Gastos: ${monthlyExpenses.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ganancia Mensual
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                monthlyProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              ${monthlyProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Ingresos - Gastos</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => goToMembersWithFilter("expiring_soon")} // ✅ CORRECTO
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vencimientos Próximos
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {upcomingExpirations}
            </div>
            <p className="text-xs text-muted-foreground">
              Haz clic para ver detalles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado de Socios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
              onClick={() => goToMembersWithFilter("active")}
            >
              <div className="flex items-center space-x-2">
                <Badge variant="default">Activos</Badge>
                <span>{activeMembers} socios</span>
              </div>
              <span className="text-xs text-muted-foreground">Ver →</span>
            </div>
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
              onClick={() => goToMembersWithFilter("expired")}
            >
              <div className="flex items-center space-x-2">
                <Badge variant="destructive">Vencidos</Badge>
                <span>{expiredMembers} socios</span>
              </div>
              <span className="text-xs text-muted-foreground">Ver →</span>
            </div>
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
              onClick={() => goToMembersWithFilter("inactive")}
            >
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">Inactivos</Badge>
                <span>{inactiveMembers} socios</span>
              </div>
              <span className="text-xs text-muted-foreground">Ver →</span>
            </div>
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
              onClick={() => goToMembersWithFilter("all")}
            >
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Total</Badge>
                <span>{members.length} socios</span>
              </div>
              <span className="text-xs text-muted-foreground">Ver todos →</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas Importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {followUpCount > 0 && (
              <div
                className="flex items-center space-x-2 text-blue-600 cursor-pointer hover:bg-blue-50 p-2 rounded"
                onClick={() => goToMembersWithFilter("follow_up")}
              >
                <span>
                  📩 {followUpCount} socio{followUpCount > 1 ? "s" : ""} con
                  seguimiento pendiente (5–12 días)
                </span>
              </div>
            )}
            {upcomingExpirations > 0 && (
              <div
                className="flex items-center space-x-2 text-orange-600 cursor-pointer hover:bg-orange-50 p-2 rounded"
                onClick={() => goToMembersWithFilter("expiring_soon")}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {upcomingExpirations} socios con vencimiento próximo
                </span>
              </div>
            )}
            {expiredMembers > 0 && (
              <div
                className="flex items-center space-x-2 text-red-600 cursor-pointer hover:bg-red-50 p-2 rounded"
                onClick={() => goToMembersWithFilter("expired")}
              >
                <Calendar className="h-4 w-4" />
                <span>{expiredMembers} socios con plan vencido</span>
              </div>
            )}
            {prospects.filter((p) => p.status === "nuevo_interesado").length > 0 && (
              <div
                className="flex items-center space-x-2 text-blue-600 cursor-pointer hover:bg-blue-50 p-2 rounded"
                onClick={goToProspects}
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  {prospects.filter((p) => p.status === "nuevo_interesado").length} nuevos
                  interesados por contactar
                </span>
              </div>
            )}
            {upcomingExpirations === 0 &&
              expiredMembers === 0 &&
              prospects.filter((p) => p.status === "nuevo_interesado").length === 0 && (
                <div className="flex items-center space-x-2 text-green-600">
                  <span>✅ Todo en orden</span>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return <LoginSystem onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
             <div className="flex items-center space-x-4">
              {gymData?.logo_url && (
                <img
                  src={gymData.logo_url}
                  alt={`Logo de ${gymData.name}`}
                  className="h-12 w-12 rounded-full object-cover"
                />
              )}
              <div>
                 <h1 className="text-[1.75rem] font-bold leading-tight text-gray-900">
                  {/* GymManagerPro 2.0 */}
                </h1>
                 <p className="text-base text-gray-500">
                  {displayGymName}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-8">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "members", label: "Socios" },
              { id: "payments", label: "Pagos" },
              { id: "prospects", label: "Interesados" },
              { id: "inactives", label: "Inactivos" },
              { id: "plans", label: "Planes" },
               { id: "custom_plans", label: "Personalizados" },
              { id: "activities", label: "Actividades" },
              { id: "routines", label: "Rutinas" },
              { id: "expenses", label: "Gastos" },
              { id: "reports", label: "Reportes" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === "dashboard" && renderDashboard()}
        {activeTab === "members" && (
          <MemberManagement
            members={members}
            setMembers={setMembers}
            payments={payments}
            setPayments={setPayments}
            plans={plans}
            customPlans={customPlans}
            setCustomPlans={setCustomPlans}
            gymId={gymData?.id || ""}
            initialFilter={memberFilter}
            onFilterChange={setMemberFilter}
            serverPaging={true} // ← ACTIVAR
          />
        )}
        {activeTab === "payments" && (
          <PaymentManagement
            payments={payments}
            setPayments={setPayments}
            members={members}
            setMembers={setMembers}
            plans={plans}
            gymId={gymData?.id || ""}
          />
        )}
        {activeTab === "prospects" && (
          <ProspectManagement
            prospects={prospects}
            setProspects={setProspects}
            members={members}
            setMembers={setMembers}
            payments={payments}
            setPayments={setPayments}
            plans={plans}
            gymId={gymData?.id || ""}
          />
        )}
        {activeTab === "expenses" && (
          <ExpenseManagement
            expenses={expenses}
            setExpenses={setExpenses}
            gymId={gymData?.id || ""}
          />
        )}
        {activeTab === "reports" && (
          <ReportsSection
            members={members}
            payments={payments}
            expenses={expenses}
            gymName={gymData?.name || ""}
          />
        )}
        {activeTab === "plans" && (
          <PlanManagement
            plans={plans}
            setPlans={setPlans}
            activities={activities}
            gymId={gymData?.id || ""}
          />
        )}
         {activeTab === "custom_plans" && (
          <CustomPlanManagement
            customPlans={customPlans}
            setCustomPlans={setCustomPlans}
            members={members}
            payments={payments}
            setPayments={setPayments}
            gymId={gymData?.id || ""}
          />
        )}
        {activeTab === "activities" && (
          <ActivityManagement
            activities={activities}
            setActivities={setActivities}
            gymId={gymData?.id || ""}
          />
        )}
        {activeTab === "routines" && gymData?.id && (
          <RoutineManagement gymId={gymData.id} />
        )}
        {activeTab === "inactives" && (
          <InactiveManagement
            members={members}
            setMembers={setMembers}
            payments={payments}
          />
        )}
      </main>
    </div>
  );
}
