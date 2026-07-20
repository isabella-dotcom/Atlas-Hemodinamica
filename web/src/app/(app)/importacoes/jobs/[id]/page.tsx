import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { JobActions } from "./job-actions";

export default async function IngestionJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const writer = canWrite(profile?.role);
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("ingestion_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();
  if (!writer && !["completed", "partial"].includes(job.status)) notFound();

  const [{ data: logs }, { data: files }] = await Promise.all([
    supabase
      .from("ingestion_job_logs")
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    writer
      ? supabase.from("source_files").select("*").eq("job_id", id).limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const metrics = (job.metrics || {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${job.source_code} — ${job.job_type}`}
        description={`Status: ${job.status} · ${job.progress_percentage}% · ${job.current_step || "—"}`}
        breadcrumbs={[
          { label: "Importações", href: "/importacoes" },
          { label: "Jobs", href: "/importacoes/jobs" },
          { label: job.id.slice(0, 8) },
        ]}
        actions={writer ? <JobActions jobId={job.id} status={job.status} /> : undefined}
      />

      <dl className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3 text-sm">
        <Item label="UF" value={job.state_uf} />
        <Item label="Competência" value={job.competence} />
        <Item label="Etapa" value={job.current_step} />
        <Item label="Início" value={job.started_at && new Date(job.started_at).toLocaleString("pt-BR")} />
        <Item label="Fim" value={job.finished_at && new Date(job.finished_at).toLocaleString("pt-BR")} />
        <Item label="Erro" value={job.error_message} />
        <Item label="Hospitais" value={String(metrics.facilities ?? 0)} />
        <Item label="Médicos" value={String(metrics.doctors ?? 0)} />
        <Item label="Candidatos" value={String(metrics.candidates ?? 0)} />
        <Item label="Matches" value={String(metrics.matches ?? 0)} />
        <Item label="Erros" value={String(metrics.errors ?? 0)} />
      </dl>

      {writer ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-3 text-sm font-medium">Arquivos</h3>
          {(files ?? []).length === 0 ? (
            <EmptyState title="Nenhum arquivo registrado" />
          ) : (
            <ul className="space-y-2 text-xs">
              {(files ?? []).map((f) => (
                <li key={f.id}>
                  {f.original_filename} · {f.status} · hash {f.file_hash?.slice(0, 12)}…
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-3 text-sm font-medium">Logs</h3>
        {(logs ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sem logs ainda.</p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-auto text-xs font-mono">
            {(logs ?? []).map((log) => (
              <li key={log.id}>
                [{log.level}] {log.step || "-"} — {log.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
