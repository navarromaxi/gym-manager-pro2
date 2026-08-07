import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

const BRAND_LOGO_URL =
  "https://tvrwpwmuqxhqgjtmjoip.supabase.co/storage/v1/object/public/logos/Manager%20Pro%20Logo.png"

export const metadata: Metadata = {
  title: "GymManagerPro 2.0",
  description: "Sistema de Gestión para Gimnasios",
  icons: {
    icon: [{ url: BRAND_LOGO_URL, type: "image/png" }],
    apple: [{ url: BRAND_LOGO_URL, type: "image/png" }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        <SpeedInsights /> {/* 👈 Insertado correctamente para Vercel */}
      </body>
    </html>
  )
}

