"use client";

import type React from "react";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Lock, User } from "lucide-react";

interface LoginSystemProps {
  onLogin: (gymData: { name: string; id: string }) => void;
}

export function LoginSystem({ onLogin }: LoginSystemProps) {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError("");

  const { data: gym, error } = await supabase
    .from("gyms")
    .select("*")
    .eq("username", credentials.username)
    .single();

  if (error || !gym) {
    setError("Usuario no encontrado");
    setIsLoading(false);
    return;
  }

  if (gym.password !== credentials.password) {
    setError("Contraseña incorrecta");
    setIsLoading(false);
    return;
  }

  if (gym.subscription !== "active" && gym.subscription !== "trial") {
    setError("Tu suscripción ha expirado");
    setIsLoading(false);
    return;
  }

  onLogin({ name: gym.name, id: gym.id });
  setIsLoading(false);
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            GymManagerPro 2.0
          </CardTitle>
          <p className="text-muted-foreground">
            Sistema de Gestión para Gimnasios
          </p>
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
                  onChange={(e) =>
                    setCredentials({ ...credentials, username: e.target.value })
                  }
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
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
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
            <h4 className="font-medium text-blue-900 mb-2">
              Cuentas de Prueba:
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div>
                <strong>Demo:</strong> usuario: demo, contraseña: demo123
              </div>
              <div>
                <strong>Dinamo:</strong> usuario: dinamo_admin, contraseña:
                dinamo2024
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
