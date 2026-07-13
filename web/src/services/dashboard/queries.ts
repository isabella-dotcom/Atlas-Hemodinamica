import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { ok, mapSupabaseError, type ServiceResult } from "@/lib/service-result";
import type { AuditLog, DashboardStats, ReviewQueueItem, UsersProfile } from "@/types/database";

const emptyStats: DashboardStats = {
  totalMedicos: 0,
  candidatos: 0,
  emRevisao: 0,
  parcialmenteValidados: 0,
  validados: 0,
  especialistasConfirmados: 0,
  estabelecimentosAtivos: 0,
  estabelecimentosHemo: 0,
  vinculosAtivos: 0,
  contatosDisponiveis: 0,
  evidenciasPendentes: 0,
  pendenciasValidacao: 0,
  semCrm: 0,
  semVinculo: 0,
  semEvidencia: 0,
  baixaConfianca: 0,
  vinculosSemValidacaoRecente: 0,
  hemoSemMedicos: 0,
  porEstado: [],
};

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!hasSupabaseEnv()) return emptyStats;

  try {
    const supabase = await createClient();

    const [
      total,
      candidatos,
      emRevisao,
      parcial,
      validados,
      especialistas,
      facilities,
      hemo,
      links,
      contacts,
      evidences,
      pending,
      byState,
    ] = await Promise.all([
      supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_deleted", false),
      supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("layer", "candidato"),
      supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("validation_status", "em_revisao"),
      supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("validation_status", "parcialmente_validada"),
      supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("validation_status", "validada"),
      supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("classification", "especialista_confirmado"),
      supabase.from("health_facilities").select("id", { count: "exact", head: true }).eq("is_deleted", false),
      supabase.from("health_facilities").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("has_hemodynamics", true),
      supabase.from("doctor_facility_links").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("status", "ativo"),
      supabase.from("professional_contacts").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("do_not_contact", false),
      supabase.from("evidences").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("review_queue").select("id", { count: "exact", head: true }).in("status", ["pendente", "em_analise", "nova_revisao"]),
      supabase.from("doctors").select("state_uf").eq("is_deleted", false).not("state_uf", "is", null),
    ]);

    // Pendências aproximadas (consultas leves)
    const { data: doctors } = await supabase
      .from("doctors")
      .select("id, confidence_score")
      .eq("is_deleted", false)
      .limit(500);

    const doctorIds = (doctors ?? []).map((d) => d.id);
    let semCrm = 0;
    let semVinculo = 0;
    let semEvidencia = 0;
    const baixaConfianca = (doctors ?? []).filter((d) => d.confidence_score < 60).length;

    if (doctorIds.length > 0) {
      const [{ data: regs }, { data: linkRows }, { data: evRows }] = await Promise.all([
        supabase.from("medical_registrations").select("doctor_id").eq("registration_type", "CRM").in("doctor_id", doctorIds),
        supabase.from("doctor_facility_links").select("doctor_id").eq("is_deleted", false).in("doctor_id", doctorIds),
        supabase.from("evidences").select("entity_id").eq("entity_type", "doctor").in("entity_id", doctorIds),
      ]);
      const withCrm = new Set((regs ?? []).map((r) => r.doctor_id));
      const withLink = new Set((linkRows ?? []).map((r) => r.doctor_id));
      const withEv = new Set((evRows ?? []).map((r) => r.entity_id));
      semCrm = doctorIds.filter((id) => !withCrm.has(id)).length;
      semVinculo = doctorIds.filter((id) => !withLink.has(id)).length;
      semEvidencia = doctorIds.filter((id) => !withEv.has(id)).length;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: staleLinks } = await supabase
      .from("doctor_facility_links")
      .select("id", { count: "exact", head: true })
      .eq("is_deleted", false)
      .or(`last_validated_at.is.null,last_validated_at.lt.${thirtyDaysAgo.toISOString()}`);

    const { data: hemoFacilities } = await supabase
      .from("health_facilities")
      .select("id")
      .eq("is_deleted", false)
      .eq("has_hemodynamics", true)
      .limit(200);
    const hemoIds = (hemoFacilities ?? []).map((f) => f.id);
    let hemoSemMedicos = 0;
    if (hemoIds.length > 0) {
      const { data: hemoLinks } = await supabase
        .from("doctor_facility_links")
        .select("facility_id")
        .eq("is_deleted", false)
        .in("facility_id", hemoIds);
      const withDocs = new Set((hemoLinks ?? []).map((l) => l.facility_id));
      hemoSemMedicos = hemoIds.filter((id) => !withDocs.has(id)).length;
    }

    const stateMap = new Map<string, number>();
    for (const row of byState.data ?? []) {
      const uf = row.state_uf as string;
      stateMap.set(uf, (stateMap.get(uf) ?? 0) + 1);
    }

    return {
      totalMedicos: total.count ?? 0,
      candidatos: candidatos.count ?? 0,
      emRevisao: emRevisao.count ?? 0,
      parcialmenteValidados: parcial.count ?? 0,
      validados: validados.count ?? 0,
      especialistasConfirmados: especialistas.count ?? 0,
      estabelecimentosAtivos: facilities.count ?? 0,
      estabelecimentosHemo: hemo.count ?? 0,
      vinculosAtivos: links.count ?? 0,
      contatosDisponiveis: contacts.count ?? 0,
      evidenciasPendentes: evidences.count ?? 0,
      pendenciasValidacao: pending.count ?? 0,
      semCrm,
      semVinculo,
      semEvidencia,
      baixaConfianca,
      vinculosSemValidacaoRecente: staleLinks ?? 0,
      hemoSemMedicos,
      porEstado: Array.from(stateMap.entries())
        .map(([state_uf, totalCount]) => ({ state_uf, total: totalCount }))
        .sort((a, b) => b.total - a.total),
    };
  } catch {
    return emptyStats;
  }
}

