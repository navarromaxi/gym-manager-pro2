import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { evaluateMemberAccess, normalizeCedula } from "@/lib/member-access";
import { createClient } from "@/lib/supabase-server";

const bodySchema = z.object({
  gymId: z.string().min(1, "El identificador del gimnasio es obligatorio."),
  cedula: z.string().min(1, "La cédula es obligatoria."),
});

const MEMBER_ACCESS_LOGS_TABLE = "member_access_logs";

const isMissingRelationError = (message?: string) => {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("relation") ||
    normalized.includes("schema cache")
  );
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Debes indicar el gimnasio y la cédula.",
      },
      { status: 400 }
    );
  }

  const normalizedCedula = normalizeCedula(parsedBody.data.cedula);
  if (!normalizedCedula) {
    return NextResponse.json(
      {
        error: "Ingresa una cédula válida.",
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient();
    const { data: exactMember, error: memberError } = await supabase
      .from("members")
      .select("id, name, next_payment, cedula")
      .eq("gym_id", parsedBody.data.gymId)
      .eq("cedula", normalizedCedula)
      .maybeSingle();

    if (memberError) {
      console.error("Error fetching member access data", memberError);
      return NextResponse.json(
        {
          error: "No pudimos validar el acceso en este momento.",
        },
        { status: 500 }
      );
    }

    let member = exactMember;

    if (!member) {
      const { data: candidates, error: candidatesError } = await supabase
        .from("members")
        .select("id, name, next_payment, cedula")
        .eq("gym_id", parsedBody.data.gymId)
        .not("cedula", "is", null);

      if (candidatesError) {
        console.error(
          "Error fetching member access candidates",
          candidatesError
        );
        return NextResponse.json(
          {
            error: "No pudimos validar el acceso en este momento.",
          },
          { status: 500 }
        );
      }

      member =
        candidates?.find(
          (candidate) =>
            normalizeCedula(candidate.cedula ?? "") === normalizedCedula
        ) ?? null;
    }

    const evaluation = evaluateMemberAccess(member ?? null);

    const { error: logError } = await supabase
      .from(MEMBER_ACCESS_LOGS_TABLE)
      .insert([
        {
          id: randomUUID(),
          gym_id: parsedBody.data.gymId,
          member_id: evaluation.memberId,
          member_name: evaluation.memberName,
          cedula_entered: parsedBody.data.cedula.trim(),
          normalized_cedula: normalizedCedula,
          result: evaluation.status,
          status_color: evaluation.color,
          message: evaluation.message,
          days_remaining: evaluation.daysRemaining,
          days_expired: evaluation.daysExpired,
        },
      ]);

    if (logError) {
      if (isMissingRelationError(logError.message)) {
        console.warn(
          `La tabla ${MEMBER_ACCESS_LOGS_TABLE} no existe todavía. El acceso se resolvió sin guardar log.`
        );
      } else {
        console.error("Error saving member access log", logError);
      }
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("Unexpected error validating member access", error);
    return NextResponse.json(
      {
        error: "No pudimos validar el acceso en este momento.",
      },
      { status: 500 }
    );
  }
}
