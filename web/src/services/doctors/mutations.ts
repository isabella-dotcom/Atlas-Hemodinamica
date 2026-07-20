"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { buildDoctorNormalizedName, normalizeCrmNumber, normalizeUf } from "@/lib/format";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import {
  doctorCreateSchema,
  doctorUpdateSchema,
  registrationSchema,
  registrationUpdateSchema,
  doctorSpecialtySchema,
} from "@/services/doctors/schemas";

function omitCreateOnlyFields(values: Record<string, unknown>) {
  const omit = new Set([
    "birth_date",
    "crm_number",
    "crm_uf",
    "crm_status",
    "rqe_number",
    "rqe_uf",
    "specialty_id",
    "facility_id",
    "role_title",
    "department",
  ]);
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => !omit.has(key)),
  );
}

async function upsertBirthDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  doctorId: string,
  birthDate: string | null | undefined,
) {
  if (birthDate === undefined) return;
  if (birthDate === null) {
    await supabase.from("doctor_sensitive_fields").delete().eq("doctor_id", doctorId);
    return;
  }
  await supabase.from("doctor_sensitive_fields").upsert({
    doctor_id: doctorId,
    birth_date: birthDate,
  });
}

export async function createDoctorAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const parsed = doctorCreateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;

  if (values.classification === "especialista_confirmado") {
    return fail(
      "Especialista confirmado exige evidência e validação humana. Cadastre como candidato.",
    );
  }

  if ((values.crm_number && !values.crm_uf) || (!values.crm_number && values.crm_uf)) {
    return fail("CRM deve informar número e UF.");
  }

  const row = {
    ...omitCreateOnlyFields(values as unknown as Record<string, unknown>),
    full_name: values.full_name,
    normalized_name: buildDoctorNormalizedName(values.full_name),
    city: values.city,
    state_uf: values.state_uf,
    classification: values.classification,
    validation_status: values.validation_status,
    confidence_score: values.confidence_score,
    notes: values.notes ?? null,
    social_name: values.social_name ?? null,
    sex: values.sex ?? null,
    nationality: values.nationality ?? null,
    photo_path: values.photo_path ?? null,
    biography: values.biography ?? null,
    declared_practice_area: values.declared_practice_area ?? null,
    confirmed_practice_area: values.confirmed_practice_area ?? null,
    practice_keywords: values.practice_keywords ?? [],
    graduation_institution: values.graduation_institution ?? null,
    graduation_year: values.graduation_year ?? null,
    residency: values.residency ?? null,
    specialization: values.specialization ?? null,
    fellowships: values.fellowships ?? [],
    masters_degree: values.masters_degree ?? null,
    doctorate_degree: values.doctorate_degree ?? null,
    professional_titles: values.professional_titles ?? [],
    medical_societies: values.medical_societies ?? [],
    is_sbhci_member: values.is_sbhci_member ?? null,
    lattes_url: values.lattes_url ?? null,
    orcid: values.orcid ?? null,
    scientific_identifiers: values.scientific_identifiers ?? {},
    layer: "candidato",
    created_by: profile.id,
    is_demo: false,
  };

  const { data: doctor, error } = await supabase
    .from("doctors")
    .insert(row)
    .select("id")
    .single();

  if (error || !doctor) {
    return mapSupabaseError(error, "Não foi possível criar o médico.");
  }

  try {
    await upsertBirthDate(supabase, doctor.id, values.birth_date ?? null);

    if (values.crm_number && values.crm_uf) {
      const { error: crmError } = await supabase.from("medical_registrations").insert({
        doctor_id: doctor.id,
        registration_type: "CRM",
        number: normalizeCrmNumber(values.crm_number),
        state_uf: normalizeUf(values.crm_uf),
        status: values.crm_status ?? "desconhecido",
        is_primary: true,
        confidence_score: 20,
      });
      if (crmError) throw crmError;
    }

    if (values.rqe_number && values.rqe_uf) {
      const { error: rqeError } = await supabase.from("medical_registrations").insert({
        doctor_id: doctor.id,
        registration_type: "RQE",
        number: normalizeCrmNumber(values.rqe_number),
        state_uf: normalizeUf(values.rqe_uf),
        status: "desconhecido",
        specialty_id: values.specialty_id || null,
        is_primary: false,
        confidence_score: 15,
      });
      if (rqeError) throw rqeError;
    }

    if (values.specialty_id) {
      const { error: specError } = await supabase.from("doctor_specialties").insert({
        doctor_id: doctor.id,
        specialty_id: values.specialty_id,
        is_confirmed: false,
        is_primary: true,
        confidence_score: 20,
      });
      if (specError) throw specError;
    }

    if (values.facility_id) {
      const { error: linkError } = await supabase.from("doctor_facility_links").insert({
        doctor_id: doctor.id,
        facility_id: values.facility_id,
        role_title: values.role_title || null,
        department: values.department || null,
        status: "provisorio",
        layer: "candidato",
        confidence_score: 20,
      });
      if (linkError) throw linkError;
    }

    await supabase.from("review_queue").insert({
      doctor_id: doctor.id,
      status: "pendente",
      priority: 50,
      review_type: "candidato",
      origin: "manual",
      reason: "Cadastro manual de candidato",
      notes: "Aguardando validação humana",
    });

    await writeAuditLog(supabase, {
      action: "doctor.create",
      entityType: "doctor",
      entityId: doctor.id,
      after: { full_name: values.full_name, layer: "candidato" },
    });
  } catch (err) {
    await supabase
      .from("doctors")
      .update({ is_deleted: true, archive_reason: "rollback" })
      .eq("id", doctor.id);
    return mapSupabaseError(
      err as { code?: string; message?: string },
      "Falha ao criar dados relacionados. O cadastro foi revertido logicamente.",
    );
  }

  revalidatePath("/medicos");
  revalidatePath("/validacao");
  revalidatePath("/dashboard");
  return ok({ id: doctor.id });
}

