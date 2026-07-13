import type { SupabaseClient } from "@supabase/supabase-js";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Estratégia de auditoria:
 * - Preferência: RPC `write_audit_log` (security definer, actor = auth.uid()).
 * - Fallback: insert direto em `audit_logs` se a migration 005 ainda não foi aplicada.
 * Não duplicar o mesmo evento em trigger + serviço.
 */
export async function writeAuditLog(
  supabase: SupabaseClient,
  input: AuditInput,
): Promise<void> {
  const { error: rpcError } = await supabase.rpc("write_audit_log", {
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_before: input.before ?? null,
    p_after: input.after ?? null,
    p_metadata: input.metadata ?? null,
  });

  if (!rpcError) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("audit_logs").insert({
    actor_id: user?.id ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_data: input.before ?? null,
    after_data: input.after ?? null,
    metadata: input.metadata ?? null,
  });
}
