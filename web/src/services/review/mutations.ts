"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";

export async function claimReviewAction(
  reviewId: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { data: current } = await supabase
    .from("review_queue")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (!current) return fail("Item não encontrado.", "NOT_FOUND");
  if (current.status === "aprovado" || current.status === "rejeitado") {
    return fail("Este item já foi decidido.");
  }

  const { error } = await supabase
    .from("review_queue")
    .update({
      status: "em_analise",
      assigned_to: profile.id,
    })
    .eq("id", reviewId)
    .in("status", ["pendente", "nova_revisao", "em_analise"]);

  if (error) return mapSupabaseError(error, "Não foi possível assumir a revisão.");

  await writeAuditLog(supabase, {
    action: "review.claim",
    entityType: "review_queue",
    entityId: reviewId,
  });

  revalidatePath("/validacao");
  return ok({ id: reviewId });
}

export async function releaseReviewAction(
  reviewId: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { error } = await supabase
    .from("review_queue")
    .update({ status: "pendente", assigned_to: null })
    .eq("id", reviewId)
    .eq("status", "em_analise");

  if (error) return mapSupabaseError(error, "Não foi possível liberar a revisão.");

  await writeAuditLog(supabase, {
    action: "review.release",
    entityType: "review_queue",
    entityId: reviewId,
  });

  revalidatePath("/validacao");
  return ok({ id: reviewId });
}

export async function decideReviewAction(input: {
  reviewId: string;
  decision: "aprovado" | "rejeitado" | "nova_revisao";
  reason?: string;
  mergeIntoDoctorId?: string;
}): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  if (input.decision === "rejeitado" && !input.reason?.trim()) {
    return fail("A rejeição exige motivo.");
  }

  const { data: item } = await supabase
    .from("review_queue")
    .select("*")
    .eq("id", input.reviewId)
    .maybeSingle();

  if (!item) return fail("Item não encontrado.", "NOT_FOUND");
  if (item.status === "aprovado" || item.status === "rejeitado") {
    return fail("Este item já foi decidido. Evite cliques repetidos.");
  }

  const { error } = await supabase
    .from("review_queue")
    .update({
      status: input.decision,
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
      notes: input.reason || item.notes,
      duplicate_of_doctor_id: input.mergeIntoDoctorId || item.duplicate_of_doctor_id,
    })
    .eq("id", input.reviewId)
    .in("status", ["pendente", "em_analise", "nova_revisao"]);

  if (error) return mapSupabaseError(error, "Não foi possível concluir a validação.");

  if (item.doctor_id && input.decision === "aprovado") {
    if (input.mergeIntoDoctorId) {
      await supabase
        .from("doctors")
        .update({
          is_deleted: true,
          archive_reason: `Associado a ${input.mergeIntoDoctorId}`,
          archived_at: new Date().toISOString(),
          archived_by: profile.id,
        })
        .eq("id", item.doctor_id);

      await writeAuditLog(supabase, {
        action: "review.merge",
        entityType: "doctor",
        entityId: item.doctor_id,
        metadata: { merge_into: input.mergeIntoDoctorId },
      });
    } else {
      await supabase
        .from("doctors")
        .update({
          layer: "oficial",
          classification: "atuacao_institucional_confirmada",
          validation_status: "validada",
          last_validated_at: new Date().toISOString(),
          last_validated_by: profile.id,
          confidence_score: 80,
        })
        .eq("id", item.doctor_id);
    }
  }

  if (item.doctor_id && input.decision === "rejeitado") {
    await supabase
      .from("doctors")
      .update({
        classification: "rejeitado",
        validation_status: "rejeitada",
        last_validated_at: new Date().toISOString(),
        last_validated_by: profile.id,
      })
      .eq("id", item.doctor_id);
  }

  if (item.doctor_id && input.decision === "nova_revisao") {
    await supabase
      .from("doctors")
      .update({ validation_status: "aguardando_informacao" })
      .eq("id", item.doctor_id);
  }

  await writeAuditLog(supabase, {
    action: `review.${input.decision}`,
    entityType: "review_queue",
    entityId: input.reviewId,
    metadata: {
      doctor_id: item.doctor_id,
      reason: input.reason,
      mergeIntoDoctorId: input.mergeIntoDoctorId,
    },
  });

  revalidatePath("/validacao");
  revalidatePath("/dashboard");
  if (item.doctor_id) revalidatePath(`/medicos/${item.doctor_id}`);
  return ok({ id: input.reviewId });
}
