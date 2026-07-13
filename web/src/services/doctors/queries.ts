import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import { parsePage, parsePageSize, toBoolParam } from "@/lib/format";
import type {
  ConfidenceExplanation,
  Doctor,
  DoctorSearchRow,
  DoctorSpecialty,
  MedicalRegistration,
  ValidationStatus,
  DoctorClassification,
} from "@/types/database";

export type DoctorSearchParams = {
  search?: string;
  state?: string;
  city?: string;
  facility?: string;
  specialty?: string;
  status?: string;
  validationStatus?: string;
  hasRqe?: string;
  hasContact?: string;
  confidenceMin?: string;
  confidenceMax?: string;
  coordinator?: string;
  updatedRecent?: string;
  archived?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  sortDir?: string;
};

export async function searchDoctors(
  params: DoctorSearchParams,
): Promise<
  ServiceResult<{ rows: DoctorSearchRow[]; total: number; page: number; pageSize: number }>
> {
  if (!hasSupabaseEnv()) {
    return ok({ rows: [], total: 0, page: 1, pageSize: 20 });
  }

  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_doctors", {
    p_search: params.search || null,
    p_state_uf: params.state || null,
    p_city: params.city || null,
    p_facility_id: params.facility || null,
    p_specialty_id: params.specialty || null,
    p_classification: (params.status as DoctorClassification) || null,
    p_validation_status: (params.validationStatus as ValidationStatus) || null,
    p_has_rqe: toBoolParam(params.hasRqe),
    p_has_contact: toBoolParam(params.hasContact),
    p_confidence_min: params.confidenceMin ? Number(params.confidenceMin) : null,
    p_confidence_max: params.confidenceMax ? Number(params.confidenceMax) : null,
    p_is_coordinator: toBoolParam(params.coordinator),
    p_include_archived: params.archived === "1",
    p_updated_recent_days: params.updatedRecent === "1" ? 30 : null,
    p_sort: params.sort || "updated_at",
    p_sort_dir: params.sortDir || "desc",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error) {
    // Fallback sem RPC (migration 004 ainda não aplicada)
    const fallback = await supabase
      .from("doctors")
      .select("*", { count: "exact" })
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (fallback.error) {
      return mapSupabaseError(error, "Não foi possível carregar os médicos.");
    }

    const rows = ((fallback.data ?? []) as Doctor[]).map((d) => ({
      ...d,
      validation_status: (d as Doctor & { validation_status?: ValidationStatus })
        .validation_status ?? "nao_iniciada",
      primary_crm: null,
      primary_crm_uf: null,
      primary_rqe: null,
      primary_specialty: null,
      primary_facility: null,
      links_count: 0,
      has_contact: false,
      total_count: fallback.count ?? 0,
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })) as DoctorSearchRow[];

    return ok({
      rows,
      total: fallback.count ?? 0,
      page,
      pageSize,
    });
  }

  const rows = (data ?? []) as DoctorSearchRow[];
  const total = rows[0]?.total_count ?? 0;
  return ok({ rows, total: Number(total), page, pageSize });
}

export async function getDoctorById(
  id: string,
): Promise<ServiceResult<Doctor>> {
  if (!hasSupabaseEnv()) {
    return fail("Supabase não configurado.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return mapSupabaseError(error, "Não foi possível carregar o médico.");
  if (!data) return fail("Médico não encontrado.", "NOT_FOUND");
  return ok(data as Doctor);
}

export async function getDoctorRegistrations(
  doctorId: string,
): Promise<ServiceResult<MedicalRegistration[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medical_registrations")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("registration_type")
    .order("is_primary", { ascending: false });

  if (error) {
    return mapSupabaseError(error, "Não foi possível carregar os registros profissionais.");
  }
  return ok((data ?? []) as MedicalRegistration[]);
}

export async function getDoctorSpecialties(
  doctorId: string,
): Promise<
  ServiceResult<(DoctorSpecialty & { specialties: { name: string } | null })[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_specialties")
    .select("*, specialties(name)")
    .eq("doctor_id", doctorId);

  if (error) {
    return mapSupabaseError(error, "Não foi possível carregar especialidades.");
  }
  return ok(
    (data ?? []) as (DoctorSpecialty & { specialties: { name: string } | null })[],
  );
}

export async function explainConfidence(
  doctorId: string,
): Promise<ServiceResult<ConfidenceExplanation | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("explain_doctor_confidence", {
    p_doctor_id: doctorId,
  });
  if (error) return ok(null);
  return ok(data as ConfidenceExplanation);
}

export async function listSpecialties() {
  if (!hasSupabaseEnv()) return ok([]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("specialties").select("*").order("name");
  if (error) return mapSupabaseError(error, "Não foi possível carregar especialidades.");
  return ok(data ?? []);
}
