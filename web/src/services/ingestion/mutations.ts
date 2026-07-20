"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";

export type EnqueueIngestionInput = {
  job_type: string;
  source_code: string;
  state_uf?: string | null;
  competence?: string | null;
  parameters?: Record<string, unknown>;
};

export async function enqueueIngestionJobAction(
  input: EnqueueIngestionInput,
): Promise<ServiceResult<{ id: string; queued: boolean; workflow_triggered: boolean }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { data, error } = await supabase.rpc("enqueue_ingestion_job", {
    p_job_type: input.job_type,
    p_source_code: input.source_code,
    p_state_uf: input.state_uf || null,
    p_competence: input.competence || null,
    p_parameters: input.parameters ?? {},
  });

  if (error) {
    return mapSupabaseError(error, "Não foi possível enfileirar o job.");
  }

  const jobId = String(data);
  await writeAuditLog(supabase, {
    action: "ingestion.enqueue",
    entityType: "ingestion_job",
    entityId: jobId,
    after: {
      job_type: input.job_type,
      source_code: input.source_code,
      state_uf: input.state_uf,
      competence: input.competence,
      requested_by: profile.id,
    },
  });

  // Disparo opcional do GitHub Actions (se secrets server-side existirem)
  let workflowTriggered = false;
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const workflow = process.env.GITHUB_WORKFLOW_REF || "cnes-ingestion.yml";
  if (token && repo) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({
            ref: "main",
            inputs: {
              job_id: jobId,
              state_uf: input.state_uf || "MG",
              competence: input.competence || "",
              fallback_url: String(input.parameters?.fallback_url || ""),
            },
          }),
        },
      );
      workflowTriggered = res.ok;
    } catch {
      workflowTriggered = false;
    }
  }

  revalidatePath("/importacoes");
  revalidatePath("/importacoes/jobs");
  revalidatePath("/dashboard");
  return ok({ id: jobId, queued: true, workflow_triggered: workflowTriggered });
}

export async function cancelIngestionJobAction(
  jobId: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { error } = await supabase.rpc("cancel_ingestion_job", { p_job_id: jobId });
  if (error) return mapSupabaseError(error, "Não foi possível cancelar o job.");

  await writeAuditLog(supabase, {
    action: "ingestion.cancel",
    entityType: "ingestion_job",
    entityId: jobId,
  });

  revalidatePath("/importacoes/jobs");
  revalidatePath(`/importacoes/jobs/${jobId}`);
  return ok({ id: jobId });
}

export async function requeueIngestionJobAction(
  jobId: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { data: job } = await supabase
    .from("ingestion_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return fail("Job não encontrado.", "NOT_FOUND");

  const { data, error } = await supabase.rpc("enqueue_ingestion_job", {
    p_job_type: job.job_type,
    p_source_code: job.source_code,
    p_state_uf: job.state_uf,
    p_competence: job.competence,
    p_parameters: {
      ...(job.parameters || {}),
      reprocessed_from: jobId,
      force: true,
    },
  });
  if (error) return mapSupabaseError(error, "Falha ao reprocessar.");

  await writeAuditLog(supabase, {
    action: "ingestion.requeue",
    entityType: "ingestion_job",
    entityId: String(data),
    after: { from: jobId, by: profile.id },
  });

  revalidatePath("/importacoes/jobs");
  return ok({ id: String(data) });
}

export async function createFieldOverrideAction(input: {
  entity_type: string;
  entity_id: string;
  field_name: string;
  override_value: unknown;
  reason: string;
}): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  if (!input.reason?.trim()) return fail("Justificativa obrigatória.");

  await supabase
    .from("manual_field_overrides")
    .update({
      is_active: false,
      removed_by: profile.id,
      removed_at: new Date().toISOString(),
    })
    .eq("entity_type", input.entity_type)
    .eq("entity_id", input.entity_id)
    .eq("field_name", input.field_name)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("manual_field_overrides")
    .insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      field_name: input.field_name,
      override_value: input.override_value,
      reason: input.reason.trim(),
      overridden_by: profile.id,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(error, "Não foi possível criar override.");
  }

  await writeAuditLog(supabase, {
    action: "override.create",
    entityType: input.entity_type,
    entityId: input.entity_id,
    after: {
      field_name: input.field_name,
      override_value: input.override_value,
      reason: input.reason,
    },
  });

  revalidatePath(`/medicos/${input.entity_id}`);
  revalidatePath(`/estabelecimentos/${input.entity_id}`);
  return ok({ id: data.id });
}

export async function acceptSourceObservationAction(input: {
  observation_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
}): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { data: obs } = await supabase
    .from("source_observations")
    .select("*")
    .eq("id", input.observation_id)
    .maybeSingle();
  if (!obs) return fail("Observação não encontrada.");

  // Desativa override ativo do campo (aceita valor da fonte)
  await supabase
    .from("manual_field_overrides")
    .update({
      is_active: false,
      removed_by: profile.id,
      removed_at: new Date().toISOString(),
    })
    .eq("entity_type", input.entity_type)
    .eq("entity_id", input.entity_id)
    .eq("field_name", input.field_name)
    .eq("is_active", true);

  await writeAuditLog(supabase, {
    action: "override.accept_source",
    entityType: input.entity_type,
    entityId: input.entity_id,
    after: {
      field_name: input.field_name,
      observed_value: obs.observed_value,
      observation_id: obs.id,
    },
  });

  revalidatePath(`/medicos/${input.entity_id}`);
  revalidatePath(`/estabelecimentos/${input.entity_id}`);
  return ok({ id: obs.id });
}

export async function registerCrmConsultationAction(input: {
  doctor_id: string;
  crm_number: string;
  state_uf: string;
  status?: string;
  rqe_number?: string;
  rqe_area?: string;
  notes?: string;
  evidence_url?: string;
}): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { data, error } = await supabase
    .from("medical_registrations")
    .insert({
      doctor_id: input.doctor_id,
      registration_type: "CRM",
      number: input.crm_number.replace(/\D/g, ""),
      state_uf: input.state_uf.toUpperCase(),
      status: input.status || "ativo",
      verification_status: "verificado",
      verified_at: new Date().toISOString(),
      notes: `Consulta assistida CFM/CRM — ${input.notes || ""}`.trim(),
      confidence_score: 80,
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(error, "Falha ao registrar consulta CRM.");
  }

  if (input.rqe_number) {
    await supabase.from("medical_registrations").insert({
      doctor_id: input.doctor_id,
      registration_type: "RQE",
      number: input.rqe_number.replace(/\D/g, ""),
      state_uf: input.state_uf.toUpperCase(),
      rqe_area: input.rqe_area || null,
      verification_status: "verificado",
      verified_at: new Date().toISOString(),
      notes: "RQE registrado via consulta assistida",
      confidence_score: 75,
    });
  }

  if (input.evidence_url) {
    await supabase.from("evidences").insert({
      entity_type: "doctor",
      entity_id: input.doctor_id,
      title: "Consulta oficial CFM/CRM",
      url: input.evidence_url,
      status: "pendente",
      created_by: profile.id,
      confirmed_field: "crm",
      captured_value: `${input.crm_number}/${input.state_uf}`,
    });
  }

  await writeAuditLog(supabase, {
    action: "crm.assisted_consultation",
    entityType: "doctor",
    entityId: input.doctor_id,
    after: input,
  });

  revalidatePath(`/medicos/${input.doctor_id}`);
  return ok({ id: data.id });
}
