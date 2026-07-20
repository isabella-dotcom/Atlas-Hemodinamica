import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { BatchActions } from "./batch-actions";

export default async function ImportBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!canWrite(profile?.role)) redirect("/acesso-negado");

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("import_batches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!batch) notFound();

  const { data: errors } = await supabase
    .from("raw_records")
    .select("row_number, error_message, validation_errors, match_status, is_valid")
    .eq("batch_id", id)
    .or("is_valid.eq.false,match_status.eq.erro,match_status.eq.duplicado")
    .order("row_number")
    .limit(200);

  const { data: sample } = await supabase
    .from("raw_records")
    .select("row_number, is_valid, match_status, normalized_payload, error_message")
    .eq("batch_id", id)
    .order("row_number")
    .limit(20);

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.file_name}
        description={`Status: ${batch.status} · Hash: ${batch.file_hash?.slice(0, 16) ?? "—"}…`}
        breadcrumbs={[
          { label: "Importações", href: "/importacoes" },
          { label: batch.file_name },
        ]}
        actions={
          <BatchActions
            batchId={batch.id}
            status={batch.status}
            errors={(errors ?? []).map((e) => ({
              row_number: e.row_number,
              error_message: e.error_message,
              match_status: e.match_status,
            }))}
          />
        }
      />

      <dl className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3 text-sm">
        <Item label="Entidade" value={batch.entity_type} />
        <Item label="Linhas" value={String(batch.row_count ?? 0)} />
        <Item label="Válidas" value={String(batch.valid_count ?? 0)} />
        <Item label="Inválidas" value={String(batch.invalid_count ?? 0)} />
        <Item label="Duplicadas" value={String(batch.duplicate_count ?? 0)} />
        <Item label="Médicos gerados" value={String(batch.doctors_found ?? 0)} />
        <Item label="Estabelecimentos" value={String(batch.facilities_found ?? 0)} />
        <Item label="Vínculos" value={String(batch.links_found ?? 0)} />
        <Item label="Contatos" value={String(batch.contacts_found ?? 0)} />
        <Item label="Evidências" value={String(batch.evidences_found ?? 0)} />
        <Item label="Competência" value={batch.competencia} />
        <Item label="UF" value={batch.state_uf} />
      </dl>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-3 text-sm font-medium">Amostra (20 linhas)</h3>
        {(sample ?? []).length === 0 ? (
          <EmptyState title="Sem registros brutos" />
        ) : (
          <ul className="space-y-2 text-xs">
            {(sample ?? []).map((row) => (
              <li key={row.row_number} className="rounded border border-[var(--border)] px-3 py-2">
                #{row.row_number} · {row.match_status} ·{" "}
                {row.is_valid ? "válida" : "inválida"}
                {row.error_message ? ` — ${row.error_message}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-3 text-sm font-medium">Erros / duplicidades</h3>
        {(errors ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhum erro listado.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {(errors ?? []).map((row) => (
              <li key={`${row.row_number}-${row.match_status}`}>
                Linha {row.row_number}: {row.error_message || row.match_status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/validacao" className="text-sm text-[var(--accent)] hover:underline">
        Abrir fila de validação →
      </Link>
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