export async function updateDoctorAction(
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const parsed = doctorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const { data: before } = await supabase.from("doctors").select("*").eq("id", id).maybeSingle();
  if (!before) return fail("Médico não encontrado.", "NOT_FOUND");

  const values = parsed.data;
  const { birth_date: birthDate, ...rest } = values;
  const patch: Record<string, unknown> = { ...rest };

  if (typeof patch.full_name === "string") {
    patch.normalized_name = buildDoctorNormalizedName(patch.full_name);
  }
  if (typeof patch.state_uf === "string") {
    patch.state_uf = normalizeUf(patch.state_uf);
  }

  const { error } = await supabase.from("doctors").update(patch).eq("id", id);
  if (error) return mapSupabaseError(error, "Não foi possível atualizar o médico.");

  await upsertBirthDate(supabase, id, birthDate);

  await writeAuditLog(supabase, {
    action: "doctor.update",
    entityType: "doctor",
    entityId: id,
    before: before as Record<string, unknown>,
    after: { ...patch, birth_date: birthDate },
  });

  revalidatePath(`/medicos/${id}`);
  revalidatePath("/medicos");
  return ok({ id });
}

export async function archiveDoctorAction(
  id: string,
  reason?: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { error } = await supabase
    .from("doctors")
    .update({
      is_deleted: true,
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      archive_reason: reason || "Arquivado pela equipe",
    })
    .eq("id", id);

  if (error) return mapSupabaseError(error, "Não foi possível arquivar o médico.");

  await writeAuditLog(supabase, {
    action: "doctor.archive",
    entityType: "doctor",
    entityId: id,
    metadata: { reason },
  });

  revalidatePath("/medicos");
  revalidatePath(`/medicos/${id}`);
  return ok({ id });
}

