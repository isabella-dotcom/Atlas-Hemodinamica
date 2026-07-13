import { APP_VERSION, EXPECTED_MIGRATIONS, getAppEnvironment, hasValidPublicEnv } from "@/lib/env";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export type CheckStatus =
  | "ok"
  | "fail"
  | "unavailable"
  | "forbidden"
  | "unconfigured"
  | "unknown";

export type DiagnosticReport = {
  checkedAt: string;
  appVersion: string;
  environment: "development" | "production" | "test";
  supabaseConfigured: boolean;
  authenticated: boolean;
  profileFound: boolean;
  role: string | null;
  profileActive: boolean | null;
  databaseReadable: boolean;
  databaseError: string | null;
  buckets: {
    evidences: CheckStatus;
    imports: CheckStatus;
  };
  rpcs: {
    search_doctors: CheckStatus;
    explain_doctor_confidence: CheckStatus;
    write_audit_log: CheckStatus;
    diagnostic_foundation_check: CheckStatus;
  };
  foundation: Record<string, unknown> | null;
  expectedMigrations: readonly string[];
  notes: string[];
  guidance: string[];
};

export async function runFoundationDiagnostic(): Promise<DiagnosticReport> {
  const notes: string[] = [];
  const guidance: string[] = [];
  const report: DiagnosticReport = {
    checkedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    environment: getAppEnvironment(),
    supabaseConfigured: hasSupabaseEnv() && hasValidPublicEnv(),
    authenticated: false,
    profileFound: false,
    role: null,
    profileActive: null,
    databaseReadable: false,
    databaseError: null,
    buckets: { evidences: "unknown", imports: "unknown" },
    rpcs: {
      search_doctors: "unknown",
      explain_doctor_confidence: "unknown",
      write_audit_log: "unknown",
      diagnostic_foundation_check: "unknown",
    },
    foundation: null,
    expectedMigrations: EXPECTED_MIGRATIONS,
    notes,
    guidance,
  };

  if (!report.supabaseConfigured) {
    notes.push("Variáveis NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes ou inválidas.");
    guidance.push("Crie web/.env.local a partir de web/.env.example e reinicie o servidor.");
    return report;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) notes.push("Falha ao recuperar sessão (detalhe omitido).");
    report.authenticated = Boolean(user);

    if (!user) {
      notes.push("Nenhum usuário autenticado nesta verificação.");
      guidance.push("Faça login e execute o diagnóstico novamente.");
      return report;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users_profile")
      .select("role, is_active, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      notes.push("Não foi possível ler users_profile (RLS ou schema).");
      guidance.push("Aplique as migrations 001–006 e confirme o trigger handle_new_user.");
    }

    report.profileFound = Boolean(profile);
    report.role = profile?.role ?? null;
    report.profileActive = profile?.is_active ?? null;

    if (!profile) {
      notes.push("Perfil ausente.");
      guidance.push("Confirme creation automática em users_profile após Auth.");
    }

    if (profile && profile.role !== "master") {
      notes.push("Esta rota de diagnóstico é restrita a Master.");
      guidance.push("Promova o usuário com SQL via auth.users (role = master).");
    }

    const { error: readError } = await supabase
      .from("data_sources")
      .select("id")
      .limit(1);

    if (readError) {
      report.databaseReadable = false;
      report.databaseError = "Leitura autorizada falhou (mensagem omitida).";
      notes.push("Acesso ao banco indisponível para este usuário.");
      guidance.push("Verifique RLS, usuário ativo e migrations aplicadas.");
    } else {
      report.databaseReadable = true;
    }

    for (const bucket of ["evidences", "imports"] as const) {
      const { error: bucketError } = await supabase.storage.from(bucket).list("", {
        limit: 1,
      });
      if (bucketError) {
        report.buckets[bucket] = "fail";
        notes.push(`Bucket "${bucket}" indisponível ou sem permissão.`);
        guidance.push(`Aplique a migration 002 e confirme o bucket privado "${bucket}".`);
      } else {
        report.buckets[bucket] = "ok";
      }
    }

    // RPC probes (somente leitura / no-op seguro)
    const { error: searchError } = await supabase.rpc("search_doctors", {
      p_search: "__diagnostic__",
      p_limit: 1,
      p_offset: 0,
    });
    report.rpcs.search_doctors = searchError ? "fail" : "ok";
    if (searchError) {
      notes.push("RPC search_doctors indisponível.");
      guidance.push("Aplique a migration 004 (e 006 se necessário para extensões).");
    }

    const { error: confError } = await supabase.rpc("explain_doctor_confidence", {
      p_doctor_id: "00000000-0000-4000-8000-000000000000",
    });
    // not_found JSON still means function exists
    report.rpcs.explain_doctor_confidence = confError ? "fail" : "ok";
    if (confError) {
      notes.push("RPC explain_doctor_confidence indisponível.");
      guidance.push("Aplique a migration 004.");
    }

    // write_audit_log: não grava evento de teste automaticamente aqui
    // Apenas checa existência via diagnostic_foundation_check quando Master
    if (profile?.role === "master") {
      const { data: foundation, error: diagError } = await supabase.rpc(
        "diagnostic_foundation_check",
      );
      if (diagError) {
        report.rpcs.diagnostic_foundation_check = "fail";
        report.rpcs.write_audit_log = "unknown";
        notes.push("RPC diagnostic_foundation_check indisponível.");
        guidance.push("Aplique a migration 006_supabase_integration_fixes.sql.");
      } else {
        report.rpcs.diagnostic_foundation_check = "ok";
        report.foundation = foundation as Record<string, unknown>;
        const fns = (foundation as { functions?: Record<string, boolean> })?.functions;
        report.rpcs.write_audit_log = fns?.write_audit_log ? "ok" : "fail";
        if (!fns?.write_audit_log) {
          notes.push("Função write_audit_log não encontrada.");
          guidance.push("Aplique a migration 005.");
        }
      }
    } else {
      report.rpcs.diagnostic_foundation_check = "forbidden";
      report.rpcs.write_audit_log = "unknown";
    }
  } catch {
    notes.push("Erro inesperado durante o diagnóstico (detalhes omitidos).");
    guidance.push("Revise .env.local, migrations e logs do servidor em desenvolvimento.");
  }

  return report;
}
