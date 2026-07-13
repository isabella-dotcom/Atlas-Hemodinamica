import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_SUPABASE_URL não definida")
    .url("NEXT_PUBLIC_SUPABASE_URL inválida"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY não definida ou inválida"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export type EnvValidationResult =
  | { ok: true; env: PublicEnv }
  | { ok: false; issues: string[] };

export type EnvSource = Record<string, string | undefined>;

export function validatePublicEnv(
  source: EnvSource = process.env,
): EnvValidationResult {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (parsed.success) {
    return { ok: true, env: parsed.data };
  }

  const issues = parsed.error.issues.map((issue) => issue.message);
  return { ok: false, issues };
}

export function hasValidPublicEnv(source: EnvSource = process.env): boolean {
  return validatePublicEnv(source).ok;
}

export function getPublicEnv(): PublicEnv {
  const result = validatePublicEnv();
  if (!result.ok) {
    const message = [
      "Configuração do Supabase incompleta ou inválida.",
      ...result.issues.map((issue) => `- ${issue}`),
      "Defina as variáveis em web/.env.local (veja web/.env.example).",
      "Valores das chaves nunca são exibidos por segurança.",
    ].join("\n");
    throw new Error(message);
  }
  return result.env;
}

export function getAppEnvironment(): "development" | "production" | "test" {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

export const EXPECTED_MIGRATIONS = [
  "001_initial_schema.sql",
  "002_auth_and_storage.sql",
  "003_fix_auth_profile_and_policies.sql",
  "004_unified_doctor_search.sql",
  "005_audit_and_integrity_improvements.sql",
] as const;

export const APP_VERSION = "0.1.0";
