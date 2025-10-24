import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";

const paramsSchema = z.object({
  gymId: z.string().min(1, "El identificador del gimnasio es obligatorio."),
});

export async function GET(
  _request: Request,
  context: { params: { gymId?: string } }
) {
  const parsedParams = paramsSchema.safeParse({
    gymId: context.params?.gymId,
  });

  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "El identificador del gimnasio es obligatorio.",
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient();
    const response = await supabase
      .from("gyms")
      .select("id, name, logo_url")
      .eq("id", parsedParams.data.gymId)
      .maybeSingle();

    if (response.error) {
      console.error("Error fetching public gym info", response.error);
      return NextResponse.json(
        {
          error: "No se pudo obtener la información del gimnasio.",
        },
        { status: 500 }
      );
    }

    if (!response.data) {
      return NextResponse.json(
        {
          error: "El gimnasio no existe o no está disponible.",
        },
        { status: 404 }
      );
    }

    const { id, name, logo_url } = response.data;

    return NextResponse.json({
      data: {
        id,
        name:
          typeof name === "string" && name.trim().length > 0 ? name : null,
        logoUrl:
          typeof logo_url === "string" && logo_url.trim().length > 0
            ? logo_url
            : null,
      },
    });
  } catch (error) {
    console.error("Unexpected error fetching public gym info", error);
    return NextResponse.json(
      {
        error: "No se pudo obtener la información del gimnasio.",
      },
      { status: 500 }
    );
  }
}
