import {
  insertMemberWithFallback,
  supabase,
  updateMemberWithFallback,
} from "@/lib/supabase";
import type { Member, Payment } from "@/lib/supabase";
import type { ContractTableName } from "@/lib/contract-table";

/**
 * Keeps the existing deletion order intact: payments are removed before the member.
 * The caller remains responsible for updating local UI state after a successful call.
 */
export const deleteMemberAndPayments = async (memberId: string) => {
  const { error: paymentsError } = await supabase
    .from("payments")
    .delete()
    .eq("member_id", memberId);
  if (paymentsError) throw paymentsError;

  const { error: memberError } = await supabase
    .from("members")
    .delete()
    .eq("id", memberId);
  if (memberError) throw memberError;
};

/** Keeps member profile and its visible name in related records synchronized. */
export const updateMemberAndRelatedNames = async (
  memberId: string,
  memberName: string,
  changes: Record<string, unknown>
) => {
  const { error } = await updateMemberWithFallback(memberId, changes);
  if (error) throw error;

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({ member_name: memberName })
    .eq("member_id", memberId);
  if (paymentUpdateError) throw paymentUpdateError;

  const { error: customPlansUpdateError } = await supabase
    .from("custom_plans")
    .update({ member_name: memberName })
    .eq("member_id", memberId);
  if (customPlansUpdateError) throw customPlansUpdateError;
};

/** Persists a new member using the existing member → optional contract → payment order. */
export const createMemberWithInitialPayment = async ({
  member,
  payment,
  contractTable,
  installments,
  planId,
}: {
  member: Member;
  payment: Payment;
  contractTable: ContractTableName | null;
  installments: number;
  planId?: string;
}) => {
  const { description: _memberDescription, ...memberInsert } = member;
  const { error: memberError } = await insertMemberWithFallback(memberInsert);
  if (memberError) throw memberError;

  if (contractTable && installments > 1 && planId) {
    const contract = {
      id: `${member.id}_contract_${Date.now()}`,
      gym_id: member.gym_id,
      member_id: member.id,
      plan_id: planId,
      installments_total: installments,
      installments_paid: 1,
    };
    const { error: contractError } = await supabase.from(contractTable).insert([contract]);
    if (contractError) console.warn("Error registrando contrato de plan:", contractError);
  }

  const { error: paymentError } = await supabase.from("payments").insert([payment]);
  if (paymentError) throw paymentError;
};

export const updateMemberFlag = async (
  memberId: string,
  flag: "followed_up" | "expiring_soon_contacted"
) => {
  const { error } = await updateMemberWithFallback(memberId, { [flag]: true });
  if (error) throw error;
};
