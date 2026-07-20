"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { buildDoctorNormalizedName, normalizeCrmNumber, normalizeUf } from "@/lib/format";
import { normalizePersonName } from "@/lib/utils";
import { requireWriter } from "@/lib/require-writer";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import {
  IMPORT_ENTITY_TYPES,
  type ImportEntityType,
  autoMapColumns,
} from "@/services/imports/templates";
import { applyColumnMapping } from "@/services/imports/parse";
import {
  markFacilityDuplicates,
  markRegistrationDuplicates,
  validateImportRow,
} from "@/services/imports/validate";

export type ImportPreviewPayload = {
  file_name: string;
  file_type: string;
  file_hash: string;
  entity_type: ImportEntityType;
  source_id?: string | null;
  competencia?: string | null;
  state_uf?: string | null;
  encoding?: string | null;
  delimiter?: string | null;
  storage_path?: string | null;
  column_mapping?: Record<string, string>;
  headers: string[];
  rows: Record<string, string>[];
};

async function resolveSourceId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  code: string | null | undefined,
): Promise<string | null> {
  if (!code) return null;
  const { data } = await supabase
    .from("data_sources")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createImportPreviewAction(
  input: ImportPreviewPayload,
): Promise<ServiceResult<{ id: string; valid: number; invalid: number; duplicates: number }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  if (!IMPORT_ENTITY_TYPES.includes(input.entity_type)) {
    return fail("Tipo de entidade de importação inválido.");
  }
  if (!input.file_hash || input.file_hash.length < 16) {
    return fail("Hash do arquivo inválido.");
  }
  if (!input.rows?.length) {
    return fail("Arquivo sem linhas de dados.");
  }

  const { data: existingList } = await supabase
    .from("import_batches")
    .select("id, file_name, status")
    .eq("file_hash", input.file_hash);

  const existing = (existingList ?? []).find(
    (b: { status: string }) => b.status !== "cancelado" && b.status !== "erro",
  );

  if (existing) {
    return fail(
      `Arquivo duplicado: já existe o lote "${existing.file_name}" (${existing.status}).`,
      "DUPLICATE_FILE",
    );
  }

  const mapping =
    input.column_mapping && Object.keys(input.column_mapping).length > 0
      ? input.column_mapping
      : autoMapColumns(input.headers, input.entity_type);

  const validated = input.rows.map((row, index) => {
    const mapped = applyColumnMapping(row, mapping);
    const result = validateImportRow(input.entity_type, mapped);
    return {
      row_number: index + 2,
      payload: { raw: row, mapped },
      normalized_payload: result.normalized,
      validation_errors: result.errors,
      is_valid: result.ok,
      is_duplicate: false,
      match_status: result.ok ? "valido" : "invalido",
      error_message: result.errors.join("; ") || null,
    };
  });

  let duplicates = 0;
  if (input.entity_type === "registrations") {
    duplicates = markRegistrationDuplicates(
      validated.map((v) => ({
        normalized: v.normalized_payload as Record<string, string | null | boolean | number>,
        errors: v.validation_errors,
      })),
    );
  }
  if (input.entity_type === "facilities") {
    duplicates = markFacilityDuplicates(
      validated.map((v) => ({
        normalized: v.normalized_payload as Record<string, string | null | boolean | number>,
        errors: v.validation_errors,
      })),
    );
  }
  for (const row of validated) {
    if (row.validation_errors.some((e) => e.includes("duplicado"))) {
      row.is_duplicate = true;
      row.is_valid = false;
      row.match_status = "duplicado";
      row.error_message = row.validation_errors.join("; ");
    }
  }

  const valid = validated.filter((r) => r.is_valid).length;
  const invalid = validated.length - valid;

  const { data: batch, error } = await supabase
    .from("import_batches")
    .insert({
      file_name: input.file_name,
      file_type: input.file_type,
      file_hash: input.file_hash,
      storage_path: input.storage_path || null,
      status: "preview",
      entity_type: input.entity_type,
      source_id: input.source_id || null,
      competencia: input.competencia || null,
      state_uf: input.state_uf ? normalizeUf(input.state_uf) : null,
      encoding: input.encoding || null,
      delimiter: input.delimiter || null,
      column_mapping: mapping,
      row_count: validated.length,
      valid_count: valid,
      invalid_count: invalid,
      duplicate_count: duplicates,
      preview_summary: {
        headers: input.headers,
        sample_rows: validated.slice(0, 20).map((r) => ({
          row_number: r.row_number,
          mapped: r.payload.mapped,
          is_valid: r.is_valid,
          errors: r.validation_errors,
        })),
        note: "Prévia — confirmação humana obrigatória. Nada vai para a base oficial.",
      },
      uploaded_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !batch) {
    return mapSupabaseError(error, "Não foi possível criar o lote de importação.");
  }

  const rawInserts = validated.map((r) => ({
    batch_id: batch.id,
    row_number: r.row_number,
    payload: r.payload,
    normalized_payload: r.normalized_payload,
    validation_errors: r.validation_errors,
    is_valid: r.is_valid,
    is_duplicate: r.is_duplicate,
    match_status: r.match_status,
    error_message: r.error_message,
  }));

  // Inserir em chunks
  const chunkSize = 200;
  for (let i = 0; i < rawInserts.length; i += chunkSize) {
    const chunk = rawInserts.slice(i, i + chunkSize);
    const { error: rawError } = await supabase.from("raw_records").insert(chunk);
    if (rawError) {
      await supabase
        .from("import_batches")
        .update({ status: "erro", error_message: rawError.message })
        .eq("id", batch.id);
      return mapSupabaseError(rawError, "Falha ao gravar registros brutos.");
    }
  }

  await writeAuditLog(supabase, {
    action: "import.preview",
    entityType: "import_batch",
    entityId: batch.id,
    after: {
      file_name: input.file_name,
      file_hash: input.file_hash,
      entity_type: input.entity_type,
      row_count: validated.length,
      valid,
      invalid,
      duplicates,
    },
  });

  revalidatePath("/importacoes");
  return ok({ id: batch.id, valid, invalid, duplicates });
}

export async function cancelImportAction(
  batchId: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { error } = await supabase
    .from("import_batches")
    .update({
      status: "cancelado",
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
    })
    .eq("id", batchId);

  if (error) return mapSupabaseError(error, "Não foi possível cancelar o lote.");

  await writeAuditLog(supabase, {
    action: "import.cancel",
    entityType: "import_batch",
    entityId: batchId,
  });

  revalidatePath("/importacoes");
  revalidatePath(`/importacoes/${batchId}`);
  return ok({ id: batchId });
}

export async function confirmImportAction(
  batchId: string,
): Promise<
  ServiceResult<{
    id: string;
    candidates: number;
    doctors: number;
    facilities: number;
    links: number;
    contacts: number;
    evidences: number;
  }>
> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { profile, supabase } = gate;

  const { data: batch } = await supabase
    .from("import_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return fail("Lote não encontrado.", "NOT_FOUND");
  if (batch.status === "cancelado") return fail("Lote cancelado.");
  if (batch.status === "confirmado") return fail("Lote já confirmado.");

  await supabase
    .from("import_batches")
    .update({
      status: "processando",
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  const { data: rawRows, error: rawError } = await supabase
    .from("raw_records")
    .select("*")
    .eq("batch_id", batchId)
    .eq("is_valid", true)
    .order("row_number");

  if (rawError) {
    return mapSupabaseError(rawError, "Não foi possível ler registros brutos.");
  }

  const entity = batch.entity_type as ImportEntityType;
  let doctors = 0;
  let facilities = 0;
  let links = 0;
  let contacts = 0;
  let evidences = 0;
  let candidates = 0;

  try {
    for (const row of rawRows ?? []) {
      // Reprocessamento idempotente: não recria o que já foi vinculado
      if (row.linked_doctor_id || row.linked_facility_id) {
        continue;
      }

      const n = (row.normalized_payload ?? {}) as Record<string, string>;

      if (entity === "doctors") {
        const sourceId =
          (await resolveSourceId(supabase, n.source_code)) || batch.source_id;
        const { data: doctor, error } = await supabase
          .from("doctors")
          .insert({
            full_name: n.full_name,
            normalized_name: buildDoctorNormalizedName(String(n.full_name)),
            social_name: n.social_name || null,
            classification: n.classification || "possivel_candidato",
            confidence_score: Number(n.confidence_score ?? 20) || 20,
            city: n.city || null,
            state_uf: n.state_uf || batch.state_uf || "MG",
            biography: n.biography || null,
            declared_practice_area: n.declared_practice_area || null,
            confirmed_practice_area: n.confirmed_practice_area || null,
            practice_keywords: n.practice_keywords
              ? String(n.practice_keywords).split(/[;,]/).map((s) => s.trim()).filter(Boolean)
              : [],
            graduation_institution: n.graduation_institution || null,
            graduation_year: n.graduation_year ? Number(n.graduation_year) : null,
            residency: n.residency || null,
            specialization: n.specialization || null,
            notes: n.notes || `Importação lote ${batchId}`,
            layer: "candidato",
            validation_status: "nao_iniciada",
            created_by: profile.id,
            is_demo: false,
          })
          .select("id")
          .single();
        if (error || !doctor) throw error;
        if (sourceId || n.source_url) {
          await supabase.from("evidences").insert({
            entity_type: "doctor",
            entity_id: doctor.id,
            title: `Fonte da importação — ${batch.file_name}`,
            description: n.notes || null,
            url: n.source_url || null,
            source_id: sourceId,
            created_by: profile.id,
            status: "pendente",
            collected_at: n.captured_at || null,
          });
        }
        await supabase.from("review_queue").insert({
          doctor_id: doctor.id,
          status: "pendente",
          priority: 55,
          review_type: "candidato",
          origin: "import",
          reason: `Importação ${batch.file_name}`,
          notes: `batch:${batchId}`,
        });
        await supabase
          .from("raw_records")
          .update({ linked_doctor_id: doctor.id, match_status: "candidato" })
          .eq("id", row.id);
        doctors += 1;
        candidates += 1;
      }

      if (entity === "facilities") {
        const { data: facility, error } = await supabase
          .from("health_facilities")
          .insert({
            name: n.legal_name,
            trade_name: n.trade_name || null,
            normalized_name: normalizePersonName(String(n.legal_name)),
            cnes: n.cnes_code || null,
            cnpj: n.cnpj || null,
            facility_type: n.facility_type || null,
            legal_nature: n.legal_nature || null,
            ownership_type: n.ownership_type || null,
            branch_type: n.branch_type || null,
            is_active: n.is_active !== "false",
            city: n.city,
            state_uf: n.state_uf || "MG",
            address_zip: n.address_zip || null,
            address_street: n.address_street || null,
            address_number: n.address_number || null,
            address_complement: n.address_complement || null,
            address_district: n.address_district || null,
            ibge_city_code: n.ibge_city_code || null,
            region: n.region || null,
            latitude: n.latitude ? Number(n.latitude) : null,
            longitude: n.longitude ? Number(n.longitude) : null,
            phone: n.phone || null,
            email: n.email || null,
            website: n.website || null,
            hemodynamics_phone: n.hemodynamics_phone || null,
            institutional_whatsapp: n.institutional_whatsapp || null,
            hemodynamics_email: n.hemodynamics_email || null,
            has_hemodynamics: n.has_hemodynamics === "true" || n.has_hemodynamics === "1",
            has_catheterization_lab: n.has_catheterization_lab === "true",
            has_interventional_cardiology: n.has_interventional_cardiology === "true",
            attends_sus: n.attends_sus === "true" ? true : n.attends_sus === "false" ? false : null,
            notes: n.service_notes || n.notes || `Importação lote ${batchId}`,
            layer: "candidato",
            confidence_score: 30,
            created_by: profile.id,
            is_demo: false,
            source_id: batch.source_id,
          })
          .select("id")
          .single();
        if (error || !facility) throw error;
        await supabase.from("review_queue").insert({
          facility_id: facility.id,
          status: "pendente",
          priority: 50,
          review_type: "candidato",
          origin: "import",
          reason: `Importação ${batch.file_name}`,
        });
        await supabase
          .from("raw_records")
          .update({ linked_facility_id: facility.id, match_status: "candidato" })
          .eq("id", row.id);
        facilities += 1;
        candidates += 1;
      }

      if (entity === "registrations") {
        const number = normalizeCrmNumber(String(n.number));
        const uf = normalizeUf(String(n.state_uf));
        // Localiza médico por CRM existente ou por nome normalizado (sem merge automático)
        let doctorId: string | null = null;
        const { data: byCrm } = await supabase
          .from("medical_registrations")
          .select("doctor_id")
          .eq("registration_type", "CRM")
          .eq("number", number)
          .eq("state_uf", uf)
          .maybeSingle();
        if (n.registration_type === "RQE") {
          // RQE: precisa médico já existente — tenta por nome
          const { data: docs } = await supabase
            .from("doctors")
            .select("id")
            .eq("normalized_name", buildDoctorNormalizedName(String(n.doctor_name)))
            .eq("is_deleted", false)
            .limit(2);
          if (!docs?.length) {
            await supabase
              .from("raw_records")
              .update({
                match_status: "erro",
                error_message: "RQE sem médico correspondente",
                is_valid: false,
              })
              .eq("id", row.id);
            continue;
          }
          if (docs.length > 1) {
            await supabase
              .from("raw_records")
              .update({
                match_status: "pendente",
                error_message: "Múltiplos médicos com o mesmo nome — revisão manual",
                validation_errors: ["Ambíguo por nome — sem merge automático"],
              })
              .eq("id", row.id);
            await supabase.from("review_queue").insert({
              doctor_id: docs[0]!.id,
              status: "pendente",
              priority: 70,
              review_type: "duplicidade",
              origin: "import",
              reason: "RQE com nome ambíguo na importação",
            });
            continue;
          }
          doctorId = docs[0]!.id;
        } else if (byCrm?.doctor_id) {
          // CRM duplicado no banco → pendência
          await supabase
            .from("raw_records")
            .update({
              match_status: "duplicado",
              is_duplicate: true,
              linked_doctor_id: byCrm.doctor_id,
              error_message: "CRM+UF já existente — pendência de revisão",
            })
            .eq("id", row.id);
          await supabase.from("review_queue").insert({
            doctor_id: byCrm.doctor_id,
            status: "pendente",
            priority: 80,
            review_type: "duplicidade",
            origin: "import",
            reason: `CRM duplicado na importação (${number}/${uf})`,
          });
          continue;
        } else {
          const { data: docs } = await supabase
            .from("doctors")
            .select("id")
            .eq("normalized_name", buildDoctorNormalizedName(String(n.doctor_name)))
            .eq("is_deleted", false)
            .limit(1);
          doctorId = docs?.[0]?.id ?? null;
          if (!doctorId) {
            const { data: created } = await supabase
              .from("doctors")
              .insert({
                full_name: n.doctor_name,
                normalized_name: buildDoctorNormalizedName(String(n.doctor_name)),
                layer: "candidato",
                classification: "possivel_candidato",
                validation_status: "nao_iniciada",
                confidence_score: 15,
                state_uf: uf,
                notes: `Candidato gerado por importação de CRM — lote ${batchId}`,
                created_by: profile.id,
              })
              .select("id")
              .single();
            doctorId = created?.id ?? null;
            if (doctorId) {
              await supabase.from("review_queue").insert({
                doctor_id: doctorId,
                status: "pendente",
                origin: "import",
                reason: "Candidato criado via importação de CRM",
              });
              candidates += 1;
            }
          }
        }

        if (!doctorId) continue;

        const { error: regError } = await supabase.from("medical_registrations").insert({
          doctor_id: doctorId,
          registration_type: n.registration_type,
          number,
          state_uf: uf,
          status: n.status || "desconhecido",
          inscription_type: n.inscription_type || null,
          is_primary: n.is_primary === "true",
          rqe_area: n.rqe_area || null,
          rqe_status: n.rqe_status || null,
          consulted_at: n.consulted_at || null,
          verification_status: n.verification_status || "nao_verificado",
          notes: n.notes || "Importação — CRM FICTÍCIO ou real conforme arquivo",
          confidence_score: 25,
          source_id: batch.source_id,
        });
        if (regError) {
          await supabase
            .from("raw_records")
            .update({
              match_status: "erro",
              error_message: regError.message,
            })
            .eq("id", row.id);
          continue;
        }
        await supabase
          .from("raw_records")
          .update({ linked_doctor_id: doctorId, match_status: "candidato" })
          .eq("id", row.id);
        doctors += 1;
      }

      if (entity === "links") {
        const crm = normalizeCrmNumber(String(n.doctor_crm));
        const uf = normalizeUf(String(n.doctor_crm_uf));
        const { data: reg } = await supabase
          .from("medical_registrations")
          .select("doctor_id")
          .eq("registration_type", "CRM")
          .eq("number", crm)
          .eq("state_uf", uf)
          .maybeSingle();
        if (!reg?.doctor_id) {
          await supabase
            .from("raw_records")
            .update({
              match_status: "erro",
              error_message: "Vínculo sem médico (CRM+UF não encontrado)",
            })
            .eq("id", row.id);
          continue;
        }
        let facilityId: string | null = null;
        if (n.facility_cnes) {
          const { data: fac } = await supabase
            .from("health_facilities")
            .select("id")
            .eq("cnes", n.facility_cnes)
            .eq("is_deleted", false)
            .maybeSingle();
          facilityId = fac?.id ?? null;
        }
        if (!facilityId && n.facility_name) {
          const { data: fac } = await supabase
            .from("health_facilities")
            .select("id")
            .ilike("name", n.facility_name)
            .eq("is_deleted", false)
            .limit(1)
            .maybeSingle();
          facilityId = fac?.id ?? null;
        }
        if (!facilityId) {
          await supabase
            .from("raw_records")
            .update({
              match_status: "erro",
              error_message: "Vínculo sem estabelecimento (CNES/nome)",
            })
            .eq("id", row.id);
          continue;
        }
        const { error: linkError } = await supabase.from("doctor_facility_links").insert({
          doctor_id: reg.doctor_id,
          facility_id: facilityId,
          role_title: n.position || null,
          function_title: n.function_title || null,
          department: n.department || null,
          practiced_specialty: n.practiced_specialty || null,
          is_coordinator: n.is_coordinator === "true",
          is_team_leader: n.is_team_leader === "true",
          is_technical_responsible: n.is_technical_responsible === "true",
          is_clinical_staff: n.is_clinical_staff !== "false",
          weekly_hours: n.weekly_hours ? Number(n.weekly_hours) : null,
          is_sus_link: n.is_sus_link === "true" ? true : n.is_sus_link === "false" ? false : null,
          status: n.link_status || "provisorio",
          started_on: n.start_date || null,
          ended_on: n.end_date || null,
          confidence_score: Number(n.confidence_score ?? 30) || 30,
          notes: n.notes || null,
          layer: "candidato",
          source_id: batch.source_id,
        });
        if (linkError) {
          await supabase
            .from("raw_records")
            .update({ match_status: "erro", error_message: linkError.message })
            .eq("id", row.id);
          continue;
        }
        await supabase
          .from("raw_records")
          .update({
            linked_doctor_id: reg.doctor_id,
            linked_facility_id: facilityId,
            match_status: "candidato",
          })
          .eq("id", row.id);
        links += 1;
        candidates += 1;
      }

      if (entity === "contacts") {
        let doctorId: string | null = null;
        let facilityId: string | null = null;
        if (n.doctor_crm && n.doctor_crm_uf) {
          const { data: reg } = await supabase
            .from("medical_registrations")
            .select("doctor_id")
            .eq("registration_type", "CRM")
            .eq("number", normalizeCrmNumber(String(n.doctor_crm)))
            .eq("state_uf", normalizeUf(String(n.doctor_crm_uf)))
            .maybeSingle();
          doctorId = reg?.doctor_id ?? null;
        }
        if (n.facility_cnes) {
          const { data: fac } = await supabase
            .from("health_facilities")
            .select("id")
            .eq("cnes", n.facility_cnes)
            .maybeSingle();
          facilityId = fac?.id ?? null;
        }
        if (!doctorId && !facilityId) {
          await supabase
            .from("raw_records")
            .update({
              match_status: "erro",
              error_message: "Contato sem médico/estabelecimento correspondente",
            })
            .eq("id", row.id);
          continue;
        }
        const { error: contactError } = await supabase.from("professional_contacts").insert({
          doctor_id: doctorId,
          facility_id: facilityId,
          channel: n.contact_type,
          value: n.contact_value,
          label: n.label || null,
          is_institutional: n.is_institutional !== "false",
          is_publicly_available: n.is_public !== "false",
          is_primary: n.is_primary === "true",
          accepts_contact: n.accepts_contact === "true" ? true : n.accepts_contact === "false" ? false : null,
          do_not_contact: n.do_not_contact === "true",
          contact_status: n.contact_status || "nao_validado",
          source_origin: n.source_origin || n.source_code || null,
          collected_at: n.collected_at || null,
          source_id: batch.source_id,
          confidence_score: 30,
        });
        if (contactError) {
          await supabase
            .from("raw_records")
            .update({ match_status: "erro", error_message: contactError.message })
            .eq("id", row.id);
          continue;
        }
        await supabase
          .from("raw_records")
          .update({
            linked_doctor_id: doctorId,
            linked_facility_id: facilityId,
            match_status: "candidato",
          })
          .eq("id", row.id);
        contacts += 1;
        candidates += 1;
      }

      if (entity === "evidences") {
        let entityId: string | null = null;
        let entityType = n.entity_type || "doctor";
        if (n.doctor_crm && n.doctor_crm_uf) {
          const { data: reg } = await supabase
            .from("medical_registrations")
            .select("doctor_id")
            .eq("registration_type", "CRM")
            .eq("number", normalizeCrmNumber(String(n.doctor_crm)))
            .eq("state_uf", normalizeUf(String(n.doctor_crm_uf)))
            .maybeSingle();
          entityId = reg?.doctor_id ?? null;
          entityType = "doctor";
        } else if (n.facility_cnes) {
          const { data: fac } = await supabase
            .from("health_facilities")
            .select("id")
            .eq("cnes", n.facility_cnes)
            .maybeSingle();
          entityId = fac?.id ?? null;
          entityType = "facility";
        }
        if (!entityId) {
          await supabase
            .from("raw_records")
            .update({
              match_status: "erro",
              error_message: "Evidência sem entidade correspondente",
            })
            .eq("id", row.id);
          continue;
        }
        const { error: evError } = await supabase.from("evidences").insert({
          entity_type: entityType,
          entity_id: entityId,
          title: n.title,
          description: n.description || n.notes || null,
          url: n.url || n.source_url || null,
          confirmed_field: n.confirmed_field || null,
          captured_value: n.captured_value || null,
          collected_at: n.collected_at || null,
          source_id: batch.source_id,
          created_by: profile.id,
          status: "pendente",
        });
        if (evError) {
          await supabase
            .from("raw_records")
            .update({ match_status: "erro", error_message: evError.message })
            .eq("id", row.id);
          continue;
        }
        await supabase
          .from("raw_records")
          .update({
            linked_doctor_id: entityType === "doctor" ? entityId : null,
            linked_facility_id: entityType === "facility" ? entityId : null,
            match_status: "candidato",
          })
          .eq("id", row.id);
        evidences += 1;
        candidates += 1;
      }
    }

    await supabase
      .from("import_batches")
      .update({
        status: "confirmado",
        confirmed_by: profile.id,
        confirmed_at: new Date().toISOString(),
        processing_finished_at: new Date().toISOString(),
        doctors_found: doctors,
        facilities_found: facilities,
        links_found: links,
        contacts_found: contacts,
        evidences_found: evidences,
      })
      .eq("id", batchId);

    await writeAuditLog(supabase, {
      action: "import.confirm",
      entityType: "import_batch",
      entityId: batchId,
      after: {
        candidates,
        doctors,
        facilities,
        links,
        contacts,
        evidences,
        file_hash: batch.file_hash,
        file_name: batch.file_name,
      },
      metadata: {
        actor_id: profile.id,
        entity_type: batch.entity_type,
      },
    });

    revalidatePath("/importacoes");
    revalidatePath(`/importacoes/${batchId}`);
    revalidatePath("/validacao");
    revalidatePath("/medicos");
    revalidatePath("/estabelecimentos");
    revalidatePath("/dashboard");

    return ok({
      id: batchId,
      candidates,
      doctors,
      facilities,
      links,
      contacts,
      evidences,
    });
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Erro ao processar importação";
    await supabase
      .from("import_batches")
      .update({
        status: "erro",
        error_message: message,
        processing_finished_at: new Date().toISOString(),
      })
      .eq("id", batchId);
    return fail(message);
  }
}

export async function reprocessImportAction(
  batchId: string,
): Promise<ServiceResult<{ id: string }>> {
  const gate = await requireWriter();
  if (!gate.ok) return gate.error;
  const { supabase } = gate;

  const { data: batch } = await supabase
    .from("import_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return fail("Lote não encontrado.", "NOT_FOUND");

  // Reprocessamento idempotente: apenas linhas válidas ainda não vinculadas
  await supabase
    .from("raw_records")
    .update({ match_status: "pendente", error_message: null })
    .eq("batch_id", batchId)
    .eq("is_valid", true)
    .is("linked_doctor_id", null)
    .is("linked_facility_id", null);

  await supabase
    .from("import_batches")
    .update({
      status: "preview",
      error_message: null,
      reprocessed_from: batch.reprocessed_from || batchId,
    })
    .eq("id", batchId);

  await writeAuditLog(supabase, {
    action: "import.reprocess",
    entityType: "import_batch",
    entityId: batchId,
  });

  return confirmImportAction(batchId);
}
