import { APP_VERSION, EXPECTED_MIGRATIONS, getAppEnvironment } from "@/lib/env";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

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
    evidences: "available" | "unavailable" | "unknown";
    imports: "available" | "unavailable" | "unknown";
  };
  expectedMigrations: readonly string[];
  notes: string[];
};

export async function runFoundationDiagnostic(): Promise<DiagnosticReport> {
  const notes: string[] = [];
  const report: DiagnosticReport = {
    checkedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    environment: getAppEnvironment(),
    supabaseConfigured: hasSupabaseEnv(),
    authenticated: false,
    profileFound: false,
    role: null,
    profileActive: null,
    databaseReadable: false,
    databaseError: null,
    buckets: {
      evidences: "unknown",
      imports: "unknown",
    },
    expectedMigrations: EXPECTED_MIGRATIONS,
    notes,
  };

  if (!report.supabaseConfigured) {
    notes.push(
      "NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausente/inválida.",
    );
    return report;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      notes.push("Falha ao recuperar sessão (detalhe omitido).");
    }

    report.authenticated = Boolean(user);

    if (!user) {
      notes.push("Nenhum usuário autenticado nesta verificação.");
      return report;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users_profile")
      .select("role, is_active, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      notes.push("Não foi possível ler users_profile (RLS ou schema).");
    }

    report.profileFound = Boolean(profile);
    report.role = profile?.role ?? null;
    report.profileActive = profile?.is_active ?? null;

    if (!profile) {
      notes.push(
        "Perfil ausente — confira trigger handle_new_user na migration 002/003.",
      );
    }

    const { error: readError } = await supabase
      .from("data_sources")
      .select("id")
      .limit(1);

    if (readError) {
      report.databaseReadable = false;
      report.databaseError = "Leitura autorizada falhou (mensagem omitida).";
      notes.push("Acesso ao banco indisponível para este usuário.");
    } else {
      report.databaseReadable = true;
    }

    for (const bucket of ["evidences", "imports"] as const) {
      const { error: bucketError } = await supabase.storage.from(bucket).list("", {
        limit: 1,
      });
      report.buckets[bucket] = bucketError ? "unavailable" : "available";
      if (bucketError) {
        notes.push(
          `Bucket "${bucket}" indisponível ou sem permissão de listagem.`,
        );
      }
    }

    if (report.role !== "master") {
      notes.push("Esta rota de diagnóstico é restrita a Master.");
    }
  } catch {
    notes.push("Erro inesperado durante o diagnóstico (detalhes omitidos).");
  }

  return report;
}
