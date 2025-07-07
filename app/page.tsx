"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, DollarSign, AlertTriangle, TrendingUp, Calendar, UserPlus } from "lucide-react"
import { MemberManagement } from "@/components/member-management"
import { PaymentManagement } from "@/components/payment-management"
import { ProspectManagement } from "@/components/prospect-management"
import { ExpenseManagement } from "@/components/expense-management"
import { ReportsSection } from "@/components/reports-section"
import { LoginSystem } from "@/components/login-system"
import { PlanManagement } from "@/components/plan-management"
import { ActivityManagement } from "@/components/activity-management"
import { RoutineManagement } from "@/components/routine-management"
import { InactiveManagement } from "@/components/inactive-management"

interface Member {
  id: string
  gymId: string
  name: string
  email: string
  phone: string
  joinDate: string
  plan: string
  planPrice: number
  lastPayment: string
  nextPayment: string
  status: "active" | "expired" | "inactive"
  inactiveLevel?: "green" | "yellow" | "red"
}

interface Payment {
  id: string
  gymId: string
  memberId: string
  memberName: string
  amount: number
  date: string
  plan: string
  method: string
}

interface Prospect {
  id: string
  gymId: string
  name: string
  email: string
  phone: string
  contactDate: string
  interest: string
  status: "new" | "contacted" | "waiting_response" | "waiting_info" | "not_interested" | "contact_later"
  notes: string
}

interface Expense {
  id: string
  gymId: string
  description: string
  amount: number
  date: string
  category: string
  isRecurring: boolean
}

interface Plan {
  id: string
  gymId: string
  name: string
  description: string
  price: number
  duration: number
  durationType: "days" | "months" | "years"
  activities: string[]
  isActive: boolean
  createdDate: string
}

interface Activity {
  id: string
  gymId: string
  name: string
  description: string
  instructor: string
  capacity: number
  duration: number
  schedule: { day: string; startTime: string; endTime: string }[]
  isActive: boolean
  createdDate: string
}

