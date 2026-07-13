import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import type { UsersProfile } from "@/types/database";

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

/** @deprecated Use services/dashboard/queries.getDashboardStats */
export { getDashboardStats } from "@/services/dashboard/queries";
