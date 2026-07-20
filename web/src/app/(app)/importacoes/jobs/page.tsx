import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/page";

export default async function IngestionJobsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const writer = canWrite(profile?.role);

  let query = supabase
    .from("ingestion_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!writer) {
    query = query.in("status", ["completed", "partial"]);
  }
  const { data: jobs } = await query;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs de ingestão"
        description="Fila processada pelo worker Python (GitHub Actions)."
        breadcrumbs={[
          { label: "Importações", href: "/importacoes" },
          { label: "Jobs" },
        ]}
      />
      {(jobs ?? []).length === 0 ? (
        <EmptyState title="Nenhum job" />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {(jobs ?? []).map((job) => (
            <li key={job.id} className="px-4 py-3 text-sm">
              <Link
                href={`/importacoes/jobs/${job.id}`}
                className="font-medium text-[var(--accent)] hover:underline"
              >
                {job.source_code} / {job.job_type}
              </Link>
              <p className="text-[var(--muted)]">
                {job.state_uf || "BR"} · {job.competence || "—"} · {job.status} ·{" "}
                {job.progress_percentage}% · {job.current_step || "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
