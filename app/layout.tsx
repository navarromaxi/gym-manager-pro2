import type React from "react"
import "./globals.css"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "GymManagerPro 2.0",
  description: "Sistema de Gestión para Gimnasios",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
        <SpeedInsights /> {/* 👈 Insertado correctamente para Vercel */}
      </body>
    </html>
  )
}

