import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import { parsePage, parsePageSize, toBoolParam } from "@/lib/format";
import type { HealthFacility } from "@/types/database";

export type FacilitySearchParams = {
  q?: string;
  cnes?: string;
  cnpj?: string;
  city?: string;
  uf?: string;
  type?: string;
  hemo?: string;
  sus?: string;
  withoutDoctors?: string;
  page?: string;
  pageSize?: string;
};

const UNCONFIGURED =
  "Supabase não configurado. Preencha web/.env.local antes de consultar o banco.";

export async function searchFacilities(
  params: FacilitySearchParams,
): Promise<
  ServiceResult<{
    rows: HealthFacility[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  if (!hasSupabaseEnv()) {
    return fail(UNCONFIGURED, "UNCONFIGURED");
  }

  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const supabase = await createClient();

  let query = supabase
    .from("health_facilities")
    .select("*", { count: "exact" })
    .eq("is_deleted", false)
    .order("name")
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.cnes) query = query.eq("cnes", params.cnes);
  if (params.cnpj) query = query.eq("cnpj", params.cnpj.replace(/\D/g, ""));
  if (params.city) query = query.ilike("city", `%${params.city}%`);
  if (params.uf) query = query.eq("state_uf", params.uf.toUpperCase());
  if (params.type) query = query.ilike("facility_type", `%${params.type}%`);
  if (params.hemo === "1") query = query.eq("has_hemodynamics", true);
  if (params.sus === "1") query = query.eq("attends_sus", true);
  if (params.sus === "0") query = query.eq("attends_sus", false);

  const { data, error, count } = await query;
  if (error) {
    return mapSupabaseError(error, "Não foi possível carregar os estabelecimentos.");
  }

  let rows = (data ?? []) as HealthFacility[];

  if (toBoolParam(params.withoutDoctors) === true && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: links, error: linkError } = await supabase
      .from("doctor_facility_links")
      .select("facility_id")
      .in("facility_id", ids)
      .eq("is_deleted", false);
    if (linkError) {
      return mapSupabaseError(
        linkError,
        "Não foi possível aplicar o filtro de estabelecimentos sem médicos.",
      );
    }
    const withDoctors = new Set((links ?? []).map((l) => l.facility_id));
    rows = rows.filter((r) => !withDoctors.has(r.id));
  }

  return ok({
    rows,
    total: count ?? rows.length,
    page,
    pageSize,
  });
}

export async function getFacilityById(
  id: string,
): Promise<ServiceResult<HealthFacility>> {
  if (!hasSupabaseEnv()) return fail(UNCONFIGURED, "UNCONFIGURED");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_facilities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return mapSupabaseError(error, "Não foi possível carregar o estabelecimento.");
  }
  if (!data) return fail("Estabelecimento não encontrado.", "NOT_FOUND");
  return ok(data as HealthFacility);
}

export async function listFacilitiesForSelect(): Promise<
  ServiceResult<{ id: string; name: string; city: string; state_uf: string }[]>
> {
  if (!hasSupabaseEnv()) return fail(UNCONFIGURED, "UNCONFIGURED");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_facilities")
    .select("id, name, city, state_uf")
    .eq("is_deleted", false)
    .order("name")
    .limit(500);
  if (error) return mapSupabaseError(error, "Não foi possível carregar estabelecimentos.");
  return ok(data ?? []);
}
