"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth"
// import { redirect } from "next/navigation" // ¡ELIMINAR ESTA IMPORTACIÓN!
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProspectManagement } from "@/components/prospect-management"
import { MemberManagement } from "@/components/member-management"
import { PaymentManagement } from "@/components/payment-management"
import { PlanManagement } from "@/components/plan-management"
import { GymDetails } from "@/components/gym-details"

export default function GymManagementSystem() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("prospects")
  const [gymData, setGymData] = useState<any>(null) // Usar any por simplicidad, o definir un tipo Gym
  const [prospects, setProspects] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([]) // Aseguramos que siempre sea un array

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login") // Esta es la redirección correcta en el cliente
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchGymData = async () => {
      if (user) {
        try {
          const response = await fetch(`/api/gyms?ownerId=${user.uid}`)
          if (response.ok) {
            const data = await response.json()
            if (data && data.length > 0) {
              setGymData(data[0])
            } else {
              // If no gym exists, create one for the user
              const createResponse = await fetch("/api/gyms", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: `${user.email}'s Gym`, // Default name
                  ownerId: user.uid,
                }),
              })

              if (createResponse.ok) {
                const newGymData = await createResponse.json()
                setGymData(newGymData)
              } else {
                console.error("Failed to create gym:", createResponse.statusText)
              }
            }
          } else {
            console.error("Failed to fetch gym data:", response.statusText)
          }
        } catch (error) {
          console.error("Error fetching gym data:", error)
        }
      }
    }

    fetchGymData()
  }, [user])

  useEffect(() => {
    const fetchData = async (dataType: string, setter: (data: any[]) => void) => {
      if (gymData?.id) {
        try {
          const response = await fetch(`/api/${dataType}?gymId=${gymData.id}`)
          if (response.ok) {
            const data = await response.json()
            setter(data || [])
          } else {
            console.error(`Failed to fetch ${dataType}:`, response.statusText)
            setter([])
          }
        } catch (error) {
          console.error(`Error fetching ${dataType}:`, error)
          setter([])
        }
      }
    }

    if (gymData?.id) {
      fetchData("prospects", setProspects)
      fetchData("members", setMembers)
      fetchData("payments", setPayments)
      fetchData("plans", setPlans)
    }
  }, [gymData])

  if (loading) {
    return <div>Cargando...</div>
  }

  // ¡ELIMINAR ESTE BLOQUE!
  // if (!user) {
  //   redirect("/login")
  // }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold mb-5">Sistema de Gestión de Gimnasio</h1>

      {gymData ? (
        <>
          <GymDetails gymData={gymData} setGymData={setGymData} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="prospects">Interesados</TabsTrigger>
              <TabsTrigger value="members">Socios</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="plans">Planes</TabsTrigger>
            </TabsList>
            <TabsContent value="prospects">
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
            </TabsContent>
            <TabsContent value="members">
              {activeTab === "members" && (
                <MemberManagement
                  members={members}
                  setMembers={setMembers}
                  payments={payments}
                  setPayments={setPayments}
                  plans={plans}
                  gymId={gymData?.id || ""}
                />
              )}
            </TabsContent>
            <TabsContent value="payments">
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
            </TabsContent>
            <TabsContent value="plans">
              {activeTab === "plans" && (
                <PlanManagement
                  gymId={gymData?.id || ""}
                  initialPlans={plans}
                  activities={[]}
                  onPlansUpdate={setPlans}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div>Cargando Datos del Gimnasio...</div>
      )}
    </div>
  )
}