export async function getRecentAudit(limit = 10): Promise<
  ServiceResult<(AuditLog & { users_profile: Pick<UsersProfile, "full_name"> | null })[]>
> {
  if (!hasSupabaseEnv()) return ok([]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*, users_profile:actor_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return mapSupabaseError(error, "Não foi possível carregar a auditoria.");
  return ok(
    (data ?? []) as (AuditLog & {
      users_profile: Pick<UsersProfile, "full_name"> | null;
    })[],
  );
}

export async function listReviewQueue(filters?: {
  status?: string;
  priority?: string;
}): Promise<
  ServiceResult<
    (ReviewQueueItem & {
      doctors: { id: string; full_name: string; confidence_score: number; city: string | null; state_uf: string | null } | null;
    })[]
  >
> {
  if (!hasSupabaseEnv()) return ok([]);
  const supabase = await createClient();
  let query = supabase
    .from("review_queue")
    .select(
      "*, doctors(id, full_name, confidence_score, city, state_uf)",
    )
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.in("status", ["pendente", "em_analise", "nova_revisao"]);
  }

  const { data, error } = await query;
  if (error) return mapSupabaseError(error, "Não foi possível carregar a fila.");
  return ok(data ?? []);
}

export async function listAuditLogs(filters: {
  action?: string;
  entityType?: string;
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<{ rows: AuditLog[]; total: number }>> {
  if (!hasSupabaseEnv()) return ok({ rows: [], total: 0 });
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("*, users_profile:actor_id(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);

  const { data, error, count } = await query;
  if (error) return mapSupabaseError(error, "Não foi possível carregar a auditoria.");
  return ok({ rows: (data ?? []) as AuditLog[], total: count ?? 0 });
}

export async function listUsers(): Promise<ServiceResult<UsersProfile[]>> {
  if (!hasSupabaseEnv()) return ok([]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users_profile")
    .select("*")
    .order("full_name");
  if (error) return mapSupabaseError(error, "Não foi possível carregar usuários.");
  return ok((data ?? []) as UsersProfile[]);
}
