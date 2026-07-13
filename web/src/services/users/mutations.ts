"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { assertMaster } from "@/lib/permissions";
import { fail, mapSupabaseError, ok, type ServiceResult } from "@/lib/service-result";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import type { AppRole } from "@/types/database";

export async function updateUserRoleAction(input: {
  userId: string;
  role: AppRole;
  isActive: boolean;
}): Promise<ServiceResult<{ id: string }>> {
  if (!hasSupabaseEnv()) return fail("Supabase não configurado.");
  const profile = await getCurrentProfile();
  const denied = assertMaster(profile);
  if (denied) return fail(denied, "FORBIDDEN");

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("users_profile")
    .select("*")
    .eq("id", input.userId)
    .maybeSingle();

  const { error } = await supabase
    .from("users_profile")
    .update({ role: input.role, is_active: input.isActive })
    .eq("id", input.userId);

  if (error) return mapSupabaseError(error, "Não foi possível atualizar o usuário.");

  await writeAuditLog(supabase, {
    action: "user.update_role",
    entityType: "users_profile",
    entityId: input.userId,
    before: before as Record<string, unknown> | null,
    after: { role: input.role, is_active: input.isActive },
  });

  revalidatePath("/usuarios");
  return ok({ id: input.userId });
}
