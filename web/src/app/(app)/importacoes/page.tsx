import { createClient } from "@/lib/supabase/server";
import { ImportUploadForm } from "./import-upload-form";

export default async function ImportacoesPage() {
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Importações
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Arquivos entram na camada bruta e geram prévia antes da confirmação.
          Nada vai direto para a base oficial.
        </p>
      </div>

      <ImportUploadForm />

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
          Lotes recentes
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {(batches ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              Nenhuma importação registrada.
            </li>
          ) : (
            (batches ?? []).map((batch) => (
              <li
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-[var(--ink)]">
                    {batch.file_name}
                  </p>
                  <p className="text-[var(--muted)]">
                    {batch.file_type} · {batch.status}
                    {batch.row_count != null ? ` · ${batch.row_count} linhas` : ""}
                  </p>
                </div>
                <time className="text-xs text-[var(--muted)]">
                  {new Date(batch.created_at).toLocaleString("pt-BR")}
                </time>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
