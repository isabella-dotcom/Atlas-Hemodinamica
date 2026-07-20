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
  Specialty,
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

const UNCONFIGURED =
  "Supabase não configurado. Preencha web/.env.local antes de consultar o banco.";

export async function searchDoctors(
  params: DoctorSearchParams,
): Promise<
  ServiceResult<{ rows: DoctorSearchRow[]; total: number; page: number; pageSize: number }>
> {
  if (!hasSupabaseEnv()) {
    return fail(UNCONFIGURED, "UNCONFIGURED");
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
    return mapSupabaseError(
      error,
      "Não foi possível carregar os médicos. Verifique se a migration 004 foi aplicada.",
    );
  }

  const rows = (data ?? []) as DoctorSearchRow[];
  const total = rows[0]?.total_count ?? 0;
  return ok({ rows, total: Number(total), page, pageSize });
}

export async function getDoctorById(
  id: string,
): Promise<ServiceResult<Doctor>> {
  if (!hasSupabaseEnv()) return fail(UNCONFIGURED, "UNCONFIGURED");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return mapSupabaseError(error, "Não foi possível carregar o médico.");
  if (!data) return fail("Médico não encontrado.", "NOT_FOUND");

  const doctor = data as Doctor;
  doctor.birth_date = null;

  const { data: sensitive } = await supabase
    .from("doctor_sensitive_fields")
    .select("birth_date")
    .eq("doctor_id", id)
    .maybeSingle();

  // RLS bloqueia visualizador: sensitive será null/erro silencioso
  if (sensitive?.birth_date) {
    doctor.birth_date = sensitive.birth_date;
  }

  // Defaults seguros para colunas novas ainda não migradas no ambiente
  doctor.practice_keywords = doctor.practice_keywords ?? [];
  doctor.fellowships = doctor.fellowships ?? [];
  doctor.professional_titles = doctor.professional_titles ?? [];
  doctor.medical_societies = doctor.medical_societies ?? [];
  doctor.scientific_identifiers = doctor.scientific_identifiers ?? {};
  doctor.is_demo = doctor.is_demo ?? false;

  return ok(doctor);
}

export async function getDoctorRegistrations(
  doctorId: string,
): Promise<ServiceResult<MedicalRegistration[]>> {
  if (!hasSupabaseEnv()) return fail(UNCONFIGURED, "UNCONFIGURED");
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
  if (!hasSupabaseEnv()) return fail(UNCONFIGURED, "UNCONFIGURED");
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
): Promise<ServiceResult<ConfidenceExplanation>> {
  if (!hasSupabaseEnv()) return fail(UNCONFIGURED, "UNCONFIGURED");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("explain_doctor_confidence", {
    p_doctor_id: doctorId,
  });
  if (error) {
    return mapSupabaseError(
      error,
      "Não foi possível calcular a confiança. Verifique a migration 004.",
    );
  }
  return ok(data as ConfidenceExplanation);
}

export async function listSpecialties(): Promise<ServiceResult<Specialty[]>> {
  if (!hasSupabaseEnv()) return fail(UNCONFIGURED, "UNCONFIGURED");
  const supabase = await createClient();
  const { data, error } = await supabase.from("specialties").select("*").order("name");
  if (error) return mapSupabaseError(error, "Não foi possível carregar especialidades.");
  return ok((data ?? []) as Specialty[]);
}
