import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gymId = searchParams.get("gymId")

  if (!gymId) {
    return NextResponse.json({ error: "gymId is required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.from("plans").select("*").eq("gym_id", gymId)

  if (error) {
    console.error("Error fetching plans:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}