export async function restoreDoctorAction(
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { error } = await supabase
    .from("doctors")
    .update({
      is_deleted: false,
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq("id", id);

  if (error) return mapSupabaseError(error, "Não foi possível restaurar o médico.");

  await writeAuditLog(supabase, {
    action: "doctor.restore",
    entityType: "doctor",
    entityId: id,
  });

  revalidatePath("/medicos");
  revalidatePath(`/medicos/${id}`);
  return ok({ id });
}

export async function upsertRegistrationAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;

  if (values.is_primary && values.registration_type === "CRM") {
    await supabase
      .from("medical_registrations")
      .update({ is_primary: false })
      .eq("doctor_id", values.doctor_id)
      .eq("registration_type", "CRM");
  }
  if (values.is_primary && values.registration_type === "RQE") {
    await supabase
      .from("medical_registrations")
      .update({ is_primary: false })
      .eq("doctor_id", values.doctor_id)
      .eq("registration_type", "RQE");
  }

  const { data, error } = await supabase
    .from("medical_registrations")
    .insert({
      doctor_id: values.doctor_id,
      registration_type: values.registration_type,
      number: normalizeCrmNumber(values.number),
      state_uf: normalizeUf(values.state_uf),
      status: values.status,
      specialty_id: values.specialty_id || null,
      source_id: values.source_id || null,
      is_primary: values.is_primary,
      confidence_score: values.confidence_score,
      notes: values.notes ?? null,
      inscription_type: values.inscription_type ?? null,
      consulted_at: values.consulted_at ?? null,
      verified_at: values.verified_at ?? null,
      verification_status: values.verification_status,
      registration_details: values.registration_details ?? null,
      rqe_area: values.rqe_area ?? null,
      rqe_status: values.rqe_status ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(
      error,
      values.registration_type === "CRM"
        ? "Este CRM + UF já está cadastrado (duplicidade)."
        : "Este RQE + UF já está cadastrado ou é inválido.",
    );
  }

  await writeAuditLog(supabase, {
    action:
      values.registration_type === "CRM"
        ? "registration.create_crm"
        : "registration.create_rqe",
    entityType: "registration",
    entityId: data.id,
    after: values as unknown as Record<string, unknown>,
  });

  revalidatePath(`/medicos/${values.doctor_id}`);
  return ok({ id: data.id });
}

export async function updateRegistrationAction(
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const parsed = registrationUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const { data: before } = await supabase
    .from("medical_registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("Registro profissional não encontrado.", "NOT_FOUND");

  const values = parsed.data;
  const patch: Record<string, unknown> = { ...values };
  if (values.number) patch.number = normalizeCrmNumber(values.number);
  if (values.state_uf) patch.state_uf = normalizeUf(values.state_uf);

  if (values.is_primary === true) {
    await supabase
      .from("medical_registrations")
      .update({ is_primary: false })
      .eq("doctor_id", before.doctor_id)
      .eq("registration_type", before.registration_type)
      .neq("id", id);
  }

  const { error } = await supabase
    .from("medical_registrations")
    .update(patch)
    .eq("id", id);

  if (error) {
    return mapSupabaseError(
      error,
      "Não foi possível atualizar o registro. Verifique duplicidade de tipo + número + UF.",
    );
  }

  await writeAuditLog(supabase, {
    action: "registration.update",
    entityType: "registration",
    entityId: id,
    before: before as Record<string, unknown>,
    after: patch,
  });

  revalidatePath(`/medicos/${before.doctor_id}`);
  return ok({ id });
}

export async function addDoctorSpecialtyAction(
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const parsed = doctorSpecialtySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const values = parsed.data;

  if (values.is_primary) {
    await supabase
      .from("doctor_specialties")
      .update({ is_primary: false })
      .eq("doctor_id", values.doctor_id);
  }

  const { data, error } = await supabase
    .from("doctor_specialties")
    .insert({
      doctor_id: values.doctor_id,
      specialty_id: values.specialty_id,
      source_id: values.source_id || null,
      is_confirmed: values.is_confirmed,
      is_primary: values.is_primary,
      confidence_score: values.confidence_score,
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(error, "Não foi possível vincular a especialidade.");
  }

  await writeAuditLog(supabase, {
    action: "specialty.link",
    entityType: "specialty",
    entityId: data.id,
    after: values as unknown as Record<string, unknown>,
  });

  revalidatePath(`/medicos/${values.doctor_id}`);
  return ok({ id: data.id });
}

export async function removeDoctorSpecialtyAction(
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { data: before } = await supabase
    .from("doctor_specialties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("Vínculo de especialidade não encontrado.", "NOT_FOUND");

  const { error } = await supabase.from("doctor_specialties").delete().eq("id", id);
  if (error) {
    return mapSupabaseError(error, "Não foi possível remover a especialidade.");
  }

  await writeAuditLog(supabase, {
    action: "specialty.unlink",
    entityType: "specialty",
    entityId: id,
    before: before as Record<string, unknown>,
  });

  revalidatePath(`/medicos/${before.doctor_id}`);
  return ok({ id });
}

export async function sendDoctorToReviewAction(
  doctorId: string,
  reason?: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  await supabase
    .from("doctors")
    .update({ validation_status: "em_revisao" })
    .eq("id", doctorId);

  const { data, error } = await supabase
    .from("review_queue")
    .insert({
      doctor_id: doctorId,
      status: "pendente",
      priority: 60,
      review_type: "candidato",
      origin: "manual",
      reason: reason || "Enviado para revisão",
    })
    .select("id")
    .single();

  if (error || !data) {
    return mapSupabaseError(error, "Não foi possível enviar para revisão.");
  }

  await writeAuditLog(supabase, {
    action: "review.enqueue",
    entityType: "review_queue",
    entityId: data.id,
    metadata: { doctor_id: doctorId, reason },
  });

  revalidatePath("/validacao");
  revalidatePath(`/medicos/${doctorId}`);
  return ok({ id: data.id });
}
