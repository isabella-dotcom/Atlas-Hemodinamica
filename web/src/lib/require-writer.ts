import { assertCanWrite } from "@/lib/permissions";
import { fail, type ServiceResult } from "@/lib/service-result";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import type { UsersProfile } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WriterGate =
  | { ok: true; profile: UsersProfile; supabase: SupabaseClient }
  | { ok: false; error: ServiceResult<never> };

export async function requireWriter(): Promise<WriterGate> {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: fail("Supabase não configurado.") };
  }
  const profile = await getCurrentProfile();
  const denied = assertCanWrite(profile);
  if (denied || !profile) {
    return { ok: false, error: fail(denied ?? "Sessão inválida.", "FORBIDDEN") };
  }
  return { ok: true, profile, supabase: await createClient() };
}
