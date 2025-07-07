"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Lock, User } from "lucide-react"

interface LoginSystemProps {
  onLogin: (gymData: { name: string; id: string }) => void
}

export function LoginSystem({ onLogin }: LoginSystemProps) {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Simulación de gimnasios registrados (en producción esto vendría de una base de datos)
  const registeredGyms = [
    {
      id: "dinamo_001",
      name: "Dinamo Fitness Club",
      username: "dinamo_admin",
      password: "dinamo2024",
      subscription: "active",
    },
    {
      id: "powerfit_002",
      name: "PowerFit Gym",
      username: "powerfit_admin",
      password: "power2024",
      subscription: "active",
    },
    {
      id: "demo_gym",
      name: "Gimnasio Demo",
      username: "demo",
      password: "demo123",
      subscription: "trial",
    },
  ]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simular delay de autenticación
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const gym = registeredGyms.find((g) => g.username === credentials.username && g.password === credentials.password)

    if (gym) {
      if (gym.subscription === "active" || gym.subscription === "trial") {
        onLogin({ name: gym.name, id: gym.id })
      } else {
        setError("Tu suscripción ha expirado. Contacta al administrador del sistema.")
      }
    } else {
      setError("Usuario o contraseña incorrectos")
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">GymManagerPro 2.0</CardTitle>
          <p className="text-muted-foreground">Sistema de Gestión para Gimnasios</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario del Gimnasio</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Cuentas de Prueba:</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div>
                <strong>Demo:</strong> usuario: demo, contraseña: demo123
              </div>
              <div>
                <strong>Dinamo:</strong> usuario: dinamo_admin, contraseña: dinamo2024
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
