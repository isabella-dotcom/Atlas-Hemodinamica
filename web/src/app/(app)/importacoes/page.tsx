import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { ImportWizard } from "./import-wizard";
import { IMPORT_ENTITY_LABELS, type ImportEntityType } from "@/services/imports/templates";

export default async function ImportacoesPage() {
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) {
    redirect("/acesso-negado");
  }

  const supabase = await createClient();
  const [{ data: batches }, { data: sources }] = await Promise.all([
    supabase
      .from("import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("data_sources")
      .select("id, code, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importações"
        description="Arquivos entram em RAW → candidatos → fila de validação. Nada vai direto para a base oficial."
      />

      <ImportWizard sources={sources ?? []} />

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
          Lotes recentes
        </div>
        {(batches ?? []).length === 0 ? (
          <EmptyState title="Nenhuma importação registrada" />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {(batches ?? []).map((batch) => (
              <li key={batch.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/importacoes/${batch.id}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {batch.file_name}
                    </Link>
                    <p className="text-[var(--muted)]">
                      {batch.entity_type
                        ? IMPORT_ENTITY_LABELS[batch.entity_type as ImportEntityType] ??
                          batch.entity_type
                        : "—"}{" "}
                      · {batch.status}
                      {batch.row_count != null ? ` · ${batch.row_count} linhas` : ""}
                      {batch.valid_count != null
                        ? ` · ${batch.valid_count} válidas`
                        : ""}
                      {batch.invalid_count != null
                        ? ` · ${batch.invalid_count} inválidas`
                        : ""}
                    </p>
                  </div>
                  <time className="text-xs text-[var(--muted)]">
                    {new Date(batch.created_at).toLocaleString("pt-BR")}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