export default function GymManagementSystem() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [members, setMembers] = useState<Member[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [gymData, setGymData] = useState<{ name: string; id: string } | null>(null)
  const [memberFilter, setMemberFilter] = useState("all")
  const [plans, setPlans] = useState<Plan[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  const handleLogin = (data: { name: string; id: string }) => {
    setGymData(data)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setGymData(null)
    // Limpiar todos los datos al cerrar sesión
    setMembers([])
    setPayments([])
    setProspects([])
    setExpenses([])
    setPlans([])
    setActivities([])
  }

  const updateMemberStatuses = (members: Member[]) => {
    const today = new Date()
    return members.map((member) => {
      const nextPayment = new Date(member.nextPayment)
      const diffTime = today.getTime() - nextPayment.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Si el próximo pago es en el futuro, está activo
      if (nextPayment > today) {
        return { ...member, status: "active" as const }
      }

      // Si está vencido
      if (diffDays > 0) {
        // Si tiene más de 30 días vencido, pasa a inactivo automáticamente
        if (diffDays > 30) {
          return {
            ...member,
            status: "inactive" as const,
            inactiveLevel: member.inactiveLevel || ("yellow" as const),
          }
        } else {
          // Si tiene entre 1 y 30 días vencido, está "expired"
          return { ...member, status: "expired" as const }
        }
      }

      // Si es exactamente hoy
      return { ...member, status: "expired" as const }
    })
  }

  // Initialize with sample data - FILTRADO POR GYM
  useEffect(() => {
    if (!gymData) return

    const sampleMembers: Member[] = [
      {
        id: "1",
        gymId: gymData.id,
        name: "Juan Pérez",
        email: "juan@email.com",
        phone: "099123456",
        joinDate: "2024-01-15",
        plan: "Mensual",
        planPrice: 2500,
        lastPayment: "2024-12-01",
        nextPayment: "2025-01-01",
        status: "active",
      },
      {
        id: "2",
        gymId: gymData.id,
        name: "María González",
        email: "maria@email.com",
        phone: "099654321",
        joinDate: "2024-02-20",
        plan: "Trimestral",
        planPrice: 6500,
        lastPayment: "2024-11-15",
        nextPayment: "2024-12-15", // Solo 15 días vencido
        status: "expired",
      },
      {
        id: "3",
        gymId: gymData.id,
        name: "Carlos Rodríguez",
        email: "carlos@email.com",
        phone: "099789123",
        joinDate: "2024-03-10",
        plan: "Mensual",
        planPrice: 2500,
        lastPayment: "2024-09-01",
        nextPayment: "2024-10-01", // Más de 30 días vencido
        status: "inactive",
        inactiveLevel: "yellow",
      },
    ]

    const samplePayments: Payment[] = [
      {
        id: "1",
        gymId: gymData.id,
        memberId: "1",
        memberName: "Juan Pérez",
        amount: 2500,
        date: "2024-12-01",
        plan: "Mensual",
        method: "Efectivo",
      },
      {
        id: "2",
        gymId: gymData.id,
        memberId: "2",
        memberName: "María González",
        amount: 6500,
        date: "2024-11-15",
        plan: "Trimestral",
        method: "Transferencia",
      },
    ]

    const sampleProspects: Prospect[] = [
      {
        id: "1",
        gymId: gymData.id,
        name: "Ana López",
        email: "ana@email.com",
        phone: "099456789",
        contactDate: "2024-12-20",
        interest: "Plan Mensual",
        status: "new",
        notes: "Interesada en clases de pilates",
      },
    ]

    const sampleExpenses: Expense[] = [
      {
        id: "1",
        gymId: gymData.id,
        description: "Alquiler local",
        amount: 25000,
        date: "2024-12-01",
        category: "Fijos",
        isRecurring: true, // Gasto fijo mensual
      },
      {
        id: "2",
        gymId: gymData.id,
        description: "Equipamiento nuevo",
        amount: 15000,
        date: "2024-12-15",
        category: "Equipos",
        isRecurring: false,
      },
    ]

    // ACTIVIDADES ACTUALIZADAS según tu pedido
    const sampleActivities: Activity[] = [
      {
        id: "1",
        gymId: gymData.id,
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
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "2",
        gymId: gymData.id,
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
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "3",
        gymId: gymData.id,
        name: "Cross",
        description: "Entrenamiento de alta intensidad",
        instructor: "Roberto Silva",
        capacity: 12,
        duration: 45,
        schedule: [
          { day: "Martes", startTime: "19:00", endTime: "19:45" },
          { day: "Jueves", startTime: "19:00", endTime: "19:45" },
        ],
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "4",
        gymId: gymData.id,
        name: "Funcional",
        description: "Entrenamiento funcional con peso corporal",
        instructor: "Ana García",
        capacity: 20,
        duration: 50,
        schedule: [
          { day: "Lunes", startTime: "18:00", endTime: "18:50" },
          { day: "Miércoles", startTime: "18:00", endTime: "18:50" },
          { day: "Viernes", startTime: "18:00", endTime: "18:50" },
        ],
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "5",
        gymId: gymData.id,
        name: "Running",
        description: "Grupo de running al aire libre",
        instructor: "Diego López",
        capacity: 25,
        duration: 60,
        schedule: [
          { day: "Martes", startTime: "07:00", endTime: "08:00" },
          { day: "Jueves", startTime: "07:00", endTime: "08:00" },
          { day: "Sábado", startTime: "08:00", endTime: "09:00" },
        ],
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "6",
        gymId: gymData.id,
        name: "Ent. Personalizado",
        description: "Entrenamiento personalizado uno a uno",
        instructor: "Varios instructores",
        capacity: 1,
        duration: 60,
        schedule: [
          { day: "Lunes", startTime: "09:00", endTime: "20:00" },
          { day: "Martes", startTime: "09:00", endTime: "20:00" },
          { day: "Miércoles", startTime: "09:00", endTime: "20:00" },
          { day: "Jueves", startTime: "09:00", endTime: "20:00" },
          { day: "Viernes", startTime: "09:00", endTime: "20:00" },
        ],
        isActive: true,
        createdDate: "2024-01-01",
      },
    ]

    const samplePlans: Plan[] = [
      {
        id: "1",
        gymId: gymData.id,
        name: "Mensual",
        description: "Plan mensual básico",
        price: 2500,
        duration: 1,
        durationType: "months",
        activities: ["Sala de musculacion", "Pilates"],
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "2",
        gymId: gymData.id,
        name: "Trimestral",
        description: "Plan trimestral con descuento",
        price: 6500,
        duration: 3,
        durationType: "months",
        activities: ["Sala de musculacion", "Pilates", "Funcional"],
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "3",
        gymId: gymData.id,
        name: "Semestral",
        description: "Plan semestral con mayor descuento",
        price: 12000,
        duration: 6,
        durationType: "months",
        activities: ["Sala de musculacion", "Pilates", "Funcional", "Cross"],
        isActive: true,
        createdDate: "2024-01-01",
      },
      {
        id: "4",
        gymId: gymData.id,
        name: "Anual",
        description: "Plan anual con máximo descuento",
        price: 22000,
        duration: 1,
        durationType: "years",
        activities: ["Sala de musculacion", "Pilates", "Funcional", "Cross", "Running", "Ent. Personalizado"],
        isActive: true,
        createdDate: "2024-01-01",
      },
    ]

    setMembers(sampleMembers)
    setPayments(samplePayments)
    setProspects(sampleProspects)
    setExpenses(sampleExpenses)
    setPlans(samplePlans)
    setActivities(sampleActivities)
  }, [gymData])

  // Aplicar actualización de estados
  useEffect(() => {
    if (members.length > 0) {
      setMembers((prevMembers) => updateMemberStatuses(prevMembers))
    }
  }, [gymData])

  // Calculate dashboard metrics
  const activeMembers = members.filter((m) => m.status === "active").length
  const expiredMembers = members.filter((m) => m.status === "expired").length
  const inactiveMembers = members.filter((m) => m.status === "inactive").length

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const monthlyIncome = payments
    .filter((p) => {
      const paymentDate = new Date(p.date)
      return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear
    })
    .reduce((sum, p) => sum + p.amount, 0)

  const monthlyExpenses = expenses
    .filter((e) => {
      const expenseDate = new Date(e.date)
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear
    })
    .reduce((sum, e) => sum + e.amount, 0)

  const monthlyProfit = monthlyIncome - monthlyExpenses

  const upcomingExpirations = members.filter((m) => {
    const nextPayment = new Date(m.nextPayment)
    const today = new Date()
    const diffTime = nextPayment.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 7 && diffDays >= 0
  }).length

  // DASHBOARD CLICKEABLE - Funciones para navegar con filtros
  const goToMembersWithFilter = (filter: string) => {
    setMemberFilter(filter)
    setActiveTab("members")
  }

  // Agregar función para próximos a vencerse
  const goToExpiringSoon = () => {
    setMemberFilter("expiring_soon")
    setActiveTab("members")
  }

  const goToProspects = () => {
    setActiveTab("prospects")
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Resumen general de {gymData?.name}</p>
      </div>

      {/* Metrics Cards - TODOS CLICKEABLES */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => goToMembersWithFilter("active")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Socios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeMembers}</div>
            <p className="text-xs text-muted-foreground">Haz clic para ver detalles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Gastos: ${monthlyExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia Mensual</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${monthlyProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Ingresos - Gastos</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => goToMembersWithFilter("expired")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencimientos Próximos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{upcomingExpirations}</div>
            <p className="text-xs text-muted-foreground">Haz clic para ver detalles</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview - CLICKEABLE */}
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
            {upcomingExpirations > 0 && (
              <div
                className="flex items-center space-x-2 text-orange-600 cursor-pointer hover:bg-orange-50 p-2 rounded"
                onClick={() => goToMembersWithFilter("expired")}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>{upcomingExpirations} socios con vencimiento próximo</span>
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
            {prospects.filter((p) => p.status === "new").length > 0 && (
              <div
                className="flex items-center space-x-2 text-blue-600 cursor-pointer hover:bg-blue-50 p-2 rounded"
                onClick={goToProspects}
              >
                <UserPlus className="h-4 w-4" />
                <span>{prospects.filter((p) => p.status === "new").length} nuevos interesados por contactar</span>
              </div>
            )}
            {upcomingExpirations === 0 &&
              expiredMembers === 0 &&
              prospects.filter((p) => p.status === "new").length === 0 && (
                <div className="flex items-center space-x-2 text-green-600">
                  <span>✅ Todo en orden</span>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  if (!isAuthenticated) {
    return <LoginSystem onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GymManagerPro 2.0</h1>
              <p className="text-sm text-gray-500">{gymData?.name || "Sistema de Gestión Multi-Gimnasio"}</p>
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
          <div className="flex space-x-8">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "members", label: "Socios" },
              { id: "payments", label: "Pagos" },
              { id: "prospects", label: "Interesados" },
              { id: "inactives", label: "Inactivos" },
              { id: "plans", label: "Planes" },
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
            gymId={gymData?.id || ""}
            initialFilter={memberFilter}
            onFilterChange={setMemberFilter}
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
            gymId={gymData?.id || ""}
          />
        )}
        {activeTab === "expenses" && (
          <ExpenseManagement expenses={expenses} setExpenses={setExpenses} gymId={gymData?.id || ""} />
        )}
        {activeTab === "reports" && (
          <ReportsSection members={members} payments={payments} expenses={expenses} gymName={gymData?.name || ""} />
        )}
        {activeTab === "plans" && (
          <PlanManagement plans={plans} setPlans={setPlans} activities={activities} gymId={gymData?.id || ""} />
        )}
        {activeTab === "activities" && (
          <ActivityManagement activities={activities} setActivities={setActivities} gymId={gymData?.id || ""} />
        )}
        {activeTab === "routines" && <RoutineManagement />}
        {activeTab === "inactives" && (
          <InactiveManagement members={members} setMembers={setMembers} payments={payments} />
        )}
      </main>
    </div>
  )
}
