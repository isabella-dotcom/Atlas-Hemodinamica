"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { normalizeCnpj, normalizeUf } from "@/lib/format";
import { normalizePersonName } from "@/lib/utils";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import {
  facilityCreateSchema,
  facilityUpdateSchema,
  triStateToBool,
} from "@/services/facilities/schemas";

function buildFacilityPatch(values: Record<string, unknown>) {
  const patch: Record<string, unknown> = { ...values };

  if (typeof values.name === "string") {
    patch.normalized_name = normalizePersonName(values.name);
  }
  if (values.cnpj !== undefined) {
    patch.cnpj = values.cnpj ? normalizeCnpj(String(values.cnpj)) : null;
  }
  if (typeof values.state_uf === "string") {
    patch.state_uf = normalizeUf(values.state_uf);
  }
  if (values.cnes !== undefined) {
    patch.cnes = values.cnes ? String(values.cnes).trim() : null;
  }

  for (const key of ["attends_sus", "attends_private", "attends_insurance"] as const) {
    if (values[key] !== undefined) {
      patch[key] = triStateToBool(values[key] as "unknown" | "yes" | "no");
    }
  }

  for (const key of Object.keys(patch)) {
    if (patch[key] === "") patch[key] = null;
  }

  return patch;
}

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

  const patch = buildFacilityPatch(values as unknown as Record<string, unknown>);

  const { data, error } = await supabase
    .from("health_facilities")
    .insert({
      ...patch,
      cnes,
      layer: "candidato",
      created_by: profile.id,
      is_demo: false,
      has_hemodynamics: values.has_hemodynamics,
      confidence_score: values.confidence_score,
      is_active: values.is_active ?? true,
      service_status: values.service_status || "desconhecido",
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
  const patch = buildFacilityPatch(values as unknown as Record<string, unknown>);

  if (values.cnes !== undefined) {
    const cnes = values.cnes?.trim() || null;
    patch.cnes = cnes;
    if (cnes) {
      const { data: existing } = await supabase
        .from("health_facilities")
        .select("id, name")
        .eq("cnes", cnes)
        .eq("is_deleted", false)
        .neq("id", id)
        .maybeSingle();
      if (existing) {
        return fail(
          `O estabelecimento informado já possui o mesmo CNES (${existing.name}).`,
          "DUPLICATE_CNES",
        );
      }
    }
  }

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
      is_active: false,
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

export async function restoreFacilityAction(
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { error } = await supabase
    .from("health_facilities")
    .update({
      is_deleted: false,
      is_active: true,
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq("id", id);

  if (error) {
    return mapSupabaseError(error, "Não foi possível restaurar o estabelecimento.");
  }

  await writeAuditLog(supabase, {
    action: "facility.restore",
    entityType: "facility",
    entityId: id,
  });

  revalidatePath("/estabelecimentos");
  revalidatePath(`/estabelecimentos/${id}`);
  return ok({ id });
}
