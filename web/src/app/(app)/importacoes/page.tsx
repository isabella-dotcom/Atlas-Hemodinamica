import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { ImportWizard } from "./import-wizard";
import { StartIngestionForm } from "./start-ingestion-form";
import { IMPORT_ENTITY_LABELS, type ImportEntityType } from "@/services/imports/templates";

export default async function ImportacoesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const writer = canWrite(profile?.role);

  const [{ data: batches }, { data: sources }, { data: jobs }] = await Promise.all([
    writer
      ? supabase
          .from("import_batches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabase
      .from("data_sources")
      .select("id, code, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("ingestion_jobs")
      .select("id, job_type, source_code, state_uf, competence, status, progress_percentage, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (!writer && !profile) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importações e ingestão"
        description="Ingestão automática a partir de fontes oficiais (principal) e planilhas manuais (auxiliar)."
      />

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-white" href="/importacoes">
          Visão geral
        </Link>
        <Link className="rounded-md border border-[var(--border)] px-3 py-1.5" href="/importacoes/jobs">
          Jobs
        </Link>
        <Link className="rounded-md border border-[var(--border)] px-3 py-1.5" href="/importacoes/fontes">
          Fontes
        </Link>
        {writer ? (
          <Link
            className="rounded-md border border-[var(--border)] px-3 py-1.5"
            href="/importacoes/configuracoes"
          >
            Configurações
          </Link>
        ) : null}
      </nav>

      {writer ? <StartIngestionForm /> : null}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-medium">Jobs recentes</h3>
          <Link href="/importacoes/jobs" className="text-xs text-[var(--accent)]">
            Ver todos
          </Link>
        </div>
        {(jobs ?? []).length === 0 ? (
          <EmptyState title="Nenhum job de ingestão" />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {(jobs ?? []).map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link href={`/importacoes/jobs/${job.id}`} className="font-medium text-[var(--accent)]">
                    {job.source_code} · {job.job_type}
                  </Link>
                  <p className="text-[var(--muted)]">
                    {job.state_uf || "—"} · {job.competence || "—"} · {job.status} ·{" "}
                    {job.progress_percentage}%
                  </p>
                </div>
                <time className="text-xs text-[var(--muted)]">
                  {new Date(job.created_at).toLocaleString("pt-BR")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {writer ? (
        <>
          <h2 className="text-lg font-medium">Importação manual (auxiliar)</h2>
          <ImportWizard sources={sources ?? []} />
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
              Lotes manuais recentes
            </div>
            {(batches ?? []).length === 0 ? (
              <EmptyState title="Nenhuma importação manual" />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {(batches ?? []).map((batch) => (
                  <li key={batch.id} className="px-4 py-3 text-sm">
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
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Visualizador: apenas acompanhamento de jobs concluídos. Sem acesso a arquivos
          restritos nem início de ingestão.
        </p>
      )}
    </div>
  );
}
