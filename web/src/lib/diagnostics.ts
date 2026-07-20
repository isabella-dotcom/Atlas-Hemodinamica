import { APP_VERSION, EXPECTED_MIGRATIONS, getAppEnvironment, hasValidPublicEnv } from "@/lib/env";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export type CheckStatus =
  | "ok"
  | "fail"
  | "unavailable"
  | "forbidden"
  | "unconfigured"
  | "unknown"
  | "partial";

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
    diagnostic_phase_ac_check: CheckStatus;
  };
  schemaPhaseAc: CheckStatus;
  schemaDetails: Record<string, unknown> | null;
  demoCounts: { doctors: number | null; facilities: number | null };
  foundation: Record<string, unknown> | null;
  expectedMigrations: readonly string[];
  notes: string[];
  guidance: string[];
};

async function probeColumn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (t: string) => any },
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return true;
  const message = (error.message ?? "").toLowerCase();
  return !(
    message.includes("column") ||
    message.includes(column.toLowerCase()) ||
    error.code === "42703"
  );
}

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
      diagnostic_phase_ac_check: "unknown",
    },
    schemaPhaseAc: "unknown",
    schemaDetails: null,
    demoCounts: { doctors: null, facilities: null },
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
    report.rpcs.explain_doctor_confidence = confError ? "fail" : "ok";
    if (confError) {
      notes.push("RPC explain_doctor_confidence indisponível.");
      guidance.push("Aplique a migration 004.");
    }

    // Probes de colunas Fase A–C (sem information_schema)
    const probes: Array<[string, string]> = [
      ["doctors", "social_name"],
      ["doctors", "is_demo"],
      ["doctors", "biography"],
      ["medical_registrations", "verification_status"],
      ["health_facilities", "normalized_name"],
      ["health_facilities", "has_catheterization_lab"],
      ["doctor_facility_links", "function_title"],
      ["professional_contacts", "contact_status"],
    ];
    let okCount = 0;
    const missing: string[] = [];
    for (const [table, column] of probes) {
      const present = await probeColumn(supabase, table, column);
      if (present) okCount += 1;
      else missing.push(`${table}.${column}`);
    }
    if (okCount === probes.length) {
      report.schemaPhaseAc = "ok";
    } else if (okCount === 0) {
      report.schemaPhaseAc = "fail";
      notes.push("Colunas da Fase A–C ausentes (migrations 007–011 não aplicadas).");
      guidance.push("No SQL Editor, aplique 007→011 nesta ordem e rode verify_phase_ac.sql.");
    } else {
      report.schemaPhaseAc = "partial";
      notes.push(`Schema parcial. Ausentes: ${missing.join(", ")}`);
      guidance.push("Aplique a migration 011_ensure_phase_ac_schema.sql para completar.");
    }

    const { count: demoDoctors } = await supabase
      .from("doctors")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true);
    const { count: demoFacilities } = await supabase
      .from("health_facilities")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true);
    report.demoCounts = {
      doctors: demoDoctors ?? null,
      facilities: demoFacilities ?? null,
    };

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

      const { data: phaseAc, error: phaseError } = await supabase.rpc(
        "diagnostic_phase_ac_check",
      );
      if (phaseError) {
        report.rpcs.diagnostic_phase_ac_check = "fail";
        notes.push("RPC diagnostic_phase_ac_check indisponível.");
        guidance.push("Aplique a migration 011_ensure_phase_ac_schema.sql.");
      } else {
        report.rpcs.diagnostic_phase_ac_check = "ok";
        report.schemaDetails = phaseAc as Record<string, unknown>;
      }
    } else {
      report.rpcs.diagnostic_foundation_check = "forbidden";
      report.rpcs.diagnostic_phase_ac_check = "forbidden";
      report.rpcs.write_audit_log = "unknown";
    }
  } catch {
    notes.push("Erro inesperado durante o diagnóstico (detalhes omitidos).");
    guidance.push("Revise .env.local, migrations e logs do servidor em desenvolvimento.");
  }

  return report;
}
