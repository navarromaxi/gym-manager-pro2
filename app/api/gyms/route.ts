import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

// GET /api/gyms?ownerId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ownerId = searchParams.get("ownerId")

  if (!ownerId) {
    return NextResponse.json({ error: "ownerId is required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.from("gyms").select("*").eq("owner_id", ownerId).single()

  if (error) {
    // PGRST116 means no rows found (expected for new users), so we don't treat it as a critical error
    if (error.code === "PGRST116") {
      return NextResponse.json([], { status: 200 }) // Return empty array if no gym found
    }
    console.error("Error fetching gym from Supabase:", error) // Log the detailed Supabase error
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
  }

  return NextResponse.json(data ? [data] : [], { status: 200 })
}

// POST /api/gyms
export async function POST(request: Request) {
  const { name, ownerId } = await request.json()

  if (!name || !ownerId) {
    return NextResponse.json({ error: "name and ownerId are required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("gyms")
    .insert([{ name, owner_id: ownerId }])
    .select()
    .single()

  if (error) {
    console.error("Error creating gym in Supabase:", error) // Log the detailed Supabase error
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PUT /api/gyms
export async function PUT(request: Request) {
  const { id, name } = await request.json()

  if (!id || !name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.from("gyms").update({ name }).eq("id", id).select().single()

  if (error) {
    console.error("Error updating gym in Supabase:", error) // Log the detailed Supabase error
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}
