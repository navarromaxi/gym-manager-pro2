/* "use client";

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
            Gestión para Gimnasios
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

          
        </CardContent>
      </Card>
    </div>
  );
}
 */


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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1) Autenticación con Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data?.user) {
        throw new Error("Usuario o contraseña incorrectos.");
      }
      const user = data.user;

      // 2) Traer el gimnasio vinculado al usuario logueado
      const { data: gym, error: gymErr } = await supabase
        .from("gyms")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (gymErr || !gym) {
        throw new Error("No se encontró el gimnasio vinculado a este usuario.");
      }

      // 3) Validar suscripción (tu lógica actual)
      if (gym.subscription !== "active" && gym.subscription !== "trial") {
        throw new Error("Tu suscripción ha expirado.");
      }

      // 4) Guardar el id del gimnasio en los metadatos del usuario
      let { error: updateError } = await supabase.auth.updateUser({
        data: { gym_id: gym.id },
      });

      if (updateError) {
        const { error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError) {
          throw new Error("No se pudo refrescar la sesión.");
        }
        ({ error: updateError } = await supabase.auth.updateUser({
          data: { gym_id: gym.id },
        }));
        if (updateError) {
          throw new Error(
            "No se pudo asociar el gimnasio al usuario."
          );
        }
      }

      // 5) Refrescar sesión para obtener un JWT con gym_id
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error("No se pudo actualizar la sesión.");
      }if (refreshData.session) {
        await supabase.auth.setSession(refreshData.session);
      };

      // 6) Continuar: usar el id de gym (text) para filtrar en toda la app
      onLogin({ name: gym.name, id: gym.id });
    } catch (err: any) {
      setError(err.message ?? "Error al iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">GymManagerPro 2.0</CardTitle>
          <p className="text-muted-foreground">Gestión para Gimnasios</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              {/* Etiqueta puede decir "Usuario del Gimnasio", pero debe ser EMAIL */}
              <Label htmlFor="email">Usuario del Gimnasio (Email)</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu-email@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                suppressHydrationWarning
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
