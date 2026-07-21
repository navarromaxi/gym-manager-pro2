import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";

/**
 * Authorizes an administrative request for a specific gym.
 *
 * Public flows (kiosk access and public class registration) deliberately do
 * not use this helper. Every management endpoint must use it before accessing
 * data with the service-role Supabase client.
 */
export async function authorizeGymRequest(request: Request, gymId: string) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Tu sesión venció. Inicia sesión nuevamente para continuar." },
        { status: 401 }
      ),
    };
  }

  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      error: NextResponse.json(
        { error: "Tu sesión no es válida. Inicia sesión nuevamente." },
        { status: 401 }
      ),
    };
  }

  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("id, subscription")
    .eq("id", gymId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (gymError) {
    console.error("Error authorizing gym request", gymError);
    return {
      error: NextResponse.json(
        { error: "No se pudo validar los permisos del gimnasio." },
        { status: 500 }
      ),
    };
  }

  if (!gym || !["active", "trial"].includes(gym.subscription ?? "")) {
    return {
      error: NextResponse.json(
        { error: "No tienes permisos para administrar este gimnasio." },
        { status: 403 }
      ),
    };
  }

  return { gymId: gym.id, userId: userData.user.id };
}
