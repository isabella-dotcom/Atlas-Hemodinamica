"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { normalizeCnpj, normalizeUf } from "@/lib/format";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import {
  facilityCreateSchema,
  facilityUpdateSchema,
} from "@/services/facilities/schemas";

export async function createFacilityAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const parsed = facilityCreateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;
  const cnpj = values.cnpj ? normalizeCnpj(values.cnpj) : null;
  const cnes = values.cnes?.trim() || null;

  if (cnes) {
    const { data: existing } = await supabase
      .from("health_facilities")
      .select("id, name")
      .eq("cnes", cnes)
      .eq("is_deleted", false)
      .maybeSingle();
    if (existing) {
      return fail(
        `O estabelecimento informado já possui o mesmo CNES (${existing.name}).`,
        "DUPLICATE_CNES",
      );
    }
  }

  const { data, error } = await supabase
    .from("health_facilities")
    .insert({
      name: values.name,
      trade_name: values.trade_name || null,
      cnes,
      cnpj,
      facility_type: values.facility_type || null,
      city: values.city,
      state_uf: normalizeUf(values.state_uf),
      address_street: values.address_street || null,
      address_number: values.address_number || null,
      address_district: values.address_district || null,
      address_zip: values.address_zip || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      attends_sus:
        values.attends_sus === "unknown"
          ? null
          : values.attends_sus === "yes",
      has_hemodynamics: values.has_hemodynamics,
      service_status: values.service_status || "desconhecido",
      source_id: values.source_id || null,
      notes: values.notes || null,
      confidence_score: values.confidence_score,
      layer: "candidato",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(error, "Não foi possível criar o estabelecimento.");
  }

  await writeAuditLog(supabase, {
    action: "facility.create",
    entityType: "facility",
    entityId: data.id,
    after: { name: values.name, cnes },
  });

  revalidatePath("/estabelecimentos");
  revalidatePath("/dashboard");
  return ok({ id: data.id });
}

export async function updateFacilityAction(
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const parsed = facilityUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const { data: before } = await supabase
    .from("health_facilities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("Estabelecimento não encontrado.", "NOT_FOUND");

  const values = parsed.data;
  const patch: Record<string, unknown> = { ...values };
  if (values.cnpj !== undefined) patch.cnpj = values.cnpj ? normalizeCnpj(values.cnpj) : null;
  if (values.state_uf) patch.state_uf = normalizeUf(values.state_uf);
  if (values.attends_sus) {
    patch.attends_sus =
      values.attends_sus === "unknown" ? null : values.attends_sus === "yes";
  }
  if (values.source_id === "") patch.source_id = null;
  if (values.email === "") patch.email = null;
  if (values.website === "") patch.website = null;

  const { error } = await supabase.from("health_facilities").update(patch).eq("id", id);
  if (error) {
    return mapSupabaseError(error, "Não foi possível atualizar o estabelecimento.");
  }

  await writeAuditLog(supabase, {
    action: "facility.update",
    entityType: "facility",
    entityId: id,
    before: before as Record<string, unknown>,
    after: patch,
  });

  revalidatePath(`/estabelecimentos/${id}`);
  revalidatePath("/estabelecimentos");
  return ok({ id });
}

export async function archiveFacilityAction(
  id: string,
  reason?: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { error } = await supabase
    .from("health_facilities")
    .update({
      is_deleted: true,
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      archive_reason: reason || "Arquivado",
    })
    .eq("id", id);

  if (error) {
    return mapSupabaseError(error, "Não foi possível arquivar o estabelecimento.");
  }

  await writeAuditLog(supabase, {
    action: "facility.archive",
    entityType: "facility",
    entityId: id,
    metadata: { reason },
  });

  revalidatePath("/estabelecimentos");
  return ok({ id });
}
