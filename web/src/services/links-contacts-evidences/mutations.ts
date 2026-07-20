"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import { linkSchema, linkUpdateSchema } from "@/services/links/schemas";
import { contactSchema, contactUpdateSchema } from "@/services/contacts/schemas";
import { evidenceSchema } from "@/services/evidences/schemas";

function revalidateEntityPaths(doctorId?: string | null, facilityId?: string | null) {
  if (doctorId) revalidatePath(`/medicos/${doctorId}`);
  if (facilityId) revalidatePath(`/estabelecimentos/${facilityId}`);
}

export async function createLinkAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;

  const { data, error } = await supabase
    .from("doctor_facility_links")
    .insert({
      doctor_id: values.doctor_id,
      facility_id: values.facility_id,
      role_title: values.role_title ?? null,
      function_title: values.function_title ?? null,
      department: values.department ?? null,
      practiced_specialty: values.practiced_specialty ?? null,
      relationship_type: values.relationship_type ?? null,
      is_coordinator: values.is_coordinator,
      is_team_leader: values.is_team_leader,
      is_technical_responsible: values.is_technical_responsible,
      is_clinical_staff: values.is_clinical_staff,
      coordinator_justification: values.coordinator_justification ?? null,
      coordinator_confirmed: values.coordinator_confirmed,
      weekly_hours: values.weekly_hours ?? null,
      is_sus_link: values.is_sus_link ?? null,
      evidence_id: values.evidence_id ?? null,
      status: values.status,
      started_on: values.started_on ?? null,
      ended_on: values.ended_on ?? null,
      source_id: values.source_id || null,
      confidence_score: values.confidence_score,
      notes: values.notes ?? null,
      layer: values.layer,
      last_verified_at: values.last_verified_at ?? null,
      verified_by: values.last_verified_at ? profile.id : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(
      error,
      "Não foi possível criar o vínculo. Verifique duplicidade.",
    );
  }

  await writeAuditLog(supabase, {
    action: "link.create",
    entityType: "link",
    entityId: data.id,
    after: values as unknown as Record<string, unknown>,
  });

  revalidateEntityPaths(values.doctor_id, values.facility_id);
  return ok({ id: data.id });
}

export async function updateLinkAction(
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const parsed = linkUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const { data: before } = await supabase
    .from("doctor_facility_links")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("Vínculo não encontrado.", "NOT_FOUND");

  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.last_verified_at) {
    patch.verified_by = profile.id;
  }
  if (parsed.data.status === "encerrado" && !parsed.data.ended_on) {
    patch.ended_on = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("doctor_facility_links")
    .update(patch)
    .eq("id", id);
  if (error) return mapSupabaseError(error, "Não foi possível atualizar o vínculo.");

  await writeAuditLog(supabase, {
    action: "link.update",
    entityType: "link",
    entityId: id,
    before: before as Record<string, unknown>,
    after: patch,
  });

  revalidateEntityPaths(before.doctor_id, before.facility_id);
  return ok({ id });
}

