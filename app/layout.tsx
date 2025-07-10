import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider" // Mantén esta importación si la usas
import { AuthProvider } from "@/context/auth" // ¡NUEVA IMPORTACIÓN!

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "GymManagerPro 2.0",
  description: "Sistema de Gestión para Gimnasios",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {" "}
        {/* Añade la clase de la fuente si la usas */}
        {/* Si usas ThemeProvider, envuelve AuthProvider con él, o viceversa, según tu preferencia */}
        {/* Generalmente, AuthProvider va más arriba para que todos los componentes tengan acceso al contexto de autenticación */}
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {" "}
            {/* Mantén ThemeProvider si lo usas */}
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
