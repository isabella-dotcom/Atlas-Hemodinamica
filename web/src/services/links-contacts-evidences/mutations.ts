"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import { linkSchema, linkUpdateSchema } from "@/services/links/schemas";
import { contactSchema } from "@/services/contacts/schemas";
import { evidenceSchema } from "@/services/evidences/schemas";

export async function createLinkAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;

  const { data, error } = await supabase
    .from("doctor_facility_links")
    .insert({
      ...values,
      source_id: values.source_id || null,
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

  revalidatePath(`/medicos/${values.doctor_id}`);
  revalidatePath(`/estabelecimentos/${values.facility_id}`);
  return ok({ id: data.id });
}

export async function updateLinkAction(
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

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

  const { error } = await supabase
    .from("doctor_facility_links")
    .update(parsed.data)
    .eq("id", id);
  if (error) return mapSupabaseError(error, "Não foi possível atualizar o vínculo.");

  await writeAuditLog(supabase, {
    action: "link.update",
    entityType: "link",
    entityId: id,
    before: before as Record<string, unknown>,
    after: parsed.data as Record<string, unknown>,
  });

  revalidatePath(`/medicos/${before.doctor_id}`);
  revalidatePath(`/estabelecimentos/${before.facility_id}`);
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
    .update({ is_deleted: true, status: "encerrado" })
    .eq("id", id);
  if (error) return mapSupabaseError(error, "Não foi possível arquivar o vínculo.");

  await writeAuditLog(supabase, {
    action: "link.archive",
    entityType: "link",
    entityId: id,
  });

  revalidatePath(`/medicos/${before.doctor_id}`);
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

  const { data, error } = await supabase
    .from("professional_contacts")
    .insert({
      ...values,
      doctor_id: values.doctor_id || null,
      facility_id: values.facility_id || null,
      source_id: values.source_id || null,
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

  if (values.doctor_id) revalidatePath(`/medicos/${values.doctor_id}`);
  if (values.facility_id) {
    revalidatePath(`/estabelecimentos/${values.facility_id}`);
  }
  return ok({ id: data.id });
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
    .update({ do_not_contact: true })
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

  if (contact.doctor_id) revalidatePath(`/medicos/${contact.doctor_id}`);
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
      ...values,
      url: values.url || null,
      source_id: values.source_id || null,
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

  return ok({ id });
}
