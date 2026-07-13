import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import type { DashboardStats, UsersProfile } from "@/types/database";

const emptyStats: DashboardStats = {
  candidatos: 0,
  validados: 0,
  crmsConfirmados: 0,
  rqesConfirmados: 0,
  estabelecimentosHemo: 0,
  contatosDisponiveis: 0,
  pendenciasValidacao: 0,
  porEstado: [],
};

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!hasSupabaseEnv()) return emptyStats;

  try {
    const supabase = await createClient();

    const [
      candidatos,
      validados,
      crms,
      rqes,
      facilities,
      contacts,
      pending,
      byState,
    ] = await Promise.all([
      supabase
        .from("doctors")
        .select("id", { count: "exact", head: true })
        .eq("layer", "candidato")
        .eq("is_deleted", false),
      supabase
        .from("doctors")
        .select("id", { count: "exact", head: true })
        .eq("layer", "oficial")
        .eq("is_deleted", false),
      supabase
        .from("medical_registrations")
        .select("id", { count: "exact", head: true })
        .eq("registration_type", "CRM")
        .eq("status", "ativo"),
      supabase
        .from("medical_registrations")
        .select("id", { count: "exact", head: true })
        .eq("registration_type", "RQE")
        .gte("confidence_score", 70),
      supabase
        .from("health_facilities")
        .select("id", { count: "exact", head: true })
        .eq("has_hemodynamics", true)
        .eq("is_deleted", false),
      supabase
        .from("professional_contacts")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("review_queue")
        .select("id", { count: "exact", head: true })
        .in("status", ["pendente", "em_analise", "nova_revisao"]),
      supabase
        .from("doctors")
        .select("state_uf")
        .eq("is_deleted", false)
        .not("state_uf", "is", null),
    ]);

    const stateMap = new Map<string, number>();
    for (const row of byState.data ?? []) {
      const uf = row.state_uf as string;
      stateMap.set(uf, (stateMap.get(uf) ?? 0) + 1);
    }

    return {
      candidatos: candidatos.count ?? 0,
      validados: validados.count ?? 0,
      crmsConfirmados: crms.count ?? 0,
      rqesConfirmados: rqes.count ?? 0,
      estabelecimentosHemo: facilities.count ?? 0,
      contatosDisponiveis: contacts.count ?? 0,
      pendenciasValidacao: pending.count ?? 0,
      porEstado: Array.from(stateMap.entries())
        .map(([state_uf, total]) => ({ state_uf, total }))
        .sort((a, b) => b.total - a.total),
    };
  } catch {
    return emptyStats;
  }
}

export async function getCurrentProfile(): Promise<UsersProfile | null> {
  if (!hasSupabaseEnv()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data } = await supabase
      .from("users_profile")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return data as UsersProfile | null;
  } catch {
    return null;
  }
}