export async function archiveLinkAction(
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { data: before } = await supabase
    .from("doctor_facility_links")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("Vínculo não encontrado.", "NOT_FOUND");

  const { error } = await supabase
    .from("doctor_facility_links")
    .update({
      is_deleted: true,
      status: "encerrado",
      ended_on: before.ended_on ?? new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);
  if (error) return mapSupabaseError(error, "Não foi possível arquivar o vínculo.");

  await writeAuditLog(supabase, {
    action: "link.archive",
    entityType: "link",
    entityId: id,
  });

  revalidateEntityPaths(before.doctor_id, before.facility_id);
  return ok({ id });
}

export async function createContactAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;

  if (values.is_primary && values.doctor_id) {
    await supabase
      .from("professional_contacts")
      .update({ is_primary: false })
      .eq("doctor_id", values.doctor_id);
  }
  if (values.is_primary && values.facility_id) {
    await supabase
      .from("professional_contacts")
      .update({ is_primary: false })
      .eq("facility_id", values.facility_id);
  }

  const { data, error } = await supabase
    .from("professional_contacts")
    .insert({
      doctor_id: values.doctor_id || null,
      facility_id: values.facility_id || null,
      channel: values.channel,
      value: values.value,
      label: values.label ?? null,
      is_institutional: values.is_institutional,
      is_publicly_available: values.is_publicly_available,
      is_primary: values.is_primary,
      do_not_contact: values.do_not_contact,
      contact_status: values.contact_status,
      accepts_contact: values.accepts_contact ?? null,
      source_origin: values.source_origin ?? null,
      collected_at: values.collected_at ?? null,
      last_attempt_at: values.last_attempt_at ?? null,
      last_attempt_result: values.last_attempt_result ?? null,
      source_id: values.source_id || null,
      confidence_score: values.confidence_score,
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(error, "Não foi possível salvar o contato.");
  }

  await writeAuditLog(supabase, {
    action: "contact.create",
    entityType: "contact",
    entityId: data.id,
    after: { channel: values.channel, do_not_contact: values.do_not_contact },
  });

  revalidateEntityPaths(values.doctor_id, values.facility_id);
  return ok({ id: data.id });
}

export async function updateContactAction(
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const parsed = contactUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const { data: before } = await supabase
    .from("professional_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("Contato não encontrado.", "NOT_FOUND");

  const values = parsed.data;
  const patch: Record<string, unknown> = { ...values };

  if (
    values.contact_status === "valido" ||
    values.contact_status === "invalido" ||
    values.contact_status === "desatualizado"
  ) {
    patch.verified_at = new Date().toISOString();
    patch.verified_by = profile.id;
    patch.last_validated_at = new Date().toISOString();
    patch.last_validated_by = profile.id;
  }

  if (values.is_primary === true) {
    if (before.doctor_id) {
      await supabase
        .from("professional_contacts")
        .update({ is_primary: false })
        .eq("doctor_id", before.doctor_id)
        .neq("id", id);
    }
    if (before.facility_id) {
      await supabase
        .from("professional_contacts")
        .update({ is_primary: false })
        .eq("facility_id", before.facility_id)
        .neq("id", id);
    }
  }

  const { error } = await supabase
    .from("professional_contacts")
    .update(patch)
    .eq("id", id);
  if (error) return mapSupabaseError(error, "Não foi possível atualizar o contato.");

  await writeAuditLog(supabase, {
    action: "contact.update",
    entityType: "contact",
    entityId: id,
    before: before as Record<string, unknown>,
    after: patch,
  });

  revalidateEntityPaths(before.doctor_id, before.facility_id);
  return ok({ id });
}

export async function markDoNotContactAction(
  id: string,
  reason: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { data: contact } = await supabase
    .from("professional_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contact) return fail("Contato não encontrado.", "NOT_FOUND");

  const { error } = await supabase
    .from("professional_contacts")
    .update({ do_not_contact: true, accepts_contact: false })
    .eq("id", id);
  if (error) {
    return mapSupabaseError(error, "Não foi possível marcar o contato.");
  }

  await supabase.from("contact_restrictions").insert({
    contact_id: id,
    doctor_id: contact.doctor_id,
    reason,
    created_by: profile.id,
  });

  await writeAuditLog(supabase, {
    action: "contact.do_not_contact",
    entityType: "contact",
    entityId: id,
    metadata: { reason },
  });

  revalidateEntityPaths(contact.doctor_id, contact.facility_id);
  return ok({ id });
}

export async function softDeleteContactAction(
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { data: contact } = await supabase
    .from("professional_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contact) return fail("Contato não encontrado.", "NOT_FOUND");

  const { error } = await supabase
    .from("professional_contacts")
    .update({ is_deleted: true, is_primary: false })
    .eq("id", id);
  if (error) {
    return mapSupabaseError(error, "Não foi possível excluir o contato.");
  }

  await writeAuditLog(supabase, {
    action: "contact.soft_delete",
    entityType: "contact",
    entityId: id,
  });

  revalidateEntityPaths(contact.doctor_id, contact.facility_id);
  return ok({ id });
}

export async function createEvidenceAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;

  const { data, error } = await supabase
    .from("evidences")
    .insert({
      entity_type: values.entity_type,
      entity_id: values.entity_id,
      source_id: values.source_id || null,
      title: values.title,
      description: values.description ?? null,
      url: values.url || null,
      collected_at: values.collected_at ?? null,
      confirmed_field: values.confirmed_field ?? null,
      captured_value: values.captured_value ?? null,
      reliability_score: values.reliability_score ?? null,
      storage_path: values.storage_path ?? null,
      created_by: profile.id,
      status: values.status ?? "pendente",
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(error, "Não foi possível salvar a evidência.");
  }

  await writeAuditLog(supabase, {
    action: "evidence.create",
    entityType: "evidence",
    entityId: data.id,
    after: { title: values.title, entity_type: values.entity_type },
  });

  if (values.entity_type === "doctor") {
    revalidatePath(`/medicos/${values.entity_id}`);
  }
  if (values.entity_type === "facility") {
    revalidatePath(`/estabelecimentos/${values.entity_id}`);
  }
  return ok({ id: data.id });
}

export async function decideEvidenceAction(
  id: string,
  decision: "aceita" | "rejeitada" | "necessita_revisao",
  rejectionReason?: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  if (decision === "rejeitada" && !rejectionReason?.trim()) {
    return fail("Informe o motivo da rejeição.");
  }

  const { data: before } = await supabase
    .from("evidences")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("Evidência não encontrada.", "NOT_FOUND");

  const { error } = await supabase
    .from("evidences")
    .update({
      status: decision,
      rejection_reason: rejectionReason || null,
      validated_by: profile.id,
      validated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return mapSupabaseError(error, "Não foi possível atualizar a evidência.");
  }

  await writeAuditLog(supabase, {
    action: `evidence.${decision}`,
    entityType: "evidence",
    entityId: id,
    metadata: { rejectionReason },
  });

  if (before.entity_type === "doctor") {
    revalidatePath(`/medicos/${before.entity_id}`);
  }
  if (before.entity_type === "facility") {
    revalidatePath(`/estabelecimentos/${before.entity_id}`);
  }
  return ok({ id });
}

export async function getEvidenceSignedUrlAction(
  storagePath: string,
): Promise<ServiceResult<{ url: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { data, error } = await supabase.storage
    .from("evidences")
    .createSignedUrl(storagePath, 60 * 10);

  if (error || !data?.signedUrl) {
    return mapSupabaseError(
      error as { code?: string; message?: string } | null,
      "Não foi possível gerar URL temporária da evidência.",
    );
  }

  return ok({ url: data.signedUrl });
}
