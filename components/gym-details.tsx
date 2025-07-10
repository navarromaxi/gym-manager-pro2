"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Edit } from "lucide-react"
import { supabase } from "@/lib/supabase" // Asegúrate de que esta ruta sea correcta

interface GymDetailsProps {
  gymData: {
    id: string
    name: string
    ownerId: string
    // Añade otras propiedades de tu tabla 'gyms' si las tienes
  } | null
  setGymData: (data: any) => void // Función para actualizar el estado del gimnasio en el padre
}

export function GymDetails({ gymData, setGymData }: GymDetailsProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingGymName, setEditingGymName] = useState(gymData?.name || "")

  // Sincronizar el estado local con el prop gymData
  useState(() => {
    if (gymData) {
      setEditingGymName(gymData.name)
    }
  }, [gymData])

  const handleEditGymName = async () => {
    if (!gymData?.id) return

    try {
      const { data, error } = await supabase.from("gyms").update({ name: editingGymName }).eq("id", gymData.id).select() // Usar .select() para obtener los datos actualizados

      if (error) throw error

      if (data && data.length > 0) {
        setGymData(data[0]) // Actualizar el estado del gimnasio en el padre
        setIsEditDialogOpen(false)
      }
    } catch (error: any) {
      console.error("Error actualizando nombre del gimnasio:", error.message || error)
      alert(`Error al actualizar el nombre del gimnasio: ${error.message || "Error desconocido"}`)
    }
  }

  if (!gymData) {
    return null // O un placeholder de carga si lo prefieres
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-bold">Detalles del Gimnasio</CardTitle>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Nombre del Gimnasio</DialogTitle>
              <DialogDescription>Actualiza el nombre de tu gimnasio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="gym-name">Nombre del Gimnasio</Label>
                <Input
                  id="gym-name"
                  value={editingGymName}
                  onChange={(e) => setEditingGymName(e.target.value)}
                  placeholder="Mi Gimnasio Pro"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleEditGymName}>
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-medium">{gymData.name}</p>
        <p className="text-sm text-muted-foreground">ID del Gimnasio: {gymData.id}</p>
      </CardContent>
    </Card>
  )
}
