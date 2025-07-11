import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

// GET /api/gyms?ownerId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ownerId = searchParams.get("ownerId")

  console.log("API GET /api/gyms received. ownerId:", ownerId) // Nuevo log

  if (!ownerId) {
    console.error("API GET /api/gyms: ownerId is missing.") // Nuevo log
    return NextResponse.json({ error: "ownerId is required" }, { status: 400 })
  }

  const supabase = createClient()
  try {
    const { data, error } = await supabase.from("gyms").select("*").eq("owner_id", ownerId).single()

    if (error) {
      if (error.code === "PGRST116") {
        // PGRST116 means no rows found (expected for new users)
        console.log("API GET /api/gyms: No gym found for ownerId, returning empty array.") // Nuevo log
        return NextResponse.json([], { status: 200 })
      }
      console.error("API GET /api/gyms: Supabase error:", error) // Log detallado del error de Supabase
      return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
    }

    console.log("API GET /api/gyms: Successfully fetched gym data:", data) // Nuevo log
    return NextResponse.json(data ? [data] : [], { status: 200 })
  } catch (e: any) {
    console.error("API GET /api/gyms: Unexpected server error:", e) // Captura errores inesperados
    return NextResponse.json({ error: "Internal Server Error", details: e.message }, { status: 500 })
  }
}

// POST /api/gyms
export async function POST(request: Request) {
  const { name, ownerId } = await request.json()

  console.log("API POST /api/gyms received. name:", name, "ownerId:", ownerId) // Nuevo log

  if (!name || !ownerId) {
    console.error("API POST /api/gyms: name or ownerId is missing.") // Nuevo log
    return NextResponse.json({ error: "name and ownerId are required" }, { status: 400 })
  }

  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from("gyms")
      .insert([{ name, owner_id: ownerId }])
      .select()
      .single()

    if (error) {
      console.error("API POST /api/gyms: Supabase error:", error) // Log detallado del error de Supabase
      return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
    }

    console.log("API POST /api/gyms: Successfully created gym:", data) // Nuevo log
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    console.error("API POST /api/gyms: Unexpected server error:", e) // Captura errores inesperados
    return NextResponse.json({ error: "Internal Server Error", details: e.message }, { status: 500 })
  }
}

// PUT /api/gyms
export async function PUT(request: Request) {
  const { id, name } = await request.json()

  console.log("API PUT /api/gyms received. id:", id, "name:", name) // Nuevo log

  if (!id || !name) {
    console.error("API PUT /api/gyms: id or name is missing.") // Nuevo log
    return NextResponse.json({ error: "id and name are required" }, { status: 400 })
  }

  const supabase = createClient()
  try {
    const { data, error } = await supabase.from("gyms").update({ name }).eq("id", id).select().single()

    if (error) {
      console.error("API PUT /api/gyms: Supabase error:", error) // Log detallado del error de Supabase
      return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
    }

    console.log("API PUT /api/gyms: Successfully updated gym:", data) // Nuevo log
    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    console.error("API PUT /api/gyms: Unexpected server error:", e) // Captura errores inesperados
    return NextResponse.json({ error: "Internal Server Error", details: e.message }, { status: 500 })
  }
}
