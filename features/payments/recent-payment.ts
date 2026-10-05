import { supabase } from "@/lib/supabase";

export async function confirmRecentPayment(
  gymId: string,
  memberId: string,
  paymentDate: string,
): Promise<boolean> {
  const date = new Date(`${paymentDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Fecha de pago inválida");
  }
  date.setUTCDate(date.getUTCDate() - 10);
  const fromDate = date.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("payments")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .gte("date", fromDate)
    .lte("date", paymentDate)
    .limit(1);

  if (error) {
    throw new Error("No se pudieron verificar los pagos recientes. Inténtalo de nuevo.");
  }

  return !data?.length || window.confirm(
    "Usted ya ha registrado un pago para este socio en los últimos diez días, ¿quiere volver a registrar otro?",
  );
}
